import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name too long').trim(),
  parentFolderId: z.string().min(1).nullable().optional(),
});

export const renameFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name too long').trim(),
});

export const moveFolderSchema = z.object({
  targetParentFolderId: z.string().min(1).nullable(),
});

export const createDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Document type name is required').max(100).trim(),
  description: z.string().max(500).optional(),
});

export const createFieldDefinitionSchema = z.object({
  name: z.string().min(1, 'Field name is required').max(100).trim(),
  key: z.string().min(1, 'Field key is required').max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Field key must be alphanumeric or dashes/underscores'),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50).trim(),
});

export const createDocumentRecordSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(255).trim(),
  originalFileName: z.string().min(1, 'Original file name is required').max(255).trim(),
  mimeType: z.string().min(1, 'Mime type is required'),
  fileSize: z.number().nonnegative('File size must be non-negative'),
  storageKey: z.string().min(1, 'Storage key is required'),
  checksum: z.string().min(1, 'Checksum is required'),
  description: z.string().max(1000).optional(),
  folderId: z.string().min(1).nullable().optional(),
  documentTypeId: z.string().min(1).nullable().optional(),
  ownerId: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).nullable().optional(),
  documentTypeId: z.string().min(1).nullable().optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'PENDING_PROCESSING', 'PROCESSING', 'PROCESSING_FAILED', 'DELETED']).optional(),
});

export const moveDocumentSchema = z.object({
  targetFolderId: z.string().min(1).nullable(),
});

export const copyDocumentSchema = z.object({
  targetFolderId: z.string().min(1).nullable().optional(),
  newName: z.string().min(1).max(255).trim().optional(),
});

export const createDocumentVersionSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255).trim(),
  mimeType: z.string().min(1, 'Mime type is required'),
  fileSize: z.number().nonnegative('File size must be non-negative'),
  storageKey: z.string().min(1, 'Storage key is required'),
  checksum: z.string().min(1, 'Checksum is required'),
  changeDescription: z.string().max(500).optional(),
});

export const setDocumentMetadataSchema = z.object({
  metadata: z.record(z.string(), z.unknown()),
});

export const assignTagSchema = z.object({
  tagId: z.string().min(1),
});
