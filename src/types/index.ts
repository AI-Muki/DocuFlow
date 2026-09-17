// DocuFlow AI - Domain & Application Types

export type SystemRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type PermissionKey =
  | 'documents.read'
  | 'documents.create'
  | 'documents.update'
  | 'documents.delete'
  | 'workflows.create'
  | 'workflows.manage'
  | 'approvals.approve'
  | 'users.manage'
  | 'users.read'
  | 'departments.manage'
  | 'organization.manage'
  | 'audit.read';

export interface Permission {
  id: string;
  action: string;
  resource: string;
  key: PermissionKey;
  description?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  organizationId: string | null;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string | null;
  departmentId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  status: UserStatus;
  isEmailVerified: boolean;
  roles: Role[];
  permissions: PermissionKey[];
  department?: Department | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  stats?: {
    userCount: number;
    departmentCount: number;
  };
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  organization: Organization | null;
  token: string;
}

export interface TokenPayload {
  userId: string;
  organizationId: string | null;
  email: string;
  roleNames: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export interface MultiTenantContext {
  organizationId: string;
  userId: string;
  roles: string[];
  permissions: PermissionKey[];
}

// ----------------------------------------------------------------------
// Phase 2A: Document & Folder Domain Types
// ----------------------------------------------------------------------

export type DocumentStatus =
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'PENDING_PROCESSING'
  | 'PROCESSING'
  | 'PROCESSING_FAILED'
  | 'DELETED';

export type FieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT';

export interface Folder {
  id: string;
  organizationId: string;
  parentFolderId: string | null;
  name: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // Hydrated properties
  parentFolder?: Folder | null;
  childFolders?: Folder[];
  documentsCount?: number;
}

export interface DocumentType {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  fields?: DocumentFieldDefinition[];
}

export interface DocumentFieldDefinition {
  id: string;
  organizationId: string;
  documentTypeId: string;
  name: string;
  key: string;
  type: FieldType;
  required: boolean;
  options?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFieldValue {
  id: string;
  documentId: string;
  fieldDefinitionId: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
  fieldDefinition?: DocumentFieldDefinition;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  uploadedById: string;
  changeDescription?: string | null;
  createdAt: string;
  uploadedByUser?: User | null;
}

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

export interface Document {
  id: string;
  organizationId: string;
  folderId: string | null;
  documentTypeId: string | null;
  name: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  checksum: string;
  description?: string | null;
  status: DocumentStatus;
  createdById: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // Hydrated details
  folder?: Folder | null;
  documentType?: DocumentType | null;
  tags?: Tag[];
  versions?: DocumentVersion[];
  metadata?: Record<string, unknown>; // key -> value representation
  fieldValues?: DocumentFieldValue[]; // raw field values
  owner?: User | null;
  createdBy?: User | null;
}

