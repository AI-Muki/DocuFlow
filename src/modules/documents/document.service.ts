// DocuFlow AI - Document & Folder Management Services
import { documentStore } from '../../database/document-store.ts';
import { store } from '../../database/store.ts';
import type {
  Document,
  DocumentFieldDefinition,
  DocumentStatus,
  DocumentType,
  DocumentVersion,
  Folder,
  Tag,
  User,
} from '../../types/index.ts';
import { rbacService } from '../rbac/rbac.service.ts';
import { ForbiddenError, NotFoundError, TenantViolationError } from '../../lib/errors.ts';

export class DocumentFolderService {
  // --------------------------------------------------------------------
  // Folder Operations
  // --------------------------------------------------------------------

  public getFolders(user: User, parentFolderId?: string | null): Folder[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getFoldersByOrganization(orgId, parentFolderId);
  }

  public getFolderById(user: User, folderId: string): Folder {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    const folder = documentStore.getFolderById(orgId, folderId);
    if (!folder) {
      throw new NotFoundError('Folder');
    }
    return folder;
  }

  public createFolder(
    user: User,
    data: { name: string; parentFolderId?: string | null }
  ): Folder {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId!;

    const folder = documentStore.createFolder(orgId, data.name, user.id, data.parentFolderId);

    store.recordAuditLog(
      orgId,
      user.id,
      'folder.created',
      'Folder',
      folder.id,
      { name: folder.name, parentFolderId: folder.parentFolderId }
    );

    return folder;
  }

  public renameFolder(user: User, folderId: string, newName: string): Folder {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const updated = documentStore.renameFolder(orgId, folderId, newName);

    store.recordAuditLog(
      orgId,
      user.id,
      'folder.renamed',
      'Folder',
      folderId,
      { newName: updated.name }
    );

    return updated;
  }

  public moveFolder(user: User, folderId: string, targetParentFolderId: string | null): Folder {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const updated = documentStore.moveFolder(orgId, folderId, targetParentFolderId);

    store.recordAuditLog(
      orgId,
      user.id,
      'folder.moved',
      'Folder',
      folderId,
      { targetParentFolderId }
    );

    return updated;
  }

  public deleteFolder(user: User, folderId: string): void {
    rbacService.assertPermission(user, 'documents.delete');
    const orgId = user.organizationId!;

    documentStore.deleteFolder(orgId, folderId);

    store.recordAuditLog(
      orgId,
      user.id,
      'folder.deleted',
      'Folder',
      folderId
    );
  }

  public getFolderPath(user: User, folderId: string): Folder[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getFolderPath(orgId, folderId);
  }

  // --------------------------------------------------------------------
  // Document Operations
  // --------------------------------------------------------------------

  public getDocuments(
    user: User,
    filter?: {
      folderId?: string | null;
      documentTypeId?: string;
      status?: DocumentStatus;
      ownerId?: string;
      search?: string;
    }
  ): Document[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getDocuments(orgId, filter);
  }

  public getDocumentById(user: User, documentId: string): Document {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    const doc = documentStore.getDocumentById(orgId, documentId);
    if (!doc) {
      throw new NotFoundError('Document');
    }
    return doc;
  }

