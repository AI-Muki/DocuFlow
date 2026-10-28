// DocuFlow AI - Document & Folder Multi-Tenant Data Store Extension
import { randomUUID } from 'node:crypto';
import type {
  Document,
  DocumentComment,
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentFilterOptions,
  DocumentSortBy,
  DocumentSortOrder,
  DocumentStatus,
  DocumentType,
  DocumentVersion,
  Folder,
  PaginatedDocuments,
  PaginationMeta,
  Tag,
  User,
} from '../types/index.ts';
import { ConflictError, ForbiddenError, NotFoundError, TenantViolationError, ValidationError } from '../lib/errors.ts';
import { validateFieldValue, validateMetadataRecord } from '../modules/documents/metadata-validator.ts';
import { store } from './store.ts';

export class DocumentStoreExtension {
  private folders: Map<string, Folder> = new Map();
  private documents: Map<string, Document> = new Map();
  private orgDocIndex: Map<string, Set<string>> = new Map(); // organizationId -> Set of documentIds
  private documentVersions: Map<string, DocumentVersion[]> = new Map(); // documentId -> versions[]
  private documentTypes: Map<string, DocumentType> = new Map();
  private fieldDefinitions: Map<string, DocumentFieldDefinition> = new Map();
  private fieldValues: Map<string, DocumentFieldValue> = new Map(); // documentId:fieldDefId -> DocumentFieldValue
  private tags: Map<string, Tag> = new Map();
  private documentTags: Map<string, Set<string>> = new Map(); // documentId -> Set of tagIds
  private documentFavorites: Map<string, Set<string>> = new Map(); // documentId -> Set of userIds
  private documentComments: Map<string, DocumentComment[]> = new Map(); // documentId -> DocumentComment[]

  private indexDocument(organizationId: string, docId: string): void {
    if (!this.orgDocIndex.has(organizationId)) {
      this.orgDocIndex.set(organizationId, new Set());
    }
    this.orgDocIndex.get(organizationId)!.add(docId);
  }

