// DocuFlow AI - Document & Folder Multi-Tenant Data Store Extension
import { randomUUID } from 'node:crypto';
import type {
  Document,
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentStatus,
  DocumentType,
  DocumentVersion,
  Folder,
  Tag,
  User,
} from '../types/index.ts';
import { ConflictError, NotFoundError, TenantViolationError, ValidationError } from '../lib/errors.ts';
import { validateFieldValue, validateMetadataRecord } from '../modules/documents/metadata-validator.ts';

export class DocumentStoreExtension {
  private folders: Map<string, Folder> = new Map();
  private documents: Map<string, Document> = new Map();
  private documentVersions: Map<string, DocumentVersion[]> = new Map(); // documentId -> versions[]
  private documentTypes: Map<string, DocumentType> = new Map();
  private fieldDefinitions: Map<string, DocumentFieldDefinition> = new Map();
  private fieldValues: Map<string, DocumentFieldValue> = new Map(); // documentId:fieldDefId -> DocumentFieldValue
  private tags: Map<string, Tag> = new Map();
  private documentTags: Map<string, Set<string>> = new Map(); // documentId -> Set of tagIds

  private generateId(prefix?: string): string {
    const raw = randomUUID();
    return prefix ? `${prefix}-${raw.substring(0, 8)}` : raw;
  }

