import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2F: Complete Document Management Lifecycle & Verification Flow', () => {
  let orgAToken = '';
  let orgBToken = '';
  let folderAId = '';
  let folderBId = '';
  let documentId = '';
  let documentTypeId = '';
  let tagId = '';
  const timestamp = Date.now();

  beforeAll(async () => {
    // Step 1: Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    orgAToken = loginRes.body.data.token;

    // Register & Onboard Tenant B for cross-tenant isolation testing
    const regB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `tenantb-lifecycle-${timestamp}@demo.local`,
        password: 'Password123!',
        firstName: 'TenantB',
        lastName: 'Manager',
      });
    expect(regB.status).toBe(201);

    const onbB = await request(app)
      .post('/api/auth/onboarding/organization')
      .set('Authorization', `Bearer ${regB.body.data.token}`)
      .send({
        name: `Tenant B Workspace ${timestamp}`,
        slug: `tenant-b-${timestamp}`,
      });
    expect(onbB.status).toBe(201);
    orgBToken = onbB.body.data.token;
  });

  it('Step 2: Access Documents Explorer', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('Step 3: Create Folder (and target folder for later move)', async () => {
    const res1 = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: `Contracts ${timestamp}` });
    expect(res1.status).toBe(201);
    folderAId = res1.body.data.id;

    const res2 = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: `Archive Vault ${timestamp}` });
    expect(res2.status).toBe(201);
    folderBId = res2.body.data.id;
  });

  it('Step 4: Upload Document into Folder with Schema Metadata and Tags', async () => {
    // First create a document type
    const typeRes = await request(app)
      .post('/api/document-types')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        name: `Legal Agreement ${timestamp}`,
        description: 'Vendor and client agreements',
        fields: [
          { name: 'contractValue', label: 'Contract Value', type: 'number', required: false },
          { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: false },
        ],
      });
    expect(typeRes.status).toBe(201);
    documentTypeId = typeRes.body.data.id;

    // Create a tag
    const tagRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: `Critical-${timestamp}`, color: '#ef4444' });
    expect(tagRes.status).toBe(201);
    tagId = tagRes.body.data.id;

    // Upload
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('file', Buffer.from('%PDF-1.4 Master Service Agreement terms and conditions clauses'), 'msa-agreement.pdf')
      .field('name', `Master Service Agreement ${timestamp}`)
      .field('description', 'Master legal agreement for enterprise client')
      .field('folderId', folderAId)
      .field('documentTypeId', documentTypeId)
      .field('tags', JSON.stringify([`Critical-${timestamp}`]))
      .field('metadata', JSON.stringify({ contractValue: 75000, jurisdiction: 'Delaware' }));

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.document).toBeDefined();
    documentId = uploadRes.body.data.document.id;
  });

  it('Step 5: Browse Folder', async () => {
    const res = await request(app)
      .get(`/api/documents?folderId=${folderAId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(res.status).toBe(200);
    const docIds = res.body.data.map((d: { id: string }) => d.id);
    expect(docIds).toContain(documentId);
  });

  it('Step 6: Search Document across filename, name and description', async () => {
    const searchRes = await request(app)
      .get(`/api/documents?search=Agreement&folderId=all`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(searchRes.status).toBe(200);
    const docIds = searchRes.body.data.map((d: { id: string }) => d.id);
    expect(docIds).toContain(documentId);
  });

  it('Step 7: Multi-parameter Filter Document', async () => {
    const filterRes = await request(app)
      .get(`/api/documents?documentTypeId=${documentTypeId}&tagId=${tagId}&fileType=pdf&folderId=all`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(filterRes.status).toBe(200);
    const docIds = filterRes.body.data.map((d: { id: string }) => d.id);
    expect(docIds).toContain(documentId);
  });

  it('Step 8: Open Document by ID', async () => {
    const openRes = await request(app)
      .get(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(openRes.status).toBe(200);
    expect(openRes.body.data.id).toBe(documentId);
    expect(openRes.body.data.versions).toHaveLength(1);
  });

  it('Step 9: Preview Document File Content', async () => {
    const previewRes = await request(app)
      .get(`/api/documents/${documentId}/preview`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers['content-type']).toContain('application/pdf');
    expect(previewRes.body.length).toBeGreaterThan(0);
  });

  it('Step 10: Update Metadata with Schema Validation', async () => {
    const metaRes = await request(app)
      .put(`/api/documents/${documentId}/metadata`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        metadata: {
          contractValue: 95000,
          jurisdiction: 'New York',
        },
      });
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.data.contractValue).toBe(95000);
    expect(metaRes.body.data.jurisdiction).toBe('New York');
  });

  it('Step 11: Manage Tags (Add and Remove)', async () => {
    // Create second tag
    const tag2Res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ name: `Signed-${timestamp}`, color: '#22c55e' });
    expect(tag2Res.status).toBe(201);
    const tag2Id = tag2Res.body.data.id;

    // Assign tag
    const assignRes = await request(app)
      .post(`/api/documents/${documentId}/tags`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ tagId: tag2Id });
    expect(assignRes.status).toBe(200);

    // Remove first tag
    const removeRes = await request(app)
      .delete(`/api/documents/${documentId}/tags/${tagId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(removeRes.status).toBe(200);
  });

  it('Step 12: Upload New Version & Restore Previous Version', async () => {
    // Upload Version 2
    const verRes = await request(app)
      .post(`/api/documents/${documentId}/versions/upload`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .attach('file', Buffer.from('%PDF-1.4 Version 2 fully executed countersigned agreement'), 'msa-executed-v2.pdf')
      .field('changeDescription', 'Countersigned by client CEO');
    expect(verRes.status).toBe(201);
    expect(verRes.body.data.versionNumber).toBe(2);

    // Verify versions list has both v1 and v2
    const listVerRes = await request(app)
      .get(`/api/documents/${documentId}/versions`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(listVerRes.status).toBe(200);
    expect(listVerRes.body.data).toHaveLength(2);

    // Restore Version 1
    const restoreRes = await request(app)
      .post(`/api/documents/${documentId}/versions/1/restore`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.versionNumber).toBe(3);
  });

  it('Step 13: Add and List Comments', async () => {
    const commentRes = await request(app)
      .post(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ content: 'Legal review completed and approved.' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.data.content).toBe('Legal review completed and approved.');

    const listRes = await request(app)
      .get(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });

  it('Step 14: Inspect Activity Audit Trail', async () => {
    const actRes = await request(app)
      .get(`/api/documents/${documentId}/activity`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(actRes.status).toBe(200);
    expect(Array.isArray(actRes.body.data)).toBe(true);
    expect(actRes.body.data.length).toBeGreaterThan(0);
  });

  it('Step 15: Move Document to Another Folder', async () => {
    const moveRes = await request(app)
      .patch(`/api/documents/${documentId}/move`)
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({ targetFolderId: folderBId });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.folderId).toBe(folderBId);

    // Verify folder B has the document and folder A no longer does
    const fARes = await request(app)
      .get(`/api/documents?folderId=${folderAId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(fARes.body.data.map((d: { id: string }) => d.id)).not.toContain(documentId);

    const fBRes = await request(app)
      .get(`/api/documents?folderId=${folderBId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(fBRes.body.data.map((d: { id: string }) => d.id)).toContain(documentId);
  });

  it('Step 16: Soft Delete Document (Move to Trash)', async () => {
    const delRes = await request(app)
      .delete(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(delRes.status).toBe(200);

    // Active explorer should not show it
    const activeRes = await request(app)
      .get('/api/documents?folderId=all')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(activeRes.body.data.map((d: { id: string }) => d.id)).not.toContain(documentId);
  });

  it('Step 17: Browse Trash View', async () => {
    const trashRes = await request(app)
      .get('/api/documents?view=trash')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(trashRes.status).toBe(200);
    const trashIds = trashRes.body.data.map((d: { id: string }) => d.id);
    expect(trashIds).toContain(documentId);
  });

  it('Step 18: Restore Document from Trash', async () => {
    const restoreRes = await request(app)
      .post(`/api/documents/${documentId}/restore`)
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.status).toBe('ACTIVE');

    // Verify back in active explorer
    const activeRes = await request(app)
      .get('/api/documents?folderId=all')
      .set('Authorization', `Bearer ${orgAToken}`);
    expect(activeRes.body.data.map((d: { id: string }) => d.id)).toContain(documentId);
  });

  it('Step 19: Cross-Tenant Isolation Enforcement', async () => {
    // Tenant B cannot retrieve Tenant A document
    const crossGet = await request(app)
      .get(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossGet.status).toBe(404);

    // Tenant B cannot preview Tenant A document
    const crossPrev = await request(app)
      .get(`/api/documents/${documentId}/preview`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossPrev.status).toBe(404);

    // Tenant B cannot download Tenant A document
    const crossDl = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossDl.status).toBe(404);

    // Tenant B cannot read versions
    const crossVer = await request(app)
      .get(`/api/documents/${documentId}/versions`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossVer.status).toBe(404);

    // Tenant B cannot comment on Tenant A document
    const crossComm = await request(app)
      .post(`/api/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({ content: 'Malicious unauthorized comment' });
    expect(crossComm.status).toBe(404);

    // Tenant B cannot delete Tenant A document
    const crossDel = await request(app)
      .delete(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${orgBToken}`);
    expect(crossDel.status).toBe(404);
  });
});
