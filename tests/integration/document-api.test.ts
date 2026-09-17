import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2A: Documents & Folders API End-to-End Integration', () => {
  let adminToken = '';
  let employeeToken = '';
  let createdFolderId = '';
  let createdDocId = '';
  let createdTypeId = '';
  let createdTagId = '';

  beforeAll(async () => {
    // Login as Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });
    adminToken = adminLogin.body.data.token;

    // Login as Employee
    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@demo.local', password: 'Password123!' });
    employeeToken = empLogin.body.data.token;
  });

  describe('Folders REST API', () => {
    it('POST /api/folders - creates new root folder', async () => {
      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `API-Test-Folder-${Date.now()}` });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdFolderId = res.body.data.id;
    });

    it('GET /api/folders - lists folders in organization', async () => {
      const res = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((f: { id: string }) => f.id === createdFolderId)).toBe(true);
    });

    it('PATCH /api/folders/:id/rename - renames folder', async () => {
      const newName = `Renamed-Folder-${Date.now()}`;
      const res = await request(app)
        .patch(`/api/folders/${createdFolderId}/rename`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: newName });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(newName);
    });

    it('POST /api/folders - fails on invalid name schema', async () => {
      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Document Types & Tags REST API', () => {
    it('POST /api/document-types - defines new document type', async () => {
      const res = await request(app)
        .post('/api/document-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Purchase Order ${Date.now()}`,
          description: 'Official purchase orders for vendor contracts',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdTypeId = res.body.data.id;
    });

    it('POST /api/document-types/:id/fields - adds field definition', async () => {
      const res = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'PO Number',
          key: 'poNumber',
          type: 'TEXT',
          required: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.key).toBe('poNumber');
    });

    it('POST /api/tags - creates a tag and GET /api/tags lists it', async () => {
      const tagName = `Priority-${Date.now()}`;
      const createRes = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: tagName });

      expect(createRes.status).toBe(201);
      createdTagId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t: { id: string }) => t.id === createdTagId)).toBe(true);
    });
  });

  describe('Documents REST API & Versioning', () => {
    it('POST /api/documents - registers document record', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Annual Security Report 2026',
          originalFileName: 'security-2026.pdf',
          mimeType: 'application/pdf',
          fileSize: 524288,
          storageKey: 'org-demo-corp/docs/sec-2026.pdf',
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          folderId: createdFolderId,
          documentTypeId: createdTypeId,
          description: 'Company-wide security audit',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Annual Security Report 2026');
      createdDocId = res.body.data.id;
    });

    it('GET /api/documents/:id - fetches document details', async () => {
      const res = await request(app)
        .get(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdDocId);
    });

    it('POST /api/documents/:id/versions - adds version 2', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileName: 'security-2026-revised.pdf',
          mimeType: 'application/pdf',
          fileSize: 600000,
          storageKey: 'org-demo-corp/docs/sec-2026-v2.pdf',
          checksum: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          changeDescription: 'Added SOC2 compliance addendum',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.versionNumber).toBe(2);
    });

    it('GET /api/documents/:id/versions - lists versions', async () => {
      const res = await request(app)
        .get(`/api/documents/${createdDocId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('POST /api/documents/:id/versions/1/restore - restores earlier version as version 3', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/versions/1/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.versionNumber).toBe(3);
      expect(res.body.data.fileName).toBe('security-2026.pdf');
    });

    it('POST /api/documents/:id/tags - assigns tag to document', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tagId: createdTagId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/documents/:id/copy - duplicates document record', async () => {
      const res = await request(app)
        .post(`/api/documents/${createdDocId}/copy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newName: 'Copy of Security Report' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Copy of Security Report');
      expect(res.body.data.id).not.toBe(createdDocId);
    });

    it('DELETE /api/documents/:id - soft deletes document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Subsequent get returns 404
      const getRes = await request(app)
        .get(`/api/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Unauthorized and Unauthenticated Access Rejection', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
    });
  });
});
