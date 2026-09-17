import { Router, type Response } from 'express';
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePermission,
  requireTenant,
} from '../auth/auth.middleware.ts';
import { documentFolderService } from './document.service.ts';
import { formatErrorResponse, ValidationError } from '../../lib/errors.ts';
import {
  assignTagSchema,
  copyDocumentSchema,
  createDocumentRecordSchema,
  createDocumentTypeSchema,
  createDocumentVersionSchema,
  createFieldDefinitionSchema,
  createFolderSchema,
  createTagSchema,
  moveDocumentSchema,
  moveFolderSchema,
  renameFolderSchema,
  setDocumentMetadataSchema,
  updateDocumentSchema,
} from '../../validation/document.schema.ts';
import type { DocumentStatus } from '../../types/index.ts';

export const documentRouter = Router();

// Apply auth and tenant verification on all document & folder endpoints
documentRouter.use(requireAuth);
documentRouter.use(requireTenant);

// ----------------------------------------------------------------------
// Folders API
// ----------------------------------------------------------------------

documentRouter.get('/folders', (req: AuthenticatedRequest, res: Response) => {
  try {
    const parentFolderId = req.query.parentFolderId !== undefined
      ? (req.query.parentFolderId === 'null' || req.query.parentFolderId === '' ? null : String(req.query.parentFolderId))
      : undefined;

    const folders = documentFolderService.getFolders(req.user!, parentFolderId);
    res.json({ success: true, data: folders });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

documentRouter.get('/folders/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const folder = documentFolderService.getFolderById(req.user!, req.params.id);
    res.json({ success: true, data: folder });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 404;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/folders', requirePermission('documents.create'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const folder = documentFolderService.createFolder(req.user!, parseResult.data);
    res.status(201).json({ success: true, data: folder });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.patch('/folders/:id/rename', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = renameFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const updated = documentFolderService.renameFolder(req.user!, req.params.id, parseResult.data.name);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.patch('/folders/:id/move', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = moveFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const updated = documentFolderService.moveFolder(req.user!, req.params.id, parseResult.data.targetParentFolderId);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.delete('/folders/:id', requirePermission('documents.delete'), (req: AuthenticatedRequest, res: Response) => {
  try {
    documentFolderService.deleteFolder(req.user!, req.params.id);
    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Document Types & Field Definitions API
// ----------------------------------------------------------------------

documentRouter.get('/document-types', (req: AuthenticatedRequest, res: Response) => {
  try {
    const types = documentFolderService.getDocumentTypes(req.user!);
    res.json({ success: true, data: types });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

documentRouter.get('/document-types/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const dt = documentFolderService.getDocumentTypeById(req.user!, req.params.id);
    res.json({ success: true, data: dt });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 404;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/document-types', requirePermission('documents.create'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createDocumentTypeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const dt = documentFolderService.createDocumentType(req.user!, parseResult.data.name, parseResult.data.description);
    res.status(201).json({ success: true, data: dt });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/document-types/:id/fields', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createFieldDefinitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const field = documentFolderService.createFieldDefinition(req.user!, req.params.id, parseResult.data);
    res.status(201).json({ success: true, data: field });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Tags API
// ----------------------------------------------------------------------

documentRouter.get('/tags', (req: AuthenticatedRequest, res: Response) => {
  try {
    const tags = documentFolderService.getTags(req.user!);
    res.json({ success: true, data: tags });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

documentRouter.post('/tags', requirePermission('documents.create'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createTagSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const tag = documentFolderService.createTag(req.user!, parseResult.data.name);
    res.status(201).json({ success: true, data: tag });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Documents API
// ----------------------------------------------------------------------

documentRouter.get('/documents', (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.query.folderId !== undefined
      ? (req.query.folderId === 'null' || req.query.folderId === '' ? null : String(req.query.folderId))
      : undefined;

    const filter = {
      folderId,
      documentTypeId: req.query.documentTypeId ? String(req.query.documentTypeId) : undefined,
      status: req.query.status ? (String(req.query.status) as DocumentStatus) : undefined,
      ownerId: req.query.ownerId ? String(req.query.ownerId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    };

    const documents = documentFolderService.getDocuments(req.user!, filter);
    res.json({ success: true, data: documents });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

documentRouter.get('/documents/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const document = documentFolderService.getDocumentById(req.user!, req.params.id);
    res.json({ success: true, data: document });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 404;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/documents', requirePermission('documents.create'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createDocumentRecordSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const doc = documentFolderService.createDocumentRecord(req.user!, parseResult.data);
    res.status(201).json({ success: true, data: doc });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.patch('/documents/:id', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = updateDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const updated = documentFolderService.updateDocument(req.user!, req.params.id, parseResult.data);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.patch('/documents/:id/move', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = moveDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const updated = documentFolderService.moveDocument(req.user!, req.params.id, parseResult.data.targetFolderId);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/documents/:id/copy', requirePermission('documents.create'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = copyDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const copy = documentFolderService.copyDocumentRecord(
      req.user!,
      req.params.id,
      parseResult.data.targetFolderId,
      parseResult.data.newName
    );
    res.status(201).json({ success: true, data: copy });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.delete('/documents/:id', requirePermission('documents.delete'), (req: AuthenticatedRequest, res: Response) => {
  try {
    documentFolderService.deleteDocument(req.user!, req.params.id);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Document Versions API
// ----------------------------------------------------------------------

documentRouter.get('/documents/:id/versions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const versions = documentFolderService.getDocumentVersions(req.user!, req.params.id);
    res.json({ success: true, data: versions });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 404;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/documents/:id/versions', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createDocumentVersionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const newVersion = documentFolderService.createDocumentVersion(req.user!, req.params.id, parseResult.data);
    res.status(201).json({ success: true, data: newVersion });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.post('/documents/:id/versions/:versionNumber/restore', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const versionNumber = parseInt(req.params.versionNumber, 10);
    if (isNaN(versionNumber)) {
      throw new ValidationError('Version number must be an integer');
    }

    const restored = documentFolderService.restoreDocumentVersion(req.user!, req.params.id, versionNumber);
    res.json({ success: true, data: restored });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Document Tags API
// ----------------------------------------------------------------------

documentRouter.post('/documents/:id/tags', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = assignTagSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    documentFolderService.assignTag(req.user!, req.params.id, parseResult.data.tagId);
    res.json({ success: true, message: 'Tag assigned successfully' });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.delete('/documents/:id/tags/:tagId', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    documentFolderService.removeTag(req.user!, req.params.id, req.params.tagId);
    res.json({ success: true, message: 'Tag removed successfully' });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Document Metadata API
// ----------------------------------------------------------------------

documentRouter.get('/documents/:id/metadata', (req: AuthenticatedRequest, res: Response) => {
  try {
    const metadata = documentFolderService.getDocumentMetadata(req.user!, req.params.id);
    res.json({ success: true, data: metadata });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 404;
    res.status(status).json(formatErrorResponse(err));
  }
});

documentRouter.put('/documents/:id/metadata', requirePermission('documents.update'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = setDocumentMetadataSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const updated = documentFolderService.setDocumentMetadata(req.user!, req.params.id, parseResult.data.metadata);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatErrorResponse(err));
  }
});
