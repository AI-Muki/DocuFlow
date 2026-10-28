import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2E: Document History & Collaboration Integration Suite', () => {
  let orgAAdminToken = '';
  let orgAEmployeeToken = '';
  let orgBAdminToken = '';
  let documentId = '';

  beforeAll(async () => {
    // 1. Login as Org A Admin (has documents.delete, documents.update, documents.read, documents.create)
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    orgAAdminToken = adminLogin.body.data.token;

    // 2. Login as Org A Employee (has documents.read, documents.create; lacks documents.delete, documents.update)
    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@demo.local', password: 'Password123!' });
    expect(empLogin.status).toBe(200);
    orgAEmployeeToken = empLogin.body.data.token;

    // 3. Register and onboard Org B tenant
    const suffix = Date.now();
    const orgBRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: `tenantb-admin-${suffix}@orgb.local`,
        password: 'Password123!',
        firstName: 'TenantB',
        lastName: 'Admin',
      });
    expect(orgBRegister.status).toBe(201);
    const initialBToken = orgBRegister.body.data.token;

    const onbRes = await request(app)
      .post('/api/auth/onboarding/organization')
      .set('Authorization', `Bearer ${initialBToken}`)
      .send({
        name: `Organization B ${suffix}`,
        slug: `org-b-${suffix}`,
      });
    expect(onbRes.status).toBe(201);
    orgBAdminToken = onbRes.body.data.token;

    // 4. Create initial document in Org A (Version 1)
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .attach('file', Buffer.from('Initial Version 1 text content'), 'proposal-v1.txt')
      .field('name', 'Contract Proposal 2026');
    expect(uploadRes.status).toBe(201);
    documentId = uploadRes.body.data.document.id;
  });

  // ====================================================================
  // 1. VERSIONING (v1, v2, v3, never overwrite previous versions)
  // ====================================================================
  describe('1. Document Versioning', () => {
    it('initial upload created version 1 with accurate metadata', async () => {
      const verRes = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(verRes.status).toBe(200);
      expect(verRes.body.success).toBe(true);
      expect(verRes.body.data.length).toBe(1);

      const v1 = verRes.body.data[0];
      expect(v1.versionNumber).toBe(1);
      expect(v1.fileName).toBe('proposal-v1.txt');
      expect(v1.fileSize).toBeGreaterThan(0);
      expect(v1.uploadedById).toBeDefined();
      expect(v1.createdAt).toBeDefined();
    });

    it('uploads replacement file to create version 2 without overwriting v1', async () => {
      const v2Res = await request(app)
        .post(`/api/documents/${documentId}/versions/upload`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .attach('file', Buffer.from('Revised Version 2 content with updated pricing table'), 'proposal-v2.txt')
        .field('changeDescription', 'Updated pricing terms for Q2');

      expect(v2Res.status).toBe(201);
      expect(v2Res.body.success).toBe(true);
      expect(v2Res.body.data.versionNumber).toBe(2);
      expect(v2Res.body.data.fileName).toBe('proposal-v2.txt');
      expect(v2Res.body.data.changeDescription).toBe('Updated pricing terms for Q2');

      // Verify list has both v1 and v2, and v1 was never overwritten
      const verListRes = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(verListRes.status).toBe(200);
      expect(verListRes.body.data.length).toBe(2);

      const v2 = verListRes.body.data.find((v: { versionNumber: number }) => v.versionNumber === 2);
      const v1 = verListRes.body.data.find((v: { versionNumber: number }) => v.versionNumber === 1);

      expect(v2).toBeDefined();
      expect(v1).toBeDefined();
      expect(v1.fileName).toBe('proposal-v1.txt');
      expect(v2.fileName).toBe('proposal-v2.txt');
      expect(v1.storageKey).not.toBe(v2.storageKey);
    });

    it('uploads third replacement file to create version 3', async () => {
      const v3Res = await request(app)
        .post(`/api/documents/${documentId}/versions/upload`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .attach('file', Buffer.from('Final Version 3 content approved by legal counsel'), 'proposal-v3.txt')
        .field('changeDescription', 'Legal compliance amendments');

      expect(v3Res.status).toBe(201);
      expect(v3Res.body.data.versionNumber).toBe(3);

      const verListRes = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(verListRes.body.data.length).toBe(3);
      const numbers = verListRes.body.data.map((v: { versionNumber: number }) => v.versionNumber);
      expect(numbers).toContain(1);
      expect(numbers).toContain(2);
      expect(numbers).toContain(3);
    });

    it('allows downloading specific versions independently', async () => {
      // Download v1
      const dlV1 = await request(app)
        .get(`/api/documents/${documentId}/download?version=1`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(dlV1.status).toBe(200);
      expect(dlV1.text).toContain('Initial Version 1');

      // Download v2 via sub-route
      const dlV2 = await request(app)
        .get(`/api/documents/${documentId}/versions/2/download`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(dlV2.status).toBe(200);
      expect(dlV2.text).toContain('Revised Version 2 content');

      // Download v3 (latest)
      const dlLatest = await request(app)
        .get(`/api/documents/${documentId}/download`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(dlLatest.status).toBe(200);
      expect(dlLatest.text).toContain('Final Version 3 content');
    });

    it('allows previewing specific versions via text-content or preview route', async () => {
      const prevV1 = await request(app)
        .get(`/api/documents/${documentId}/text-content?version=1`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(prevV1.status).toBe(200);
      expect(prevV1.body.data.text).toContain('Initial Version 1');

      const prevV2 = await request(app)
        .get(`/api/documents/${documentId}/versions/2/preview`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(prevV2.status).toBe(200);
      expect(prevV2.text).toContain('Revised Version 2');
    });
  });

  // ====================================================================
  // 2. RESTORE VERSION (v1 restored while v3 is current -> creates v4, keeps v2/v3)
  // ====================================================================
  describe('2. Version Restoration', () => {
    it('restores v1 when v3 is current: creates v4 copy of v1 and preserves v2 & v3', async () => {
      const restoreRes = await request(app)
        .post(`/api/documents/${documentId}/versions/1/restore`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);

      const v4 = restoreRes.body.data;
      expect(v4.versionNumber).toBe(4);
      expect(v4.fileName).toBe('proposal-v1.txt');
      expect(v4.changeDescription).toContain('Restored from version 1');

      // Check all 4 versions exist in history
      const listRes = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(listRes.body.data.length).toBe(4);
      const versionNumbers = listRes.body.data.map((v: { versionNumber: number }) => v.versionNumber);
      expect(versionNumbers).toContain(1);
      expect(versionNumbers).toContain(2);
      expect(versionNumbers).toContain(3);
      expect(versionNumbers).toContain(4);

      // Verify current document file now serves v4 (which matches v1 contents)
      const dlRes = await request(app)
        .get(`/api/documents/${documentId}/download`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(dlRes.status).toBe(200);
      expect(dlRes.text).toContain('Initial Version 1');
    });

    it('rejects restoring a non-existent version number', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/versions/99/restore`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ====================================================================
  // 3. COMMENTS (add, edit own, delete own, view comments, permissions)
  // ====================================================================
  describe('3. Comments System', () => {
    let adminCommentId = '';
    let empCommentId = '';

    it('adds comment and returns user details and timestamp', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ content: 'Initial review note by Admin.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Initial review note by Admin.');
      expect(res.body.data.userName).toBeDefined();
      expect(res.body.data.userEmail).toBe('admin@demo.local');
      expect(res.body.data.createdAt).toBeDefined();

      adminCommentId = res.body.data.id;
    });

    it('employee can add their own comment', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`)
        .send({ content: 'Employee feedback: looks good to proceed.' });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('Employee feedback: looks good to proceed.');
      expect(res.body.data.userEmail).toBe('employee@demo.local');

      empCommentId = res.body.data.id;
    });

    it('lists all comments on the document in chronological order', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].id).toBe(adminCommentId);
      expect(res.body.data[1].id).toBe(empCommentId);
    });

    it('allows a user to edit their own comment', async () => {
      const editRes = await request(app)
        .put(`/api/documents/${documentId}/comments/${adminCommentId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ content: 'Updated review note by Admin (revised terms).' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.success).toBe(true);
      expect(editRes.body.data.content).toBe('Updated review note by Admin (revised terms).');
      expect(editRes.body.data.updatedAt).toBeDefined();
    });

    it('prevents a user from editing someone elses comment', async () => {
      const invalidEdit = await request(app)
        .put(`/api/documents/${documentId}/comments/${adminCommentId}`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`)
        .send({ content: 'Attempt to tamper with admin comment.' });

      expect(invalidEdit.status).toBe(403);
      expect(invalidEdit.body.success).toBe(false);
    });

    it('prevents a user from deleting someone elses comment', async () => {
      const invalidDel = await request(app)
        .delete(`/api/documents/${documentId}/comments/${adminCommentId}`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);

      expect(invalidDel.status).toBe(403);
      expect(invalidDel.body.success).toBe(false);
    });

    it('allows a user to delete their own comment', async () => {
      const delRes = await request(app)
        .delete(`/api/documents/${documentId}/comments/${empCommentId}`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify comment is removed
      const checkRes = await request(app)
        .get(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(checkRes.body.data.length).toBe(1);
      expect(checkRes.body.data[0].id).toBe(adminCommentId);
    });
  });

  // ====================================================================
  // 4. ACTIVITY TIMELINE (Uploaded, Renamed, Moved, Downloaded, Version created/restored, Comment added, Deleted, Restored)
  // ====================================================================
  describe('4. Activity Timeline', () => {
    it('retrieves activity timeline reusing AuditLog infrastructure', async () => {
      // Perform a rename and move to generate activity events
      await request(app)
        .put(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ name: 'Renamed Proposal 2026' });

      const actRes = await request(app)
        .get(`/api/documents/${documentId}/activity`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(actRes.status).toBe(200);
      expect(actRes.body.success).toBe(true);
      expect(Array.isArray(actRes.body.data)).toBe(true);
      expect(actRes.body.data.length).toBeGreaterThanOrEqual(4);

      const actions = actRes.body.data.map((l: { action: string }) => l.action);
      // Timeline should contain upload, download, version creation/restoration, comments, renaming
      expect(actions.some((a: string) => a.includes('upload') || a.includes('created'))).toBe(true);
      expect(actions.some((a: string) => a.includes('version'))).toBe(true);
      expect(actions.some((a: string) => a.includes('comment'))).toBe(true);
      expect(actions.some((a: string) => a.includes('download'))).toBe(true);
      expect(actions.some((a: string) => a.includes('renamed'))).toBe(true);

      // Verify logs have timestamp and actor info
      const firstLog = actRes.body.data[0];
      expect(firstLog.createdAt).toBeDefined();
      expect(firstLog.userEmail || firstLog.userName).toBeDefined();
    });
  });

  // ====================================================================
  // 5. TRASH, SOFT-DELETE, RESTORE & PERMANENT DELETE PERMISSIONS
  // ====================================================================
  describe('5. Trash & Restore Lifecycle', () => {
    let trashDocId = '';

    beforeAll(async () => {
      // Create a document specifically for trash testing
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Temporary Trash Test Doc',
          originalFileName: 'temp-trash.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
          storageKey: 'trash-test-key-1',
          checksum: 'hash-trash-1234',
        });
      trashDocId = res.body.data.id;
    });

    it('employee without documents.delete cannot soft-delete a document', async () => {
      const empDel = await request(app)
        .delete(`/api/documents/${trashDocId}`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);

      expect(empDel.status).toBe(403);
    });

    it('admin with documents.delete soft-deletes a document', async () => {
      const delRes = await request(app)
        .delete(`/api/documents/${trashDocId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify no longer appears in normal active list
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      const ids = listRes.body.data.map((d: { id: string }) => d.id);
      expect(ids).not.toContain(trashDocId);
    });

    it('shows deleted document in Trash view with deletedBy, deletedAt, and folder', async () => {
      const trashRes = await request(app)
        .get('/api/documents?view=trash')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(trashRes.status).toBe(200);
      const trashDocs = trashRes.body.data;
      const found = trashDocs.find((d: { id: string }) => d.id === trashDocId);

      expect(found).toBeDefined();
      expect(found.deletedAt).toBeDefined();
      expect(found.deletedById).toBeDefined();
      expect(found.deletedBy).toBeDefined();
      expect(found.status).toBe('DELETED');
    });

    it('blocks actions on soft-deleted documents (cannot add comments or versions)', async () => {
      const commentRes = await request(app)
        .post(`/api/documents/${trashDocId}/comments`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ content: 'Trying to comment on trash doc' });

      expect(commentRes.status).toBe(404);

      const verRes = await request(app)
        .post(`/api/documents/${trashDocId}/versions`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          fileName: 'new.pdf',
          mimeType: 'application/pdf',
          fileSize: 100,
          storageKey: 'key',
          checksum: 'sum',
        });

      expect(verRes.status).toBe(404);
    });

    it('employee without documents.delete cannot restore a document from trash', async () => {
      const empRest = await request(app)
        .post(`/api/documents/${trashDocId}/restore`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);

      expect(empRest.status).toBe(403);
    });

    it('admin restores a soft-deleted document back to active workspace', async () => {
      const restoreRes = await request(app)
        .post(`/api/documents/${trashDocId}/restore`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.data.status).toBe('ACTIVE');
      expect(restoreRes.body.data.deletedAt).toBeNull();

      // Now appears back in regular list
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      const ids = listRes.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(trashDocId);
    });

    it('employee without documents.delete cannot permanently delete a document', async () => {
      const empPurge = await request(app)
        .delete(`/api/documents/${trashDocId}/permanent`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);

      expect(empPurge.status).toBe(403);
    });

    it('admin permanently purges a document with appropriate permission', async () => {
      const purgeRes = await request(app)
        .delete(`/api/documents/${trashDocId}/permanent`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(purgeRes.status).toBe(200);
      expect(purgeRes.body.success).toBe(true);

      // Verify completely purged from regular list, trash view, and direct fetch
      const directGet = await request(app)
        .get(`/api/documents/${trashDocId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(directGet.status).toBe(404);

      const trashCheck = await request(app)
        .get('/api/documents?view=trash')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      const trashIds = trashCheck.body.data.map((d: { id: string }) => d.id);
      expect(trashIds).not.toContain(trashDocId);
    });
  });

  // ====================================================================
  // 6. TENANT ISOLATION
  // ====================================================================
  describe('6. Strict Tenant Isolation', () => {
    it('Tenant B cannot view versions of Tenant A document', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot download versions of Tenant A document', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/download?version=1`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot restore version of Tenant A document', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/versions/1/restore`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot view or add comments to Tenant A document', async () => {
      const viewRes = await request(app)
        .get(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);
      expect(viewRes.status).toBe(404);

      const addRes = await request(app)
        .post(`/api/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${orgBAdminToken}`)
        .send({ content: 'Cross-tenant illegal comment attempt' });
      expect(addRes.status).toBe(404);
    });

    it('Tenant B cannot view activity timeline of Tenant A document', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/activity`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Tenant B cannot see Tenant A documents in trash', async () => {
      // Soft-delete document in Org A
      await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      // Tenant B queries trash
      const res = await request(app)
        .get('/api/documents?view=trash')
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(200);
      const bTrashIds = res.body.data.map((d: { id: string }) => d.id);
      expect(bTrashIds).not.toContain(documentId);

      // Tenant B cannot restore or permanently delete Org A doc
      const restoreRes = await request(app)
        .post(`/api/documents/${documentId}/restore`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);
      expect(restoreRes.status).toBe(404);

      const purgeRes = await request(app)
        .delete(`/api/documents/${documentId}/permanent`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);
      expect(purgeRes.status).toBe(404);
    });
  });
});
