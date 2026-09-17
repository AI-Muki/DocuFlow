import { rbacService } from '../rbac/rbac.service.ts';
import { store } from '../../database/store.ts';
import { documentStore } from '../../database/document-store.ts';
import { storageService } from '../storage/storage.service.ts';
import { storageConfig } from '../storage/storage.config.ts';
import { assertValidFile } from '../storage/mime-validator.ts';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.ts';
import type { Document, DocumentVersion, User } from '../../types/index.ts';

export interface UploadDocumentInput {
  buffer: Buffer;
  originalFileName: string;
  declaredMimeType?: string;
  name?: string;
  folderId?: string | null;
  documentTypeId?: string | null;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  allowDuplicate?: boolean;
}

export interface UploadResult {
  isDuplicate: boolean;
  duplicateMessage?: string;
  existingDocument?: Document | null;
  document?: Document;
  version?: DocumentVersion;
}

export interface DownloadResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export class DocumentUploadService {
  private static instance: DocumentUploadService;

  public static getInstance(): DocumentUploadService {
    if (!DocumentUploadService.instance) {
      DocumentUploadService.instance = new DocumentUploadService();
    }
    return DocumentUploadService.instance;
  }

  /**
   * Uploads and registers a new document with Version 1 and storage backing
   */
  public async uploadDocument(
    user: User,
    input: UploadDocumentInput
  ): Promise<UploadResult> {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId;
    if (!orgId) {
      throw new ValidationError('User has no active organization');
    }

    if (!input.buffer || input.buffer.length === 0) {
      throw new ValidationError('Cannot upload an empty file');
    }

    // 1. Authoritatively validate extension, declared MIME, size, and magic bytes
    const validation = assertValidFile(
      input.buffer,
      input.originalFileName,
      input.declaredMimeType,
      storageConfig.maxFileSizeBytes
    );

    // 2. Compute cryptographic SHA-256 checksum
    const checksum = storageService.calculateChecksum(input.buffer);

    // 3. Duplicate detection within this organization
    const existing = documentStore.findDocumentByChecksum(orgId, checksum);
    if (existing && !input.allowDuplicate) {
      return {
        isDuplicate: true,
        duplicateMessage: 'An identical file already exists.',
        existingDocument: existing,
      };
    }

    // 4. Generate collision-resistant tenant storage key
    const storageKey = storageService.generateStorageKey(orgId, input.originalFileName);

    // 5. Store file via storage provider
    await storageService.getProvider().upload(storageKey, input.buffer, {
      contentType: validation.mimeType,
      metadata: {
        organizationId: orgId,
        uploadedBy: user.id,
        originalName: input.originalFileName,
      },
    });

    // 6. Create Document Record & initial Version 1 in data store
    const displayName =
      input.name && input.name.trim().length > 0
        ? input.name.trim()
        : input.originalFileName;

    const doc = documentStore.createDocumentRecord(orgId, user.id, {
      name: displayName,
      originalFileName: input.originalFileName,
      mimeType: validation.mimeType,
      fileSize: input.buffer.length,
      storageKey,
      checksum,
      description: input.description,
      folderId: input.folderId,
      documentTypeId: input.documentTypeId,
      ownerId: user.id,
      tags: input.tags,
      metadata: input.metadata,
    });

    const versions = documentStore.getDocumentVersions(orgId, doc.id);
    const initialVersion = versions[0];

    // 7. Record audit log
    store.recordAuditLog(
      orgId,
      user.id,
      'document.uploaded',
      'Document',
      doc.id,
      {
        name: doc.name,
        fileName: input.originalFileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        checksum: doc.checksum,
        storageKey: doc.storageKey,
        isDuplicateOverride: Boolean(existing && input.allowDuplicate),
      }
    );

    return {
      isDuplicate: false,
      document: doc,
      version: initialVersion,
    };
  }

