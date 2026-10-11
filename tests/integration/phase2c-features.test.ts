import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2C: Favorites, Trash, Comments, Activity & Text Viewer Integration', () => {
  let adminToken = '';
  let employeeToken = '';
  let documentId = '';

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

    // Upload a text document for testing
    const textBuffer = Buffer.from('DocuFlow Phase 2C text content verification test.\nLine 2 of test file.');
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', textBuffer, `notes-${Date.now()}.txt`)
      .field('name', `Test Note ${Date.now()}`);

    expect(uploadRes.status).toBe(201);
    documentId = uploadRes.body.data.document.id;
  });

  describe('1. Favorites System', () => {
    it('toggles favorite on and off for a document', async () => {
      // Toggle on
      const favOnRes = await request(app)
        .post(`/api/documents/${documentId}/favorite`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(favOnRes.status).toBe(200);
      expect(favOnRes.body.success).toBe(true);
      expect(favOnRes.body.isFavorite).toBe(true);

      // Verify in favorites view filter
      const listFavsRes = await request(app)
        .get('/api/documents?view=favorites')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listFavsRes.status).toBe(200);
      const favIds = listFavsRes.body.data.map((d: { id: string }) => d.id);
      expect(favIds).toContain(documentId);

      // Toggle off
      const favOffRes = await request(app)
        .post(`/api/documents/${documentId}/favorite`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(favOffRes.status).toBe(200);
      expect(favOffRes.body.isFavorite).toBe(false);

      // Verify no longer in favorites
      const listFavsAfter = await request(app)
        .get('/api/documents?view=favorites')
        .set('Authorization', `Bearer ${adminToken}`);

      const favIdsAfter = listFavsAfter.body.data.map((d: { id: string }) => d.id);
      expect(favIdsAfter).not.toContain(documentId);
    });
  });

  describe('2. Comments Thread', () => {
    let commentId = '';

    it('adds a comment to a document', async () => {
      const commentRes = await request(app)
        .post(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'This is a test review comment for Phase 2C.' });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.success).toBe(true);
      expect(commentRes.body.data.content).toBe('This is a test review comment for Phase 2C.');
      expect(commentRes.body.data.userName).toBeDefined();

      commentId = commentRes.body.data.id;
    });

    it('lists comments for a document', async () => {
      const listRes = await request(app)
        .get(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body.data.some((c: { id: string }) => c.id === commentId)).toBe(true);
    });

    it('deletes a comment from a document', async () => {
      const delRes = await request(app)
        .delete(`/api/documents/${documentId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const listAfter = await request(app)
        .get(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listAfter.body.data.some((c: { id: string }) => c.id === commentId)).toBe(false);
    });
  });

  describe('3. Document Activity Trail', () => {
    it('retrieves chronological audit logs for the document', async () => {
      const actRes = await request(app)
        .get(`/api/documents/${documentId}/activity`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(actRes.status).toBe(200);
      expect(actRes.body.success).toBe(true);
      expect(Array.isArray(actRes.body.data)).toBe(true);
      expect(actRes.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('4. Text Content Viewer', () => {
    it('retrieves text content of the uploaded document', async () => {
      const textRes = await request(app)
        .get(`/api/documents/${documentId}/text-content`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(textRes.status).toBe(200);
      expect(textRes.body.success).toBe(true);
      expect(textRes.body.data.text).toContain('DocuFlow Phase 2C text content verification test.');
      expect(textRes.body.data.fileName).toBeDefined();
    });
  });

  describe('5. Trash, Restore & Permanent Purge', () => {
    let trashDocId = '';

    beforeAll(async () => {
      const tempBuf = Buffer.from('Trash test file buffer');
      const up = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', tempBuf, `trash-${Date.now()}.txt`)
        .field('name', `Doc To Delete ${Date.now()}`);

      trashDocId = up.body.data.document.id;
    });

    it('soft deletes a document into trash', async () => {
      const delRes = await request(app)
        .delete(`/api/documents/${trashDocId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);

      // Should appear in trash view
      const trashRes = await request(app)
        .get('/api/documents?view=trash')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(trashRes.status).toBe(200);
      const ids = trashRes.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(trashDocId);

      // Should not appear in standard list
      const activeRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${adminToken}`);

      const activeIds = activeRes.body.data.map((d: { id: string }) => d.id);
      expect(activeIds).not.toContain(trashDocId);
    });

    it('restores a document from trash', async () => {
      const restoreRes = await request(app)
        .post(`/api/documents/${trashDocId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.data.status).toBe('ACTIVE');

      // Verify it is back in active list
      const activeRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${adminToken}`);

      const activeIds = activeRes.body.data.map((d: { id: string }) => d.id);
      expect(activeIds).toContain(trashDocId);
    });

    it('permanently purges a document', async () => {
      const purgeRes = await request(app)
        .delete(`/api/documents/${trashDocId}/permanent`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(purgeRes.status).toBe(200);
      expect(purgeRes.body.success).toBe(true);

      // Verify it cannot be retrieved even with includeDeleted
      const getRes = await request(app)
        .get(`/api/documents/${trashDocId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
