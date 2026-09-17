import { describe, it, expect } from 'vitest';
import { documentFolderService } from '../../src/modules/documents/document.service.ts';
import { store } from '../../src/database/store.ts';
import type { User } from '../../src/types/index.ts';

describe('Phase 2A: Multi-Tenant Isolation & RBAC on Documents/Folders', () => {
  const demoOrgId = 'org-demo-corp-uuid-001';
  const adminUser = store.findUserByEmail('admin@demo.local')!;
  const employeeUser = store.findUserByEmail('employee@demo.local')!;

  // Create a second tenant for cross-tenant tests
  const orgB = store.createOrganization('Gamma Dynamics', 'gamma-dyn', 'user-gamma-creator');
  const gammaUser: User = {
    id: 'user-gamma-admin',
    organizationId: orgB.id,
    departmentId: undefined,
    email: 'admin@gammadynamics.io',
    firstName: 'Grace',
    lastName: 'Hopper',
    avatarUrl: null,
    status: 'ACTIVE',
    isEmailVerified: true,
    roles: [store.getRoles().find((r) => r.name === 'ORG_ADMIN')!],
    permissions: ['documents.read', 'documents.create', 'documents.update', 'documents.delete'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('Tenant Boundary Enforcement', () => {
    it('should prevent Tenant B from seeing Tenant A folders', () => {
      // Demo Corp creates a private folder
      const demoFolder = documentFolderService.createFolder(adminUser, {
        name: `Confidential-A-${Date.now()}`,
      });

      // Gamma Dynamics lists their folders
      const gammaFolders = documentFolderService.getFolders(gammaUser);
      expect(gammaFolders.some((f) => f.id === demoFolder.id)).toBe(false);

      // Gamma Dynamics attempts direct retrieval
      expect(() => {
        documentFolderService.getFolderById(gammaUser, demoFolder.id);
      }).toThrow(/not found/i);
    });

    it('should prevent Tenant B from accessing or manipulating Tenant A documents', () => {
      const demoDoc = documentFolderService.createDocument(adminUser, {
        name: `Secret-Strategy-${Date.now()}`,
        originalFileName: 'strategy.pdf',
        mimeType: 'application/pdf',
        fileSize: 20000,
        storageKey: `org-${demoOrgId}/docs/strat.pdf`,
        checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      // Gamma cannot fetch document
      expect(() => {
        documentFolderService.getDocumentById(gammaUser, demoDoc.id);
      }).toThrow(/not found/i);

      // Gamma cannot add version to Demo document
      expect(() => {
        documentFolderService.createDocumentVersion(gammaUser, demoDoc.id, {
          fileName: 'hijack.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          storageKey: `org-${orgB.id}/docs/hijack.pdf`,
          checksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        });
      }).toThrow(/not found/i);

      // Gamma cannot delete Demo document
      expect(() => {
        documentFolderService.deleteDocument(gammaUser, demoDoc.id);
      }).toThrow(/not found/i);
    });

    it('should prevent cross-tenant folder moves or assignments', () => {
      const demoFolder = documentFolderService.createFolder(adminUser, {
        name: `OrgA-Folder-${Date.now()}`,
      });
      const gammaFolder = documentFolderService.createFolder(gammaUser, {
        name: `OrgB-Folder-${Date.now()}`,
      });

      // Tenant A cannot move its folder into Tenant B folder
      expect(() => {
        documentFolderService.moveFolder(adminUser, demoFolder.id, gammaFolder.id);
      }).toThrow(/Target destination folder/i);

      // Tenant A cannot move its document into Tenant B folder
      const demoDoc = documentFolderService.createDocument(adminUser, {
        name: `Doc-Move-Test-${Date.now()}`,
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        storageKey: `org-${demoOrgId}/docs/test.pdf`,
        checksum: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      });

      expect(() => {
        documentFolderService.moveDocument(adminUser, demoDoc.id, gammaFolder.id);
      }).toThrow(/Destination folder not found/i);
    });

    it('should isolate Document Types and Tags between tenants', () => {
      const demoType = documentFolderService.createDocumentType(adminUser, {
        name: `DemoType-${Date.now()}`,
      });
      const demoTag = documentFolderService.createTag(adminUser, `DemoTag-${Date.now()}`);

      const gammaTypes = documentFolderService.getDocumentTypes(gammaUser);
      expect(gammaTypes.some((t) => t.id === demoType.id)).toBe(false);

      const gammaTags = documentFolderService.getTags(gammaUser);
      expect(gammaTags.some((t) => t.id === demoTag.id)).toBe(false);
    });
  });

  describe('RBAC Permission Validation', () => {
    it('should reject document creation if user lacks documents.create permission', () => {
      // Create restricted user with only documents.read
      const readOnlyUser: User = {
        id: 'user-readonly-1',
        organizationId: demoOrgId,
        departmentId: undefined,
        email: 'reader@demo.local',
        firstName: 'Read',
        lastName: 'Only',
        avatarUrl: null,
        status: 'ACTIVE',
        isEmailVerified: true,
        roles: [
          {
            id: 'role-custom-reader',
            organizationId: demoOrgId,
            name: 'Viewer',
            isSystem: false,
            permissions: ['documents.read'],
            createdAt: '',
            updatedAt: '',
          },
        ],
        permissions: ['documents.read'],
        createdAt: '',
        updatedAt: '',
      };

      expect(() => {
        documentFolderService.createDocument(readOnlyUser, {
          name: 'Forbidden Doc',
          originalFileName: 'forbidden.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          storageKey: 'key',
          checksum: 'abc',
        });
      }).toThrow(/Permission Denied/i);
    });
  });
});