  /**
   * Uploads a new version for an existing document
   */
  public async uploadNewVersion(
    user: User,
    documentId: string,
    file: {
      buffer: Buffer;
      originalFileName: string;
      declaredMimeType?: string;
    },
    changeDescription?: string
  ): Promise<DocumentVersion> {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId;
    if (!orgId) {
      throw new ValidationError('User has no active organization');
    }

    const doc = documentStore.getDocumentById(orgId, documentId);
    if (!doc) {
      throw new NotFoundError('Document');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new ValidationError('Cannot upload an empty file version');
    }

    // Validate file
    const validation = assertValidFile(
      file.buffer,
      file.originalFileName,
      file.declaredMimeType,
      storageConfig.maxFileSizeBytes
    );

    const checksum = storageService.calculateChecksum(file.buffer);
    const storageKey = storageService.generateStorageKey(orgId, file.originalFileName);

    // Upload to storage
    await storageService.getProvider().upload(storageKey, file.buffer, {
      contentType: validation.mimeType,
      metadata: {
        organizationId: orgId,
        documentId,
        uploadedBy: user.id,
      },
    });

    // Create new version
    const newVersion = documentStore.createDocumentVersion(orgId, documentId, user.id, {
      fileName: file.originalFileName,
      mimeType: validation.mimeType,
      fileSize: file.buffer.length,
      storageKey,
      checksum,
      changeDescription,
    });

    // Record audit log
    store.recordAuditLog(
      orgId,
      user.id,
      'document.version_created',
      'DocumentVersion',
      newVersion.id,
      {
        documentId,
        versionNumber: newVersion.versionNumber,
        fileName: newVersion.fileName,
        fileSize: newVersion.fileSize,
        checksum: newVersion.checksum,
      }
    );

    return newVersion;
  }

  /**
   * Retrieves file data buffer and metadata for authorized download
   */
  public async downloadDocumentFile(
    user: User,
    documentId: string,
    versionNumber?: number
  ): Promise<DownloadResult> {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId;
    if (!orgId) {
      throw new ValidationError('User has no active organization');
    }

    const doc = documentStore.getDocumentById(orgId, documentId);
    if (!doc) {
      throw new NotFoundError('Document');
    }

    let targetStorageKey = doc.storageKey;
    let targetFileName = doc.originalFileName;
    let targetMimeType = doc.mimeType;
    let targetFileSize = doc.fileSize;

    if (versionNumber !== undefined && versionNumber !== null) {
      const ver = documentStore.getDocumentVersion(orgId, documentId, versionNumber);
      if (!ver) {
        throw new NotFoundError(`Document Version ${versionNumber}`);
      }
      targetStorageKey = ver.storageKey;
      targetFileName = ver.fileName;
      targetMimeType = ver.mimeType;
      targetFileSize = ver.fileSize;
    }

    // Fetch binary from storage provider
    const buffer = await storageService.getProvider().download(targetStorageKey);

    // Audit download event
    store.recordAuditLog(
      orgId,
      user.id,
      'document.downloaded',
      'Document',
      doc.id,
      {
        documentId: doc.id,
        versionNumber: versionNumber || 'latest',
        fileName: targetFileName,
      }
    );

    return {
      buffer,
      fileName: targetFileName,
      mimeType: targetMimeType,
      fileSize: targetFileSize,
    };
  }

  /**
   * Generates a secure, time-limited signed URL for a document file
   */
  public async getSignedDownloadUrl(
    user: User,
    documentId: string,
    versionNumber?: number,
    inline?: boolean
  ): Promise<{ url: string; expiresInSeconds: number; fileName: string }> {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId;
    if (!orgId) {
      throw new ValidationError('User has no active organization');
    }

    const doc = documentStore.getDocumentById(orgId, documentId);
    if (!doc) {
      throw new NotFoundError('Document');
    }

    let storageKey = doc.storageKey;
    let fileName = doc.originalFileName;

    if (versionNumber !== undefined) {
      const ver = documentStore.getDocumentVersion(orgId, documentId, versionNumber);
      if (!ver) {
        throw new NotFoundError(`Document Version ${versionNumber}`);
      }
      storageKey = ver.storageKey;
      fileName = ver.fileName;
    }

    const url = await storageService.getProvider().getSignedUrl(storageKey, {
      filename: fileName,
      inline,
    });

    return {
      url,
      expiresInSeconds: storageConfig.signedUrlExpirySeconds,
      fileName,
    };
  }

  /**
   * Directly verifies signed token and fetches buffer without requiring active session cookies
   */
  public async downloadBySignedToken(token: string): Promise<DownloadResult> {
    const verified = storageService.getLocalProvider().verifySignedToken(token);
    if (!verified) {
      throw new ValidationError('Invalid or expired download link');
    }

    const buffer = await storageService.getProvider().download(verified.key);
    const fileName = verified.filename || 'downloaded_document';

    // Derive MIME from filename extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : 'application/octet-stream';

    return {
      buffer,
      fileName,
      mimeType,
      fileSize: buffer.length,
    };
  }
}

export const documentUploadService = DocumentUploadService.getInstance();
