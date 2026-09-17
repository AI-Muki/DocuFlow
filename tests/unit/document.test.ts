import { describe, it, expect } from 'vitest';
import { documentFolderService } from '../../src/modules/documents/document.service.ts';
import { documentStore } from '../../src/database/document-store.ts';
import { store } from '../../src/database/store.ts';
import { validateMetadataRecord } from '../../src/modules/documents/metadata-validator.ts';
import type { User } from '../../src/types/index.ts';

describe('Phase 2A: Document & Folder Domain Services', () => {
  const demoOrgId = 'org-demo-corp-uuid-001';
  const adminUser = store.findUserByEmail('admin@demo.local')!;

  describe('Folder Hierarchy & Validation', () => {
    it('should create root and nested child folders successfully', () => {
      const rootFolder = documentFolderService.createFolder(adminUser, {
        name: `Engineering-${Date.now()}`,
        parentFolderId: null,
      });

      expect(rootFolder.id).toBeDefined();
      expect(rootFolder.parentFolderId).toBeNull();
      expect(rootFolder.organizationId).toBe(demoOrgId);

      const subFolder = documentFolderService.createFolder(adminUser, {
        name: 'Architecture',
        parentFolderId: rootFolder.id,
      });

      expect(subFolder.parentFolderId).toBe(rootFolder.id);

      // Verify breadcrumbs / hierarchy
      const path = documentFolderService.getFolderPath(adminUser, subFolder.id);
      expect(path.length).toBe(2);
      expect(path[0].id).toBe(rootFolder.id);
      expect(path[1].id).toBe(subFolder.id);
    });

    it('should prevent duplicate folder names in the same parent directory', () => {
      const folderName = `DuplicateCheck-${Date.now()}`;
      documentFolderService.createFolder(adminUser, {
        name: folderName,
        parentFolderId: null,
      });

      expect(() => {
        documentFolderService.createFolder(adminUser, {
          name: folderName,
          parentFolderId: null,
        });
      }).toThrow(/already exists/i);
    });

    it('should prevent circular references when moving folders', () => {
      const parent = documentFolderService.createFolder(adminUser, {
        name: `Parent-${Date.now()}`,
      });
      const child = documentFolderService.createFolder(adminUser, {
        name: 'Child',
        parentFolderId: parent.id,
      });
      const grandchild = documentFolderService.createFolder(adminUser, {
        name: 'Grandchild',
        parentFolderId: child.id,
      });

      // Cannot move folder into itself
      expect(() => {
        documentFolderService.moveFolder(adminUser, parent.id, parent.id);
      }).toThrow(/Cannot move a folder inside itself/i);

      // Cannot move parent into child
      expect(() => {
        documentFolderService.moveFolder(adminUser, parent.id, child.id);
      }).toThrow(/descendant/i);

      // Cannot move parent into grandchild
      expect(() => {
        documentFolderService.moveFolder(adminUser, parent.id, grandchild.id);
      }).toThrow(/descendant/i);
    });

    it('should rename folders and reject duplicate names under same parent', () => {
      const folderA = documentFolderService.createFolder(adminUser, {
        name: `FolderA-${Date.now()}`,
      });
      const folderB = documentFolderService.createFolder(adminUser, {
        name: `FolderB-${Date.now()}`,
      });

      // Renaming to unique name succeeds
      const renamed = documentFolderService.renameFolder(adminUser, folderA.id, `FolderA-Renamed-${Date.now()}`);
      expect(renamed.name).toContain('Renamed');

      // Renaming to existing sibling name fails
      expect(() => {
        documentFolderService.renameFolder(adminUser, folderB.id, renamed.name);
      }).toThrow(/already exists/i);
    });
  });

  describe('Document Registration & Versioning', () => {
    it('should register a new document record with version 1', () => {
      const doc = documentFolderService.createDocument(adminUser, {
        name: 'Standard Operating Procedure',
        originalFileName: 'SOP-2026.pdf',
        mimeType: 'application/pdf',
        fileSize: 1048576,
        storageKey: `org-${demoOrgId}/docs/sop-2026.pdf`,
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        description: 'Internal security guidelines',
      });

      expect(doc.id).toBeDefined();
      expect(doc.status).toBe('ACTIVE');
      expect(doc.organizationId).toBe(demoOrgId);

      // Verify versions
      const versions = documentFolderService.getDocumentVersions(adminUser, doc.id);
      expect(versions.length).toBe(1);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].fileName).toBe('SOP-2026.pdf');
    });

    it('should create version 2 and allow restoring version 1 as version 3', () => {
      const doc = documentFolderService.createDocument(adminUser, {
        name: 'Contract Document',
        originalFileName: 'contract-v1.pdf',
        mimeType: 'application/pdf',
        fileSize: 50000,
        storageKey: `org-${demoOrgId}/docs/c-v1.pdf`,
        checksum: '1111111111111111111111111111111111111111111111111111111111111111',
      });

      // Add Version 2
      const v2 = documentFolderService.createDocumentVersion(adminUser, doc.id, {
        fileName: 'contract-v2.pdf',
        mimeType: 'application/pdf',
        fileSize: 62000,
        storageKey: `org-${demoOrgId}/docs/c-v2.pdf`,
        checksum: '2222222222222222222222222222222222222222222222222222222222222222',
        changeDescription: 'Updated clause 4',
      });

      expect(v2.versionNumber).toBe(2);

      const allVersions = documentFolderService.getDocumentVersions(adminUser, doc.id);
      expect(allVersions.length).toBe(2);

      // Restore Version 1: creates Version 3 with contents of Version 1
      const restored = documentFolderService.restoreDocumentVersion(adminUser, doc.id, 1);
      expect(restored.versionNumber).toBe(3);
      expect(restored.fileName).toBe('contract-v1.pdf');
      expect(restored.checksum).toBe('1111111111111111111111111111111111111111111111111111111111111111');
      expect(restored.changeDescription).toContain('Restored from version 1');
    });

    it('should support copying and moving documents', () => {
      const folderTarget = documentFolderService.createFolder(adminUser, {
        name: `MoveTarget-${Date.now()}`,
      });

      const originalDoc = documentFolderService.createDocument(adminUser, {
        name: 'Original Report',
        originalFileName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 12000,
        storageKey: `org-${demoOrgId}/docs/report.pdf`,
        checksum: '3333333333333333333333333333333333333333333333333333333333333333',
      });

      // Move document
      const moved = documentFolderService.moveDocument(adminUser, originalDoc.id, folderTarget.id);
      expect(moved.folderId).toBe(folderTarget.id);

      // Copy document
      const copy = documentFolderService.copyDocument(adminUser, originalDoc.id, 'Copy of Original Report');
      expect(copy.id).not.toBe(originalDoc.id);
      expect(copy.name).toBe('Copy of Original Report');
      expect(copy.folderId).toBe(folderTarget.id);
    });

    it('should soft delete document and remove from active list', () => {
      const doc = documentFolderService.createDocument(adminUser, {
        name: 'To Delete Doc',
        originalFileName: 'delete-me.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storageKey: `org-${demoOrgId}/docs/delete-me.pdf`,
        checksum: '4444444444444444444444444444444444444444444444444444444444444444',
      });

      documentFolderService.deleteDocument(adminUser, doc.id);

      expect(() => {
        documentFolderService.getDocumentById(adminUser, doc.id);
      }).toThrow(/not found/i);
    });
  });

  describe('Document Types & Metadata Schema Validation', () => {
    it('should define document types with field definitions', () => {
      const typeName = `Tax Filing-${Date.now()}`;
      const docType = documentFolderService.createDocumentType(adminUser, {
        name: typeName,
        description: 'Corporate annual tax documentation',
      });

      expect(docType.id).toBeDefined();

      // Add typed fields
      const fieldDef = documentFolderService.addFieldDefinition(adminUser, docType.id, {
        name: 'Tax Year',
        key: 'taxYear',
        type: 'NUMBER',
        required: true,
      });

      expect(fieldDef.id).toBeDefined();
      expect(fieldDef.key).toBe('taxYear');
      expect(fieldDef.type).toBe('NUMBER');
    });

    it('should validate metadata record against schema definitions', () => {
      const fields = [
        { id: 'f1', organizationId: demoOrgId, documentTypeId: 'dt1', name: 'Year', key: 'year', type: 'NUMBER' as const, required: true, options: null, createdAt: '', updatedAt: '' },
        { id: 'f2', organizationId: demoOrgId, documentTypeId: 'dt1', name: 'Currency', key: 'curr', type: 'SELECT' as const, required: true, options: ['USD', 'EUR'], createdAt: '', updatedAt: '' },
        { id: 'f3', organizationId: demoOrgId, documentTypeId: 'dt1', name: 'Approved', key: 'isApproved', type: 'BOOLEAN' as const, required: false, options: null, createdAt: '', updatedAt: '' },
      ];

      // Valid metadata passes and normalizes values
      const valid = validateMetadataRecord(fields, {
        year: 2026,
        curr: 'USD',
        isApproved: true,
      });
      expect(valid.year).toBe(2026);
      expect(valid.curr).toBe('USD');
      expect(valid.isApproved).toBe(true);

      // Missing required field throws ValidationError
      expect(() => {
        validateMetadataRecord(fields, { year: 2026 });
      }).toThrow(/required/i);

      // Invalid select option throws ValidationError
      expect(() => {
        validateMetadataRecord(fields, {
          year: 2026,
          curr: 'JPY',
        });
      }).toThrow(/Allowed/i);
    });
  });

  describe('Tags Management', () => {
    it('should create tags and assign them to documents', () => {
      const tagName = `Compliance-${Date.now()}`;
      const tag = documentFolderService.createTag(adminUser, tagName);
      expect(tag.name).toBe(tagName);

      const doc = documentFolderService.createDocument(adminUser, {
        name: 'Policy Document',
        originalFileName: 'policy.pdf',
        mimeType: 'application/pdf',
        fileSize: 8000,
        storageKey: `org-${demoOrgId}/docs/policy.pdf`,
        checksum: '5555555555555555555555555555555555555555555555555555555555555555',
      });

      const taggedDoc = documentFolderService.assignTag(adminUser, doc.id, tag.id);
      expect(taggedDoc.tags?.some((t) => t.id === tag.id)).toBe(true);
    });
  });
});