  public createDocument(
    user: User,
    data: {
      name: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      storageKey: string;
      checksum: string;
      description?: string;
      folderId?: string | null;
      documentTypeId?: string | null;
      ownerId?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Document {
    return this.createDocumentRecord(user, data);
  }

  public createDocumentRecord(
    user: User,
    data: {
      name: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      storageKey: string;
      checksum: string;
      description?: string;
      folderId?: string | null;
      documentTypeId?: string | null;
      ownerId?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Document {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId!;

    const doc = documentStore.createDocumentRecord(orgId, user.id, data);

    store.recordAuditLog(
      orgId,
      user.id,
      'document.created',
      'Document',
      doc.id,
      { name: doc.name, folderId: doc.folderId, documentTypeId: doc.documentTypeId }
    );

    return doc;
  }

  public updateDocument(
    user: User,
    documentId: string,
    data: {
      name?: string;
      description?: string | null;
      documentTypeId?: string | null;
      ownerId?: string;
      status?: DocumentStatus;
    }
  ): Document {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const updated = documentStore.updateDocument(orgId, documentId, data);

    store.recordAuditLog(
      orgId,
      user.id,
      'document.updated',
      'Document',
      documentId,
      data
    );

    return updated;
  }

  public moveDocument(user: User, documentId: string, targetFolderId: string | null): Document {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const updated = documentStore.moveDocument(orgId, documentId, targetFolderId);

    store.recordAuditLog(
      orgId,
      user.id,
      'document.moved',
      'Document',
      documentId,
      { targetFolderId }
    );

    return updated;
  }

  public copyDocument(
    user: User,
    documentId: string,
    newName?: string,
    targetFolderId?: string | null
  ): Document {
    return this.copyDocumentRecord(user, documentId, targetFolderId, newName);
  }

  public copyDocumentRecord(
    user: User,
    documentId: string,
    targetFolderId?: string | null,
    newName?: string
  ): Document {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId!;

    const copy = documentStore.copyDocumentRecord(orgId, documentId, user.id, targetFolderId, newName);

    store.recordAuditLog(
      orgId,
      user.id,
      'document.copied',
      'Document',
      copy.id,
      { sourceDocumentId: documentId, name: copy.name }
    );

    return copy;
  }

  public deleteDocument(user: User, documentId: string): void {
    rbacService.assertPermission(user, 'documents.delete');
    const orgId = user.organizationId!;

    documentStore.deleteDocument(orgId, documentId);

    store.recordAuditLog(
      orgId,
      user.id,
      'document.deleted',
      'Document',
      documentId
    );
  }

  // --------------------------------------------------------------------
  // Document Versions
  // --------------------------------------------------------------------

  public getDocumentVersions(user: User, documentId: string): DocumentVersion[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getDocumentVersions(orgId, documentId);
  }

  public createDocumentVersion(
    user: User,
    documentId: string,
    data: {
      fileName: string;
      mimeType: string;
      fileSize: number;
      storageKey: string;
      checksum: string;
      changeDescription?: string;
    }
  ): DocumentVersion {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const newVersion = documentStore.createDocumentVersion(orgId, documentId, user.id, data);

    store.recordAuditLog(
      orgId,
      user.id,
      'document_version.created',
      'DocumentVersion',
      newVersion.id,
      { documentId, versionNumber: newVersion.versionNumber }
    );

    return newVersion;
  }

  public restoreDocumentVersion(
    user: User,
    documentId: string,
    versionNumber: number
  ): DocumentVersion {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const restored = documentStore.restoreDocumentVersion(orgId, documentId, versionNumber, user.id);

    store.recordAuditLog(
      orgId,
      user.id,
      'document_version.restored',
      'DocumentVersion',
      restored.id,
      { documentId, restoredFromVersion: versionNumber, newVersionNumber: restored.versionNumber }
    );

    return restored;
  }

  // --------------------------------------------------------------------
  // Document Types & Field Definitions
  // --------------------------------------------------------------------

  public getDocumentTypes(user: User): DocumentType[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getDocumentTypes(orgId);
  }

  public getDocumentTypeById(user: User, id: string): DocumentType {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    const dt = documentStore.getDocumentTypeById(orgId, id);
    if (!dt) throw new NotFoundError('Document type');
    return dt;
  }

  public createDocumentType(
    user: User,
    nameOrData: string | { name: string; description?: string },
    descriptionParam?: string
  ): DocumentType {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId!;

    const name = typeof nameOrData === 'string' ? nameOrData : nameOrData.name;
    const description = typeof nameOrData === 'string' ? descriptionParam : nameOrData.description;

    const dt = documentStore.createDocumentType(orgId, name, description);

    store.recordAuditLog(
      orgId,
      user.id,
      'document_type.created',
      'DocumentType',
      dt.id,
      { name: dt.name }
    );

    return dt;
  }

  public addFieldDefinition(
    user: User,
    documentTypeId: string,
    data: {
      name: string;
      key: string;
      type: DocumentFieldDefinition['type'];
      required?: boolean;
      options?: string[] | null;
    }
  ): DocumentFieldDefinition {
    return this.createFieldDefinition(user, documentTypeId, data);
  }

  public createFieldDefinition(
    user: User,
    documentTypeId: string,
    data: {
      name: string;
      key: string;
      type: DocumentFieldDefinition['type'];
      required?: boolean;
      options?: string[] | null;
    }
  ): DocumentFieldDefinition {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const field = documentStore.createFieldDefinition(orgId, documentTypeId, data);

    store.recordAuditLog(
      orgId,
      user.id,
      'document_field.created',
      'DocumentFieldDefinition',
      field.id,
      { documentTypeId, key: field.key, type: field.type }
    );

    return field;
  }

  // --------------------------------------------------------------------
  // Tags
  // --------------------------------------------------------------------

  public getTags(user: User): Tag[] {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getTags(orgId);
  }

  public createTag(user: User, name: string): Tag {
    rbacService.assertPermission(user, 'documents.create');
    const orgId = user.organizationId!;

    const tag = documentStore.createTag(orgId, name);

    store.recordAuditLog(
      orgId,
      user.id,
      'tag.created',
      'Tag',
      tag.id,
      { name: tag.name }
    );

    return tag;
  }

  public assignTag(user: User, documentId: string, tagId: string): Document {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    documentStore.assignTag(orgId, documentId, tagId);
    const doc = documentStore.getDocumentById(orgId, documentId)!;

    store.recordAuditLog(
      orgId,
      user.id,
      'tag.assigned',
      'DocumentTag',
      `${documentId}:${tagId}`,
      { documentId, tagId }
    );

    return doc;
  }

  public removeTag(user: User, documentId: string, tagId: string): void {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    documentStore.removeTag(orgId, documentId, tagId);

    store.recordAuditLog(
      orgId,
      user.id,
      'tag.removed',
      'DocumentTag',
      `${documentId}:${tagId}`,
      { documentId, tagId }
    );
  }

  // --------------------------------------------------------------------
  // Document Metadata
  // --------------------------------------------------------------------

  public getDocumentMetadata(user: User, documentId: string): Record<string, unknown> {
    rbacService.assertPermission(user, 'documents.read');
    const orgId = user.organizationId!;
    return documentStore.getDocumentMetadata(orgId, documentId);
  }

  public setDocumentMetadata(
    user: User,
    documentId: string,
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    rbacService.assertPermission(user, 'documents.update');
    const orgId = user.organizationId!;

    const validated = documentStore.setDocumentMetadata(orgId, documentId, metadata);

    store.recordAuditLog(
      orgId,
      user.id,
      'document_metadata.updated',
      'DocumentFieldValue',
      documentId,
      { keys: Object.keys(validated) }
    );

    return validated;
  }
}

export const documentFolderService = new DocumentFolderService();
