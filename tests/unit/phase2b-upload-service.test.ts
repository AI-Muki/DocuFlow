import { describe, it, expect } from 'vitest';
import { documentUploadService } from '../../src/modules/documents/document-upload.service.ts';
import { store } from '../../src/database/store.ts';
import { documentStore } from '../../src/database/document-store.ts';
import type { User } from '../../src/types/index.ts';
import { ForbiddenError, NotFoundError } from '../../src/lib/errors.ts';

describe('Phase 2B: DocumentUploadService Flow & Tenant Isolation', () => {
  const adminUser = store.findUserByEmail('admin@demo.local')!;
  const orgId = adminUser.organizationId;

  // Create a second tenant user for isolation checks
  const otherOrg = store.createOrganization('Isolated Org B', `isolated-org-${Date.now()}`, 'user-isolated-creator');
  const otherOrgUser: User = {
    id: `user-isolated-${Date.now()}`,
    organizationId: otherOrg.id,
    departmentId: undefined,
    email: `isolated-${Date.now()}@tenantb.local`,
    firstName: 'Isolated',
    lastName: 'User',
    avatarUrl: null,
    status: 'ACTIVE',
    isEmailVerified: true,
    roles: [store.getRoles().find((r) => r.name === 'ORG_ADMIN')!],
    permissions: ['documents.read', 'documents.create', 'documents.update', 'documents.delete'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('Full Document Upload Flow', () => {
    it('successfully validates, checksums, stores file, creates Document and Version 1', async () => {
      const pdfContent = Buffer.from(`%PDF-1.4 Unique Sample Document ${Date.now()}`);
      const fileName = `quarterly-report-${Date.now()}.pdf`;

      const result = await documentUploadService.uploadDocument(adminUser, {
        buffer: pdfContent,
        originalFileName: fileName,
        declaredMimeType: 'application/pdf',
        name: 'Quarterly Report Q3',
        description: 'Financial figures for third quarter',
        tags: ['Finance', 'Reports'],
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.document).toBeDefined();
      expect(result.version).toBeDefined();

      const doc = result.document!;
      const ver = result.version!;

      // Verify Document attributes
      expect(doc.id).toBeDefined();
      expect(doc.organizationId).toBe(orgId);
      expect(doc.name).toBe('Quarterly Report Q3');
      expect(doc.originalFileName).toBe(fileName);
      expect(doc.mimeType).toBe('application/pdf');
      expect(doc.fileSize).toBe(pdfContent.length);
      expect(doc.checksum).toBeDefined();
      expect(doc.storageKey).toContain(`tenants/${orgId}/documents/`);

      // Verify Version 1 was automatically created
      expect(ver.documentId).toBe(doc.id);
      expect(ver.versionNumber).toBe(1);
      expect(ver.checksum).toBe(doc.checksum);
      expect(ver.storageKey).toBe(doc.storageKey);

      // Verify Audit Event logged
      const auditLogs = store
        .getAuditLogsByOrganization(orgId)
        .filter((a) => a.entityId === doc.id);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.some((a) => a.action === 'document.uploaded')).toBe(true);
    });

    it('detects duplicate files by checksum and enforces user confirmation', async () => {
      const uniquePdf = Buffer.from(`%PDF-1.4 Duplicate Detection Test Content ${Date.now()}`);
      const initialUpload = await documentUploadService.uploadDocument(adminUser, {
        buffer: uniquePdf,
        originalFileName: 'contract-original.pdf',
        declaredMimeType: 'application/pdf',
      });
      expect(initialUpload.isDuplicate).toBe(false);

      // Upload identical file again with allowDuplicate: false
      const duplicateAttempt = await documentUploadService.uploadDocument(adminUser, {
        buffer: uniquePdf,
        originalFileName: 'contract-copy.pdf',
        declaredMimeType: 'application/pdf',
        allowDuplicate: false,
      });

      expect(duplicateAttempt.isDuplicate).toBe(true);
      expect(duplicateAttempt.duplicateMessage).toBe('An identical file already exists.');
      expect(duplicateAttempt.existingDocument).toBeDefined();
      expect(duplicateAttempt.existingDocument?.id).toBe(initialUpload.document?.id);

      // Upload identical file with allowDuplicate: true (explicit user override)
      const allowedDuplicate = await documentUploadService.uploadDocument(adminUser, {
        buffer: uniquePdf,
        originalFileName: 'contract-copy.pdf',
        declaredMimeType: 'application/pdf',
        allowDuplicate: true,
      });

      expect(allowedDuplicate.isDuplicate).toBe(false);
      expect(allowedDuplicate.document).toBeDefined();
      expect(allowedDuplicate.document?.id).not.toBe(initialUpload.document?.id);
    });

    it('uploads a new document revision creating Version 2 and updating active reference', async () => {
      const initialPdf = Buffer.from(`%PDF-1.4 Spec Sheet V1 ${Date.now()}`);
      const initialUpload = await documentUploadService.uploadDocument(adminUser, {
        buffer: initialPdf,
        originalFileName: 'specs.pdf',
        declaredMimeType: 'application/pdf',
      });
      const docId = initialUpload.document!.id;

      // Upload Revision V2
      const revisionPdf = Buffer.from(`%PDF-1.4 Spec Sheet V2 with amendments ${Date.now()}`);
      const ver2 = await documentUploadService.uploadNewVersion(
        adminUser,
        docId,
        {
          buffer: revisionPdf,
          originalFileName: 'specs_revised.pdf',
          declaredMimeType: 'application/pdf',
        },
        'Incorporated legal amendments'
      );

      expect(ver2.versionNumber).toBe(2);
      expect(ver2.changeDescription).toBe('Incorporated legal amendments');
      expect(ver2.fileSize).toBe(revisionPdf.length);
      expect(ver2.checksum).not.toBe(initialUpload.document?.checksum);

      // Verify updated document active version
      const updatedDoc = documentStore.getDocumentById(orgId, docId);
      expect(updatedDoc?.checksum).toBe(ver2.checksum);
      expect(updatedDoc?.storageKey).toBe(ver2.storageKey);
      expect(updatedDoc?.fileSize).toBe(ver2.fileSize);

      const docVersions = documentStore.getDocumentVersions(orgId, docId);
      expect(docVersions.length).toBe(2);
      expect(docVersions[0].versionNumber).toBe(2);
    });

    it('downloads document file buffer and generates valid signed token URLs', async () => {
      const testContent = Buffer.from(`%PDF-1.4 Downloadable File Content ${Date.now()}`);
      const upload = await documentUploadService.uploadDocument(adminUser, {
        buffer: testContent,
        originalFileName: 'download-me.pdf',
        declaredMimeType: 'application/pdf',
      });
      const docId = upload.document!.id;

      // Download directly
      const download = await documentUploadService.downloadDocumentFile(adminUser, docId);
      expect(download.fileName).toBe('download-me.pdf');
      expect(download.mimeType).toBe('application/pdf');
      expect(download.buffer.toString('utf-8')).toBe(testContent.toString('utf-8'));

      // Generate signed URL
      const signedResult = await documentUploadService.getSignedDownloadUrl(adminUser, docId);
      expect(signedResult.url).toContain('/api/documents/files/download?token=');

      // Verify download using signed token (without session cookies)
      const token = new URL(signedResult.url, 'http://localhost:3000').searchParams.get('token')!;
      const tokenDownload = await documentUploadService.downloadBySignedToken(token);
      expect(tokenDownload.fileName).toBe('download-me.pdf');
      expect(tokenDownload.buffer.toString('utf-8')).toBe(testContent.toString('utf-8'));
    });
  });

  describe('Tenant Isolation Enforcement', () => {
    it('strictly prevents cross-tenant file downloads and signed URL generation', async () => {
      // Create document in Tenant A (adminUser)
      const orgAFile = Buffer.from(`%PDF-1.4 Confidential Tenant A Data ${Date.now()}`);
      const uploadA = await documentUploadService.uploadDocument(adminUser, {
        buffer: orgAFile,
        originalFileName: 'tenant-a-secrets.pdf',
        declaredMimeType: 'application/pdf',
      });
      const docAId = uploadA.document!.id;

      // Attempt to download Org A's document using Tenant B's credentials
      await expect(
        documentUploadService.downloadDocumentFile(otherOrgUser, docAId)
      ).rejects.toThrow(NotFoundError);

      // Attempt to generate signed URL for Org A's document using Tenant B's credentials
      await expect(
        documentUploadService.getSignedDownloadUrl(otherOrgUser, docAId)
      ).rejects.toThrow(NotFoundError);

      // Attempt to upload new version to Org A's document using Tenant B's credentials
      const evilPdf = Buffer.from(`%PDF-1.4 Tampered Data`);
      await expect(
        documentUploadService.uploadNewVersion(otherOrgUser, docAId, {
          buffer: evilPdf,
          originalFileName: 'tampered.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