  private unindexDocument(organizationId: string, docId: string): void {
    this.orgDocIndex.get(organizationId)?.delete(docId);
  }

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
          { name: 'Invoice Number', key: 'invoiceNumber', type: 'TEXT' as const, required: true, order: 1 },
          { name: 'Supplier', key: 'supplier', type: 'TEXT' as const, required: true, order: 2 },
          { name: 'Invoice Date', key: 'invoiceDate', type: 'DATE' as const, required: true, order: 3 },
          { name: 'Due Date', key: 'dueDate', type: 'DATE' as const, required: true, order: 4 },
          { name: 'Amount', key: 'amount', type: 'NUMBER' as const, required: true, order: 5 },
          { name: 'Currency', key: 'currency', type: 'SELECT' as const, required: true, options: ['USD', 'EUR', 'GBP', 'CAD'], order: 6 },
        ],
      },
      {
        name: 'Contract',
        description: 'Legal agreements, NDAs, and master service agreements',
        fields: [
          { name: 'Contract Number', key: 'contractNumber', type: 'TEXT' as const, required: true, order: 1 },
          { name: 'Counterparty', key: 'counterparty', type: 'TEXT' as const, required: true, order: 2 },
          { name: 'Start Date', key: 'startDate', type: 'DATE' as const, required: true, order: 3 },
          { name: 'End Date', key: 'endDate', type: 'DATE' as const, required: true, order: 4 },
          { name: 'Contract Value', key: 'contractValue', type: 'NUMBER' as const, required: true, order: 5 },
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
      dtData.fields.forEach((f, idx) => {
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
          order: 'order' in f && typeof (f as { order?: number }).order === 'number' ? (f as { order: number }).order : idx + 1,
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
      this.indexDocument(demoOrgId, doc1Id);

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

  public updateDocumentType(
    organizationId: string,
    id: string,
    data: { name?: string; description?: string | null }
  ): DocumentType {
    const dt = this.documentTypes.get(id);
    if (!dt || dt.organizationId !== organizationId) {
      throw new NotFoundError('Document type');
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const existing = Array.from(this.documentTypes.values()).find(
        (t) => t.id !== id && t.organizationId === organizationId && t.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        throw new ConflictError(`Document type "${trimmed}" already exists`);
      }
      dt.name = trimmed;
    }

    if (data.description !== undefined) {
      dt.description = data.description;
    }

    dt.updatedAt = new Date().toISOString();
    return {
      ...dt,
      fields: this.getFieldDefinitions(organizationId, id),
    };
  }

  public deleteDocumentType(organizationId: string, id: string): void {
    const dt = this.documentTypes.get(id);
    if (!dt || dt.organizationId !== organizationId) {
      throw new NotFoundError('Document type');
    }

    // Safety check: is it in use by any non-deleted document?
    const inUseCount = Array.from(this.documents.values()).filter(
      (doc) => doc.organizationId === organizationId && doc.documentTypeId === id && doc.deletedAt === null
    ).length;

    if (inUseCount > 0) {
      throw new ConflictError(
        `Cannot delete document type "${dt.name}": it is currently assigned to ${inUseCount} document(s). Reclassify or delete those documents first.`
      );
    }

    // Delete field definitions for this type
    const fieldDefs = this.getFieldDefinitions(organizationId, id);
    fieldDefs.forEach((f) => {
      this.fieldDefinitions.delete(f.id);
    });

    this.documentTypes.delete(id);
  }

  public getFieldDefinitions(organizationId: string, documentTypeId: string): DocumentFieldDefinition[] {
    return Array.from(this.fieldDefinitions.values())
      .filter((fd) => fd.organizationId === organizationId && fd.documentTypeId === documentTypeId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
      order?: number;
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

    const currentFields = this.getFieldDefinitions(organizationId, documentTypeId);
    const order = data.order !== undefined ? data.order : currentFields.length + 1;

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
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.fieldDefinitions.set(id, fieldDef);
    return fieldDef;
  }

  public updateFieldDefinition(
    organizationId: string,
    documentTypeId: string,
    fieldId: string,
    data: {
      name?: string;
      type?: DocumentFieldDefinition['type'];
      required?: boolean;
      options?: string[] | null;
      order?: number;
    }
  ): DocumentFieldDefinition {
    const field = this.fieldDefinitions.get(fieldId);
    if (!field || field.organizationId !== organizationId || field.documentTypeId !== documentTypeId) {
      throw new NotFoundError('Field definition');
    }

    if (data.name !== undefined) field.name = data.name.trim();
    if (data.type !== undefined) field.type = data.type;
    if (data.required !== undefined) field.required = Boolean(data.required);
    if (data.options !== undefined) field.options = data.options;
    if (data.order !== undefined) field.order = data.order;
    field.updatedAt = new Date().toISOString();

    return field;
  }

  public deleteFieldDefinition(organizationId: string, documentTypeId: string, fieldId: string): void {
    const field = this.fieldDefinitions.get(fieldId);
    if (!field || field.organizationId !== organizationId || field.documentTypeId !== documentTypeId) {
      throw new NotFoundError('Field definition');
    }

    // Remove any saved field values for this field definition
    for (const [key, fv] of this.fieldValues.entries()) {
      if (fv.fieldDefinitionId === fieldId) {
        this.fieldValues.delete(key);
      }
    }

    this.fieldDefinitions.delete(fieldId);
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

  public deleteTag(organizationId: string, tagId: string): void {
    const tag = this.tags.get(tagId);
    if (!tag || tag.organizationId !== organizationId) {
      throw new NotFoundError('Tag');
    }

    // Remove tag from all documents in org
    for (const [docId, tagSet] of this.documentTags.entries()) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId) {
        tagSet.delete(tagId);
      }
    }

    this.tags.delete(tagId);
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

  public getDocumentById(organizationId: string, id: string, userId?: string, includeDeleted = false): Document | null {
    const doc = this.documents.get(id);
    if (!doc || doc.organizationId !== organizationId) {
      return null;
    }
    if (!includeDeleted && doc.deletedAt !== null) {
      return null;
    }
    return this.hydrateDocument(doc, userId);
  }

  public executeFilteredDocumentQuery(
    organizationId: string,
    filter?: DocumentFilterOptions
  ): PaginatedDocuments {
    // 1. Gather tenant candidate documents using orgDocIndex if available for fast O(1) lookup
    let candidateDocs: Document[];
    const tenantDocIds = this.orgDocIndex.get(organizationId);
    if (tenantDocIds !== undefined) {
      candidateDocs = [];
      for (const id of tenantDocIds) {
        const d = this.documents.get(id);
        if (d && d.organizationId === organizationId) {
          candidateDocs.push(d);
        }
      }
    } else {
      candidateDocs = Array.from(this.documents.values()).filter((d) => d.organizationId === organizationId);
    }

    // 2. Pre-cache search scores and term arrays if search query provided
    const searchScores = new Map<string, number>();
    const searchRaw = filter?.search ? filter.search.trim().toLowerCase() : '';
    const searchTokens = searchRaw ? searchRaw.split(/\s+/).filter(Boolean) : [];

    // Parse date boundaries
    const createdFromMs = filter?.createdFrom ? new Date(filter.createdFrom).getTime() : null;
    let createdToMs = filter?.createdTo ? new Date(filter.createdTo).getTime() : null;
    if (createdToMs !== null && filter?.createdTo && filter.createdTo.length === 10) {
      createdToMs += 86399999; // full end of day
    }

    const updatedFromMs = filter?.updatedFrom ? new Date(filter.updatedFrom).getTime() : null;
    let updatedToMs = filter?.updatedTo ? new Date(filter.updatedTo).getTime() : null;
    if (updatedToMs !== null && filter?.updatedTo && filter.updatedTo.length === 10) {
      updatedToMs += 86399999; // full end of day
    }

    // 3. Filter matching documents
    const matchingDocs = candidateDocs.filter((doc) => {
      // Trash vs Active view
      if (filter?.view === 'trash') {
        if (doc.deletedAt === null) return false;
      } else {
        if (doc.deletedAt !== null) return false;
      }

      // Favorites view
      if (filter?.view === 'favorites' && filter?.userId) {
        if (!this.isFavorite(doc.id, filter.userId)) return false;
      }

      // Folder filter
      if (
        filter?.folderId !== undefined &&
        filter?.view !== 'trash' &&
        filter?.view !== 'favorites' &&
        filter?.view !== 'recent'
      ) {
        if (doc.folderId !== filter.folderId) return false;
      }

      // Document Type filter
      if (filter?.documentTypeId) {
        if (doc.documentTypeId !== filter.documentTypeId) {
          const dt = doc.documentTypeId ? this.documentTypes.get(doc.documentTypeId) : null;
          if (!dt || dt.name.toLowerCase() !== filter.documentTypeId.toLowerCase()) {
            return false;
          }
        }
      }

      // Status filter
      if (filter?.status && doc.status !== filter.status) {
        return false;
      }

      // Owner filter
      if (filter?.ownerId) {
        if (doc.ownerId !== filter.ownerId && doc.createdById !== filter.ownerId) {
          const owner = store.findUserById(doc.ownerId);
          const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.toLowerCase() : '';
          const ownerEmail = owner ? owner.email.toLowerCase() : '';
          const target = filter.ownerId.toLowerCase();
          if (!ownerName.includes(target) && !ownerEmail.includes(target)) {
            return false;
          }
        }
      }

      // Single Tag filter by tagId
      if (filter?.tagId) {
        const docTags = this.documentTags.get(doc.id);
        if (!docTags || !docTags.has(filter.tagId)) return false;
      }

      // Single Tag filter by tag name or ID
      if (filter?.tag) {
        const docTags = this.documentTags.get(doc.id);
        if (!docTags || docTags.size === 0) return false;
        const matchTag = Array.from(docTags)
          .map((tId) => this.tags.get(tId))
          .find((t) => t && (t.id === filter.tag || t.name.toLowerCase() === filter.tag!.toLowerCase()));
        if (!matchTag) return false;
      }

      // Multiple tags filter (tagIds)
      if (filter?.tagIds && filter.tagIds.length > 0) {
        const docTags = this.documentTags.get(doc.id);
        if (!docTags || docTags.size === 0) return false;
        const hasMatch = filter.tagIds.some((tId) => docTags.has(tId));
        if (!hasMatch) return false;
      }

      // Created date range
      if (createdFromMs !== null && !isNaN(createdFromMs)) {
        if (new Date(doc.createdAt).getTime() < createdFromMs) return false;
      }
      if (createdToMs !== null && !isNaN(createdToMs)) {
        if (new Date(doc.createdAt).getTime() > createdToMs) return false;
      }

      // Updated date range
      if (updatedFromMs !== null && !isNaN(updatedFromMs)) {
        if (new Date(doc.updatedAt).getTime() < updatedFromMs) return false;
      }
      if (updatedToMs !== null && !isNaN(updatedToMs)) {
        if (new Date(doc.updatedAt).getTime() > updatedToMs) return false;
      }

      // File size range
      if (filter?.minSize !== undefined && filter.minSize !== null) {
        if (doc.fileSize < filter.minSize) return false;
      }
      if (filter?.maxSize !== undefined && filter.maxSize !== null) {
        if (doc.fileSize > filter.maxSize) return false;
      }

      // File type / extension filter
      if (filter?.fileType) {
        const ft = filter.fileType.toLowerCase().trim();
        const fileNameLower = (doc.originalFileName || '').toLowerCase();
        const mimeLower = (doc.mimeType || '').toLowerCase();
        let matches = false;

        if (ft === 'pdf') {
          matches = fileNameLower.endsWith('.pdf') || mimeLower.includes('pdf');
        } else if (ft === 'document' || ft === 'word' || ft === 'doc' || ft === 'docx') {
          matches =
            fileNameLower.endsWith('.doc') ||
            fileNameLower.endsWith('.docx') ||
            mimeLower.includes('word') ||
            mimeLower.includes('document');
        } else if (
          ft === 'spreadsheet' ||
          ft === 'excel' ||
          ft === 'sheet' ||
          ft === 'xlsx' ||
          ft === 'xls' ||
          ft === 'csv'
        ) {
          matches =
            fileNameLower.endsWith('.xls') ||
            fileNameLower.endsWith('.xlsx') ||
            fileNameLower.endsWith('.csv') ||
            mimeLower.includes('sheet') ||
            mimeLower.includes('csv') ||
            mimeLower.includes('excel');
        } else if (ft === 'presentation' || ft === 'powerpoint' || ft === 'ppt' || ft === 'pptx') {
          matches =
            fileNameLower.endsWith('.ppt') ||
            fileNameLower.endsWith('.pptx') ||
            mimeLower.includes('presentation') ||
            mimeLower.includes('powerpoint');
        } else if (ft === 'image' || ft === 'img') {
          matches = mimeLower.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileNameLower);
        } else if (ft === 'text' || ft === 'txt') {
          matches = mimeLower.startsWith('text/') || /\.(txt|md|log|json|xml|csv)$/i.test(fileNameLower);
        } else if (ft === 'archive' || ft === 'zip') {
          matches =
            mimeLower.includes('zip') ||
            mimeLower.includes('compressed') ||
            /\.(zip|tar|gz|7z|rar)$/i.test(fileNameLower);
        } else {
          const cleanExt = ft.startsWith('.') ? ft : `.${ft}`;
          matches = fileNameLower.endsWith(cleanExt) || mimeLower.includes(ft);
        }
        if (!matches) return false;
      }

      // Search across filename, document name, description, tags, document type
      if (searchTokens.length > 0) {
        const docNameLower = doc.name.toLowerCase();
        const fileNameLower = (doc.originalFileName || '').toLowerCase();
        const descLower = (doc.description || '').toLowerCase();

        const docTagIds = this.documentTags.get(doc.id) || new Set();
        const docTagNames = Array.from(docTagIds)
          .map((tId) => this.tags.get(tId)?.name.toLowerCase() || '')
          .filter(Boolean);

        const docTypeName = doc.documentTypeId
          ? this.documentTypes.get(doc.documentTypeId)?.name.toLowerCase() || ''
          : '';

        const versionFileNames = (this.documentVersions.get(doc.id) || []).map((v) =>
          v.fileName.toLowerCase()
        );

        const corpus = `${docNameLower} ${fileNameLower} ${descLower} ${docTagNames.join(' ')} ${docTypeName} ${versionFileNames.join(' ')}`;

        // Match all search terms (PostgreSQL text search AND query semantics)
        const allTermsMatch = searchTokens.every((token) => corpus.includes(token));
        if (!allTermsMatch) return false;

        // Calculate search relevance score
        let score = 0;
        if (docNameLower === searchRaw) score += 100;
        else if (docNameLower.includes(searchRaw)) score += 50;
        if (fileNameLower.includes(searchRaw)) score += 40;
        if (docTypeName.includes(searchRaw)) score += 30;
        if (docTagNames.some((t) => t.includes(searchRaw))) score += 25;

        for (const token of searchTokens) {
          if (docNameLower.includes(token)) score += 15;
          if (fileNameLower.includes(token)) score += 10;
          if (docTypeName.includes(token)) score += 8;
          if (docTagNames.some((t) => t.includes(token))) score += 8;
          if (descLower.includes(token)) score += 4;
        }

        searchScores.set(doc.id, score);
      }

      return true;
    });

    // 4. Sorting
    if (filter?.sortBy) {
      const order = filter.sortOrder === 'asc' ? 1 : -1;
      matchingDocs.sort((a, b) => {
        switch (filter.sortBy) {
          case 'name':
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) * order;
          case 'createdAt':
          case 'created':
            return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
          case 'updatedAt':
          case 'modified':
            return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order;
          case 'fileSize':
          case 'size':
            return (a.fileSize - b.fileSize) * order;
          case 'documentType':
          case 'type': {
            const typeA = a.documentTypeId ? this.documentTypes.get(a.documentTypeId)?.name || '' : a.mimeType;
            const typeB = b.documentTypeId ? this.documentTypes.get(b.documentTypeId)?.name || '' : b.mimeType;
            return typeA.localeCompare(typeB, undefined, { numeric: true, sensitivity: 'base' }) * order;
          }
          default:
            return (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) * order;
        }
      });
    } else if (searchScores.size > 0) {
      // Relevance score sort
      matchingDocs.sort((a, b) => (searchScores.get(b.id) || 0) - (searchScores.get(a.id) || 0));
    } else if (filter?.view === 'recent') {
      matchingDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else {
      // Default: newest updated first
      matchingDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    // 5. Server-side Pagination
    const total = matchingDocs.length;
    const isPagingRequested = filter?.page !== undefined || filter?.limit !== undefined;
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : (isPagingRequested ? 20 : total || 20);
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    const requestedPage = filter?.page && filter.page > 0 ? filter.page : 1;
    const page = total > 0 ? Math.min(requestedPage, totalPages) : 1;
    const startIndex = (page - 1) * limit;

    // Slicing before hydration avoids N+1 overhead
    const sliced = limit > 0 ? matchingDocs.slice(startIndex, startIndex + limit) : matchingDocs;
    const hydrated = sliced.map((d) => this.hydrateDocument(d, filter?.userId));

    return {
      data: hydrated,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  public getDocuments(
    organizationId: string,
    filter?: DocumentFilterOptions
  ): Document[] {
    // If page or limit not explicitly set, retrieve all matching documents
    if (filter?.page === undefined && filter?.limit === undefined) {
      const result = this.executeFilteredDocumentQuery(organizationId, {
        ...filter,
        limit: 100000,
      });
      return result.data;
    }
    const result = this.executeFilteredDocumentQuery(organizationId, filter);
    return result.data;
  }

  public getDocumentsPaginated(
    organizationId: string,
    filter?: DocumentFilterOptions
  ): PaginatedDocuments {
    return this.executeFilteredDocumentQuery(organizationId, filter);
  }

  // --------------------------------------------------------------------
  // Bulk Document Operations
  // --------------------------------------------------------------------

  public bulkAddTag(organizationId: string, documentIds: string[], tagId: string): number {
    const tag = this.tags.get(tagId);
    if (!tag || tag.organizationId !== organizationId) {
      throw new NotFoundError('Tag');
    }

    let affected = 0;
    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId && doc.deletedAt === null) {
        if (!this.documentTags.has(docId)) {
          this.documentTags.set(docId, new Set());
        }
        this.documentTags.get(docId)!.add(tagId);
        doc.updatedAt = new Date().toISOString();
        affected++;
      }
    }
    return affected;
  }

  public bulkRemoveTag(organizationId: string, documentIds: string[], tagId: string): number {
    let affected = 0;
    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId && doc.deletedAt === null) {
        const set = this.documentTags.get(docId);
        if (set && set.has(tagId)) {
          set.delete(tagId);
          doc.updatedAt = new Date().toISOString();
          affected++;
        }
      }
    }
    return affected;
  }

  public bulkMove(organizationId: string, documentIds: string[], targetFolderId: string | null): number {
    if (targetFolderId) {
      const folder = this.getFolderById(organizationId, targetFolderId);
      if (!folder) throw new NotFoundError('Target folder');
    }

    let affected = 0;
    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId && doc.deletedAt === null) {
        doc.folderId = targetFolderId;
        doc.updatedAt = new Date().toISOString();
        affected++;
      }
    }
    return affected;
  }

  public bulkDelete(organizationId: string, documentIds: string[]): number {
    const now = new Date().toISOString();
    let affected = 0;
    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId && doc.deletedAt === null) {
        doc.deletedAt = now;
        doc.status = 'DELETED';
        doc.updatedAt = now;
        affected++;
      }
    }
    return affected;
  }

  public bulkArchive(organizationId: string, documentIds: string[]): number {
    let affected = 0;
    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
      if (doc && doc.organizationId === organizationId && doc.deletedAt === null) {
        doc.status = 'ARCHIVED';
        doc.updatedAt = new Date().toISOString();
        affected++;
      }
    }
    return affected;
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
    this.indexDocument(organizationId, docId);

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

  public deleteDocument(organizationId: string, documentId: string, deletedById?: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const now = new Date().toISOString();
    doc.deletedAt = now;
    doc.deletedById = deletedById || null;
    doc.status = 'DELETED';
    doc.updatedAt = now;
  }

  public restoreDocument(organizationId: string, documentId: string, userId?: string): Document {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }

    doc.deletedAt = null;
    doc.deletedById = null;
    doc.status = 'ACTIVE';
    doc.updatedAt = new Date().toISOString();
    return this.hydrateDocument(doc, userId);
  }

  public purgeDocument(organizationId: string, documentId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }

    this.documents.delete(documentId);
    this.unindexDocument(organizationId, documentId);
    this.documentVersions.delete(documentId);
    this.documentTags.delete(documentId);
    this.documentFavorites.delete(documentId);
    this.documentComments.delete(documentId);
  }

  public toggleFavorite(organizationId: string, documentId: string, userId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    let userSet = this.documentFavorites.get(documentId);
    if (!userSet) {
      userSet = new Set<string>();
      this.documentFavorites.set(documentId, userSet);
    }

    if (userSet.has(userId)) {
      userSet.delete(userId);
      return false;
    } else {
      userSet.add(userId);
      return true;
    }
  }

  public isFavorite(documentId: string, userId: string): boolean {
    const userSet = this.documentFavorites.get(documentId);
    return userSet ? userSet.has(userId) : false;
  }

  public getDocumentComments(organizationId: string, documentId: string): DocumentComment[] {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }

    const comments = this.documentComments.get(documentId) || [];
    return [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public addDocumentComment(
    organizationId: string,
    documentId: string,
    user: { id: string; firstName: string; lastName: string; email: string },
    content: string
  ): DocumentComment {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId || doc.deletedAt !== null) {
      throw new NotFoundError('Document');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new ValidationError('Comment content cannot be empty');
    }

    const comment: DocumentComment = {
      id: this.generateId('comment'),
      organizationId,
      documentId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      userEmail: user.email,
      content: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let list = this.documentComments.get(documentId);
    if (!list) {
      list = [];
      this.documentComments.set(documentId, list);
    }
    list.push(comment);
    return comment;
  }

  public updateDocumentComment(
    organizationId: string,
    documentId: string,
    commentId: string,
    userId: string,
    content: string
  ): DocumentComment {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }

    const list = this.documentComments.get(documentId) || [];
    const comment = list.find((c) => c.id === commentId);
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new ValidationError('Comment content cannot be empty');
    }

    comment.content = trimmed;
    comment.updatedAt = new Date().toISOString();
    return comment;
  }

  public deleteDocumentComment(organizationId: string, documentId: string, commentId: string, userId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }

    const list = this.documentComments.get(documentId) || [];
    const comment = list.find((c) => c.id === commentId);
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    this.documentComments.set(
      documentId,
      list.filter((c) => c.id !== commentId)
    );
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
    // Sort descending by version number with hydrated user info
    return [...versions]
      .map((v) => ({
        ...v,
        uploadedByUser: store.findUserById(v.uploadedById) || null,
      }))
      .sort((a, b) => b.versionNumber - a.versionNumber);
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
    const v = versions.find((ver) => ver.versionNumber === versionNumber) || null;
    if (!v) return null;
    return {
      ...v,
      uploadedByUser: store.findUserById(v.uploadedById) || null,
    };
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

  public getDocumentMetadata(organizationId: string, documentId: string, includeDeleted = false): Record<string, unknown> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundError('Document');
    }
    if (!includeDeleted && doc.deletedAt !== null) {
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
  private hydrateDocument(doc: Document, userId?: string): Document {
    const folder = doc.folderId ? this.folders.get(doc.folderId) || null : null;
    const documentType = doc.documentTypeId ? this.documentTypes.get(doc.documentTypeId) || null : null;

    const tagIds = this.documentTags.get(doc.id) || new Set();
    const tags = Array.from(tagIds)
      .map((tId) => this.tags.get(tId))
      .filter((t): t is Tag => Boolean(t));

    const versions = (this.documentVersions.get(doc.id) || [])
      .map((v) => ({
        ...v,
        uploadedByUser: store.findUserById(v.uploadedById) || null,
      }))
      .sort((a, b) => b.versionNumber - a.versionNumber);

    const metadata = this.getDocumentMetadata(doc.organizationId, doc.id, true);
    const isFavorite = userId ? this.isFavorite(doc.id, userId) : false;
    const owner = store.findUserById(doc.ownerId) || null;
    const createdBy = store.findUserById(doc.createdById) || null;
    const deletedBy = doc.deletedById ? store.findUserById(doc.deletedById) || null : null;

    return {
      ...doc,
      isFavorite,
      folder,
      documentType,
      tags,
      versions,
      metadata,
      owner,
      createdBy,
      deletedBy,
    };
  }
}

export const documentStore = new DocumentStoreExtension();

// If store is already initialized, ensure default demo documents and folders exist
try {
  const demoOrg = store.getOrganizationBySlug?.('demo-corp');
  if (demoOrg) {
    const adminUser = store.getUsersByOrganization(demoOrg.id).find((u) => u.email === 'admin@democorp.com');
    if (adminUser) {
      documentStore.seedPhase2Defaults(demoOrg.id, adminUser.id);
    }
  }
} catch {
  // Store may still be initializing
}