  // --------------------------------------------------------------------
  // Seed Phase 2A Defaults for Demo Organization
  // --------------------------------------------------------------------
  public seedPhase2Defaults(demoOrgId: string, adminUserId: string) {
    // 1. Folders: Finance, HR, Legal, IT, Projects
    const folderNames = ['Finance', 'HR', 'Legal', 'IT', 'Projects'];
    const createdFolders: Record<string, Folder> = {};

    folderNames.forEach((name) => {
      const folderId = this.generateId('folder');
      const folder: Folder = {
        id: folderId,
        organizationId: demoOrgId,
        parentFolderId: null,
        name,
        createdById: adminUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      this.folders.set(folderId, folder);
      createdFolders[name] = folder;
    });

    // Subfolder in Projects: "Active Initiatives"
    if (createdFolders['Projects']) {
      const subId = this.generateId('folder');
      const subfolder: Folder = {
        id: subId,
        organizationId: demoOrgId,
        parentFolderId: createdFolders['Projects'].id,
        name: 'Active Initiatives',
        createdById: adminUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      this.folders.set(subId, subfolder);
    }

    // 2. Document Types: Invoice, Contract, Purchase Order, Employee Document, Receipt
    const docTypesData = [
      {
        name: 'Invoice',
        description: 'Vendor invoices and billing notices',
        fields: [
          { name: 'Invoice Number', key: 'invoiceNumber', type: 'TEXT' as const, required: true },
          { name: 'Due Date', key: 'dueDate', type: 'DATE' as const, required: true },
          { name: 'Total Amount', key: 'totalAmount', type: 'NUMBER' as const, required: true },
          { name: 'Currency', key: 'currency', type: 'SELECT' as const, required: true, options: ['USD', 'EUR', 'GBP', 'CAD'] },
        ],
      },
      {
        name: 'Contract',
        description: 'Legal agreements, NDAs, and master service agreements',
        fields: [
          { name: 'Contract Title', key: 'contractTitle', type: 'TEXT' as const, required: true },
          { name: 'Counterparty', key: 'counterparty', type: 'TEXT' as const, required: true },
          { name: 'Effective Date', key: 'effectiveDate', type: 'DATE' as const, required: true },
          { name: 'Auto Renew', key: 'autoRenew', type: 'BOOLEAN' as const, required: false },
        ],
      },
      {
        name: 'Purchase Order',
        description: 'Approved requisitions and formal purchasing orders',
        fields: [
          { name: 'PO Number', key: 'poNumber', type: 'TEXT' as const, required: true },
          { name: 'Vendor Name', key: 'vendorName', type: 'TEXT' as const, required: true },
          { name: 'Amount', key: 'amount', type: 'NUMBER' as const, required: true },
        ],
      },
      {
        name: 'Employee Document',
        description: 'Employment records, offer letters, and reviews',
        fields: [
          { name: 'Employee Name', key: 'employeeName', type: 'TEXT' as const, required: true },
          { name: 'Department', key: 'department', type: 'SELECT' as const, required: false, options: ['Finance', 'HR', 'IT', 'Legal', 'Operations'] },
          { name: 'Document Category', key: 'docCategory', type: 'SELECT' as const, required: true, options: ['Offer Letter', 'NDA', 'Performance Review', 'Tax Form'] },
        ],
      },
      {
        name: 'Receipt',
        description: 'Expense claims and payment receipts',
        fields: [
          { name: 'Merchant', key: 'merchant', type: 'TEXT' as const, required: true },
          { name: 'Receipt Date', key: 'receiptDate', type: 'DATE' as const, required: true },
          { name: 'Total Expense', key: 'totalExpense', type: 'NUMBER' as const, required: true },
        ],
      },
    ];

    const createdDocTypes: Record<string, DocumentType> = {};
    docTypesData.forEach((dtData) => {
      const dtId = this.generateId('doctype');
      const docType: DocumentType = {
        id: dtId,
        organizationId: demoOrgId,
        name: dtData.name,
        description: dtData.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.documentTypes.set(dtId, docType);
      createdDocTypes[dtData.name] = docType;

      // Seed field definitions
      dtData.fields.forEach((f) => {
        const fieldId = this.generateId('field');
        const fieldDef: DocumentFieldDefinition = {
          id: fieldId,
          organizationId: demoOrgId,
          documentTypeId: dtId,
          name: f.name,
          key: f.key,
          type: f.type,
          required: f.required,
          options: f.options || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.fieldDefinitions.set(fieldId, fieldDef);
      });
    });

    // 3. Tags: Urgent, Confidential, Finance, Legal, Internal
    const tagNames = ['Urgent', 'Confidential', 'Finance', 'Legal', 'Internal'];
    const createdTags: Record<string, Tag> = {};
    tagNames.forEach((tName) => {
      const tagId = this.generateId('tag');
      const tag: Tag = {
        id: tagId,
        organizationId: demoOrgId,
        name: tName,
        createdAt: new Date().toISOString(),
      };
      this.tags.set(tagId, tag);
      createdTags[tName] = tag;
    });

    // 4. Seed 2 initial sample documents with versions and metadata for Demo Corp
    if (createdFolders['Finance'] && createdDocTypes['Invoice']) {
      const doc1Id = this.generateId('doc');
      const doc1: Document = {
        id: doc1Id,
        organizationId: demoOrgId,
        folderId: createdFolders['Finance'].id,
        documentTypeId: createdDocTypes['Invoice'].id,
        name: 'Q3 Vendor Cloud Services Invoice',
        originalFileName: 'INV-2026-Q3-CloudOps.pdf',
        mimeType: 'application/pdf',
        fileSize: 245760,
        storageKey: `org-${demoOrgId}/docs/${doc1Id}/v1-INV-2026-Q3-CloudOps.pdf`,
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        description: 'Quarterly enterprise infrastructure invoice',
        status: 'ACTIVE',
        createdById: adminUserId,
        ownerId: adminUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      this.documents.set(doc1Id, doc1);

      // Version 1
      const v1: DocumentVersion = {
        id: this.generateId('ver'),
        documentId: doc1Id,
        versionNumber: 1,
        storageKey: doc1.storageKey,
        fileName: doc1.originalFileName,
        mimeType: doc1.mimeType,
        fileSize: doc1.fileSize,
        checksum: doc1.checksum,
        uploadedById: adminUserId,
        changeDescription: 'Initial upload of Q3 invoice',
        createdAt: new Date().toISOString(),
      };
      this.documentVersions.set(doc1Id, [v1]);

      // Assign tags: Urgent, Finance
      const doc1Tags = new Set<string>();
      if (createdTags['Urgent']) doc1Tags.add(createdTags['Urgent'].id);
      if (createdTags['Finance']) doc1Tags.add(createdTags['Finance'].id);
      this.documentTags.set(doc1Id, doc1Tags);
    }
  }

  // --------------------------------------------------------------------
  // Folder Operations
  // --------------------------------------------------------------------

  public getFolderById(organizationId: string, folderId: string): Folder | null {
    const folder = this.folders.get(folderId);
    if (!folder || folder.organizationId !== organizationId || folder.deletedAt !== null) {
      return null;
    }
    return folder;
  }

  public getFoldersByOrganization(organizationId: string, parentFolderId?: string | null): Folder[] {
    return Array.from(this.folders.values()).filter((f) => {
      if (f.organizationId !== organizationId || f.deletedAt !== null) return false;
      if (parentFolderId !== undefined) {
        return f.parentFolderId === parentFolderId;
      }
      return true;
    });
  }

  public createFolder(
    organizationId: string,
    name: string,
    createdById: string,
    parentFolderId?: string | null
  ): Folder {
    const parentId = parentFolderId || null;

    // Verify parent exists and belongs to this organization
    if (parentId) {
      const parent = this.getFolderById(organizationId, parentId);
      if (!parent) {
        throw new NotFoundError(`Parent folder not found in organization`);
      }
    }

    // Check duplicate folder names within same parent in this organization
    const existing = Array.from(this.folders.values()).find(
      (f) =>
        f.organizationId === organizationId &&
        f.parentFolderId === parentId &&
        f.deletedAt === null &&
        f.name.toLowerCase() === name.toLowerCase().trim()
    );

    if (existing) {
      throw new ConflictError(
        `A folder named "${name.trim()}" already exists in the destination directory`
      );
    }

    const folderId = this.generateId('folder');
    const newFolder: Folder = {
      id: folderId,
      organizationId,
      parentFolderId: parentId,
      name: name.trim(),
      createdById,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    this.folders.set(folderId, newFolder);
    return newFolder;
  }

  public renameFolder(organizationId: string, folderId: string, newName: string): Folder {
    const folder = this.getFolderById(organizationId, folderId);
    if (!folder) {
      throw new NotFoundError('Folder');
    }

    const trimmedName = newName.trim();
    if (folder.name.toLowerCase() === trimmedName.toLowerCase()) {
      return folder;
    }

    // Check duplicate name under same parent
    const duplicate = Array.from(this.folders.values()).find(
      (f) =>
        f.id !== folderId &&
        f.organizationId === organizationId &&
        f.parentFolderId === folder.parentFolderId &&
        f.deletedAt === null &&
        f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      throw new ConflictError(`A folder named "${trimmedName}" already exists in this folder`);
    }

    folder.name = trimmedName;
    folder.updatedAt = new Date().toISOString();
    return folder;
  }

  public moveFolder(organizationId: string, folderId: string, targetParentFolderId: string | null): Folder {
    const folder = this.getFolderById(organizationId, folderId);
    if (!folder) {
      throw new NotFoundError('Folder');
    }

    // Prevent folder inside itself
    if (targetParentFolderId === folderId) {
      throw new ValidationError('Cannot move a folder inside itself');
    }

    if (targetParentFolderId) {
      const targetParent = this.getFolderById(organizationId, targetParentFolderId);
      if (!targetParent) {
        throw new NotFoundError('Target destination folder');
      }

      // Prevent folder inside any of its descendants
      let currentCheckId: string | null = targetParentFolderId;
      while (currentCheckId) {
        if (currentCheckId === folderId) {
          throw new ValidationError('Cannot move a folder inside one of its own descendants');
        }
        const parent = this.folders.get(currentCheckId);
        currentCheckId = parent ? parent.parentFolderId : null;
      }
    }

    // Check duplicate folder names in the destination parent
    const duplicate = Array.from(this.folders.values()).find(
      (f) =>
        f.id !== folderId &&
        f.organizationId === organizationId &&
        f.parentFolderId === targetParentFolderId &&
        f.deletedAt === null &&
        f.name.toLowerCase() === folder.name.toLowerCase()
    );

    if (duplicate) {
      throw new ConflictError(`A folder named "${folder.name}" already exists in the destination folder`);
    }

    folder.parentFolderId = targetParentFolderId;
    folder.updatedAt = new Date().toISOString();
    return folder;
  }

  public getFolderPath(organizationId: string, folderId: string): Folder[] {
    const path: Folder[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = this.getFolderById(organizationId, currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.parentFolderId;
    }

    return path;
  }

  public deleteFolder(organizationId: string, folderId: string): void {
    const folder = this.getFolderById(organizationId, folderId);
    if (!folder) {
      throw new NotFoundError('Folder');
    }

    const now = new Date().toISOString();

    // Soft delete recursively folder and all child folders and documents
    const cascadeDelete = (fId: string) => {
      const f = this.folders.get(fId);
      if (f && f.organizationId === organizationId) {
        f.deletedAt = now;
        f.updatedAt = now;

        // Cascade to child folders
        Array.from(this.folders.values())
          .filter((child) => child.organizationId === organizationId && child.parentFolderId === fId && child.deletedAt === null)
          .forEach((child) => cascadeDelete(child.id));

        // Cascade to documents inside this folder
        Array.from(this.documents.values())
          .filter((doc) => doc.organizationId === organizationId && doc.folderId === fId && doc.deletedAt === null)
          .forEach((doc) => {
            doc.deletedAt = now;
            doc.status = 'DELETED';
            doc.updatedAt = now;
          });
      }
    };

    cascadeDelete(folderId);
  }

  // --------------------------------------------------------------------
  // Document Types & Field Definitions
  // --------------------------------------------------------------------

  public getDocumentTypes(organizationId: string): DocumentType[] {
    const types = Array.from(this.documentTypes.values()).filter((dt) => dt.organizationId === organizationId);
    return types.map((dt) => ({
      ...dt,
      fields: this.getFieldDefinitions(organizationId, dt.id),
    }));
  }

  public getDocumentTypeById(organizationId: string, id: string): DocumentType | null {
    const dt = this.documentTypes.get(id);
    if (!dt || dt.organizationId !== organizationId) return null;
    return {
      ...dt,
      fields: this.getFieldDefinitions(organizationId, dt.id),
    };
  }

  public createDocumentType(organizationId: string, name: string, description?: string): DocumentType {
    const existing = Array.from(this.documentTypes.values()).find(
      (dt) => dt.organizationId === organizationId && dt.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      throw new ConflictError(`Document type "${name.trim()}" already exists`);
    }

    const id = this.generateId('doctype');
    const docType: DocumentType = {
      id,
      organizationId,
      name: name.trim(),
      description: description || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.documentTypes.set(id, docType);
    return { ...docType, fields: [] };
  }

  public getFieldDefinitions(organizationId: string, documentTypeId: string): DocumentFieldDefinition[] {
    return Array.from(this.fieldDefinitions.values()).filter(
      (fd) => fd.organizationId === organizationId && fd.documentTypeId === documentTypeId
    );
  }

  public createFieldDefinition(
    organizationId: string,
    documentTypeId: string,
    data: {
      name: string;
      key: string;
      type: DocumentFieldDefinition['type'];
      required?: boolean;
      options?: string[] | null;
    }
  ): DocumentFieldDefinition {
    const docType = this.getDocumentTypeById(organizationId, documentTypeId);
    if (!docType) {
      throw new NotFoundError('Document type');
    }

    const existing = Array.from(this.fieldDefinitions.values()).find(
      (fd) => fd.documentTypeId === documentTypeId && fd.key.toLowerCase() === data.key.trim().toLowerCase()
    );
    if (existing) {
      throw new ConflictError(`Field key "${data.key.trim()}" already exists for this document type`);
    }

    const id = this.generateId('field');
    const fieldDef: DocumentFieldDefinition = {
      id,
      organizationId,
      documentTypeId,
      name: data.name.trim(),
      key: data.key.trim(),
      type: data.type,
      required: Boolean(data.required),
      options: data.options || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.fieldDefinitions.set(id, fieldDef);
    return fieldDef;
  }

  // --------------------------------------------------------------------
  // Tags
  // --------------------------------------------------------------------

  public getTags(organizationId: string): Tag[] {
    return Array.from(this.tags.values()).filter((t) => t.organizationId === organizationId);
  }

  public createTag(organizationId: string, name: string): Tag {
    const existing = Array.from(this.tags.values()).find(
      (t) => t.organizationId === organizationId && t.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      return existing; // Idempotent or throw ConflictError; let's return existing
    }

    const id = this.generateId('tag');
    const tag: Tag = {
      id,
      organizationId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    this.tags.set(id, tag);
    return tag;
  }

  public assignTag(organizationId: string, documentId: string, tagId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const tag = this.tags.get(tagId);
    if (!tag || tag.organizationId !== organizationId) {
      throw new NotFoundError('Tag');
    }

    if (!this.documentTags.has(documentId)) {
      this.documentTags.set(documentId, new Set());
    }
    this.documentTags.get(documentId)!.add(tagId);
  }

  public removeTag(organizationId: string, documentId: string, tagId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const set = this.documentTags.get(documentId);
    if (set) {
      set.delete(tagId);
    }
  }

  // --------------------------------------------------------------------
  // Document Operations & Versioning
  // --------------------------------------------------------------------

  public getDocumentById(organizationId: string, id: string): Document | null {
    const doc = this.documents.get(id);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      return null;
    }
    return this.hydrateDocument(doc);
  }

  public getDocuments(
    organizationId: string,
    filter?: {
      folderId?: string | null;
      documentTypeId?: string;
      status?: DocumentStatus;
      ownerId?: string;
      search?: string;
    }
  ): Document[] {
    const list = Array.from(this.documents.values()).filter((doc) => {
      if (doc.organizationId !== organizationId || doc.deletedAt !== null) return false;

      if (filter) {
        if (filter.folderId !== undefined && doc.folderId !== filter.folderId) return false;
        if (filter.documentTypeId && doc.documentTypeId !== filter.documentTypeId) return false;
        if (filter.status && doc.status !== filter.status) return false;
        if (filter.ownerId && doc.ownerId !== filter.ownerId) return false;
        if (filter.search) {
          const s = filter.search.toLowerCase();
          const match =
            doc.name.toLowerCase().includes(s) ||
            doc.originalFileName.toLowerCase().includes(s) ||
            (doc.description && doc.description.toLowerCase().includes(s));
          if (!match) return false;
        }
      }

      return true;
    });

    return list.map((d) => this.hydrateDocument(d));
  }

  public createDocumentRecord(
    organizationId: string,
    createdById: string,
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
    // Validate folder
    if (data.folderId) {
      const folder = this.getFolderById(organizationId, data.folderId);
      if (!folder) {
        throw new NotFoundError('Specified destination folder');
      }
    }

    // Validate Document Type
    if (data.documentTypeId) {
      const dt = this.getDocumentTypeById(organizationId, data.documentTypeId);
      if (!dt) {
        throw new NotFoundError('Specified document type');
      }
    }

    const docId = this.generateId('doc');
    const owner = data.ownerId || createdById;

    const doc: Document = {
      id: docId,
      organizationId,
      folderId: data.folderId || null,
      documentTypeId: data.documentTypeId || null,
      name: data.name.trim(),
      originalFileName: data.originalFileName.trim(),
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      storageKey: data.storageKey,
      checksum: data.checksum,
      description: data.description || null,
      status: 'ACTIVE',
      createdById,
      ownerId: owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    this.documents.set(docId, doc);

    // Create Initial Version 1
    const v1: DocumentVersion = {
      id: this.generateId('ver'),
      documentId: docId,
      versionNumber: 1,
      storageKey: doc.storageKey,
      fileName: doc.originalFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      checksum: doc.checksum,
      uploadedById: createdById,
      changeDescription: 'Initial document upload',
      createdAt: doc.createdAt,
    };
    this.documentVersions.set(docId, [v1]);

    // Attach tags if passed
    if (data.tags && data.tags.length > 0) {
      const tagSet = new Set<string>();
      data.tags.forEach((tagInput) => {
        // Find existing tag by name or ID, or create
        let tag = this.tags.get(tagInput);
        if (!tag || tag.organizationId !== organizationId) {
          tag = Array.from(this.tags.values()).find(
            (t) => t.organizationId === organizationId && t.name.toLowerCase() === tagInput.toLowerCase()
          );
        }
        if (!tag) {
          tag = this.createTag(organizationId, tagInput);
        }
        tagSet.add(tag.id);
      });
      this.documentTags.set(docId, tagSet);
    }

    // Set metadata if provided
    if (data.metadata && Object.keys(data.metadata).length > 0) {
      this.setDocumentMetadata(organizationId, docId, data.metadata);
    }

    return this.hydrateDocument(doc);
  }

  public updateDocument(
    organizationId: string,
    documentId: string,
    data: {
      name?: string;
      description?: string | null;
      documentTypeId?: string | null;
      ownerId?: string;
      status?: DocumentStatus;
    }
  ): Document {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    if (data.documentTypeId !== undefined && data.documentTypeId !== null) {
      const dt = this.getDocumentTypeById(organizationId, data.documentTypeId);
      if (!dt) throw new NotFoundError('Document type');
      doc.documentTypeId = data.documentTypeId;
    } else if (data.documentTypeId === null) {
      doc.documentTypeId = null;
    }

    if (data.name !== undefined) doc.name = data.name.trim();
    if (data.description !== undefined) doc.description = data.description;
    if (data.ownerId !== undefined) doc.ownerId = data.ownerId;
    if (data.status !== undefined) doc.status = data.status;

    doc.updatedAt = new Date().toISOString();
    return this.hydrateDocument(doc);
  }

  public moveDocument(organizationId: string, documentId: string, targetFolderId: string | null): Document {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    if (targetFolderId) {
      const folder = this.getFolderById(organizationId, targetFolderId);
      if (!folder) throw new NotFoundError('Destination folder');
    }

    doc.folderId = targetFolderId;
    doc.updatedAt = new Date().toISOString();
    return this.hydrateDocument(doc);
  }

  public copyDocumentRecord(
    organizationId: string,
    documentId: string,
    actorUserId: string,
    targetFolderId?: string | null,
    newName?: string
  ): Document {
    const source = this.getDocumentById(organizationId, documentId);
    if (!source) {
      throw new NotFoundError('Source document');
    }

    const folderId = targetFolderId !== undefined ? targetFolderId : source.folderId;
    if (folderId) {
      const f = this.getFolderById(organizationId, folderId);
      if (!f) throw new NotFoundError('Destination folder');
    }

    const copyName = newName ? newName.trim() : `Copy of ${source.name}`;

    return this.createDocumentRecord(organizationId, actorUserId, {
      name: copyName,
      originalFileName: source.originalFileName,
      mimeType: source.mimeType,
      fileSize: source.fileSize,
      storageKey: source.storageKey,
      checksum: source.checksum,
      description: source.description || undefined,
      folderId,
      documentTypeId: source.documentTypeId,
      ownerId: actorUserId,
      tags: source.tags?.map((t) => t.name),
      metadata: source.metadata,
    });
  }

  public deleteDocument(organizationId: string, documentId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const now = new Date().toISOString();
    doc.deletedAt = now;
    doc.status = 'DELETED';
    doc.updatedAt = now;
  }

  // --------------------------------------------------------------------
  // Document Versions
  // --------------------------------------------------------------------

  public findDocumentByChecksum(organizationId: string, checksum: string): Document | null {
    const doc = Array.from(this.documents.values()).find(
      (d) => d.organizationId === organizationId && d.checksum === checksum && d.deletedAt === null
    );
    return doc ? this.hydrateDocument(doc) : null;
  }

  public getDocumentVersions(organizationId: string, documentId: string): DocumentVersion[] {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const versions = this.documentVersions.get(documentId) || [];
    // Sort descending by version number
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  }

  public getDocumentVersion(
    organizationId: string,
    documentId: string,
    versionNumber: number
  ): DocumentVersion | null {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const versions = this.documentVersions.get(documentId) || [];
    return versions.find((v) => v.versionNumber === versionNumber) || null;
  }

  public createDocumentVersion(
    organizationId: string,
    documentId: string,
    uploadedById: string,
    data: {
      fileName: string;
      mimeType: string;
      fileSize: number;
      storageKey: string;
      checksum: string;
      changeDescription?: string;
    }
  ): DocumentVersion {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const versions = this.documentVersions.get(documentId) || [];
    const nextVersionNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.versionNumber)) + 1 : 1;

    const newVersion: DocumentVersion = {
      id: this.generateId('ver'),
      documentId,
      versionNumber: nextVersionNumber,
      storageKey: data.storageKey,
      fileName: data.fileName.trim(),
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      checksum: data.checksum,
      uploadedById,
      changeDescription: data.changeDescription || null,
      createdAt: new Date().toISOString(),
    };

    versions.push(newVersion);
    this.documentVersions.set(documentId, versions);

    // Update document's pointer to the latest version files
    doc.originalFileName = newVersion.fileName;
    doc.mimeType = newVersion.mimeType;
    doc.fileSize = newVersion.fileSize;
    doc.storageKey = newVersion.storageKey;
    doc.checksum = newVersion.checksum;
    doc.updatedAt = new Date().toISOString();

    return newVersion;
  }

  public restoreDocumentVersion(
    organizationId: string,
    documentId: string,
    versionNumber: number,
    actorUserId: string
  ): DocumentVersion {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const versions = this.documentVersions.get(documentId) || [];
    const targetVersion = versions.find((v) => v.versionNumber === versionNumber);
    if (!targetVersion) {
      throw new NotFoundError(`Version ${versionNumber}`);
    }

    // Creating a new version from the restored version preserves immutable history
    return this.createDocumentVersion(organizationId, documentId, actorUserId, {
      fileName: targetVersion.fileName,
      mimeType: targetVersion.mimeType,
      fileSize: targetVersion.fileSize,
      storageKey: targetVersion.storageKey,
      checksum: targetVersion.checksum,
      changeDescription: `Restored from version ${versionNumber}`,
    });
  }

  // --------------------------------------------------------------------
  // Metadata Operations
  // --------------------------------------------------------------------

  public getDocumentMetadata(organizationId: string, documentId: string): Record<string, unknown> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const result: Record<string, unknown> = {};
    for (const [key, fv] of this.fieldValues.entries()) {
      if (key.startsWith(`${documentId}:`)) {
        const fieldDef = this.fieldDefinitions.get(fv.fieldDefinitionId);
        if (fieldDef) {
          result[fieldDef.key] = fv.value;
        }
      }
    }
    return result;
  }

  public setDocumentMetadata(
    organizationId: string,
    documentId: string,
    metadataInput: Record<string, unknown>
  ): Record<string, unknown> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    // Fetch field definitions for this document type
    const fieldDefs = doc.documentTypeId
      ? this.getFieldDefinitions(organizationId, doc.documentTypeId)
      : [];

    // Validate metadata against document type field definitions
    const validated = validateMetadataRecord(fieldDefs, metadataInput);

    // Save field values
    for (const fieldDef of fieldDefs) {
      if (validated[fieldDef.key] !== undefined) {
        const compositeKey = `${documentId}:${fieldDef.id}`;
        const existingVal = this.fieldValues.get(compositeKey);
        if (existingVal) {
          existingVal.value = validated[fieldDef.key];
          existingVal.updatedAt = new Date().toISOString();
        } else {
          this.fieldValues.set(compositeKey, {
            id: this.generateId('fv'),
            documentId,
            fieldDefinitionId: fieldDef.id,
            value: validated[fieldDef.key],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    doc.updatedAt = new Date().toISOString();
    return validated;
  }

  // --------------------------------------------------------------------
  // Helper: Hydrate document with relations
  // --------------------------------------------------------------------
  private hydrateDocument(doc: Document): Document {
    const folder = doc.folderId ? this.folders.get(doc.folderId) || null : null;
    const documentType = doc.documentTypeId ? this.documentTypes.get(doc.documentTypeId) || null : null;

    const tagIds = this.documentTags.get(doc.id) || new Set();
    const tags = Array.from(tagIds)
      .map((tId) => this.tags.get(tId))
      .filter((t): t is Tag => Boolean(t));

    const versions = this.documentVersions.get(doc.id) || [];
    const metadata = this.getDocumentMetadata(doc.organizationId, doc.id);

    return {
      ...doc,
      folder,
      documentType,
      tags,
      versions,
      metadata,
    };
  }
}

export const documentStore = new DocumentStoreExtension();
