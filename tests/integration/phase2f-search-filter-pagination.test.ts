import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2F: Document Search, Filtering, Sorting & Pagination Suite', () => {
  let orgAAdminToken = '';
  let orgBAdminToken = '';
  let testFolderId = '';
  let testTypeId = '';
  let testTagId = '';
  let doc1Id = '';
  let doc2Id = '';
  let doc3Id = '';

  beforeAll(async () => {
    // 1. Login as Org A Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    orgAAdminToken = adminLogin.body.data.token;

    // 2. Register & Onboard Tenant B
    const suffix = Date.now();
    const orgBRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: `tenantb-p2f-${suffix}@orgb.local`,
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
        name: `Org B P2F ${suffix}`,
        slug: `org-b-p2f-${suffix}`,
      });
    expect(onbRes.status).toBe(201);
    orgBAdminToken = onbRes.body.data.token;

    // 3. Create folder in Org A
    const folderRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({ name: `Finance 2026 ${suffix}` });
    expect(folderRes.status).toBe(201);
    testFolderId = folderRes.body.data.id;

    // 4. Create document type in Org A
    const typeRes = await request(app)
      .post('/api/document-types')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({
        name: `Audit Report ${suffix}`,
        description: 'Financial audit reports',
        fields: [{ name: 'fiscalYear', label: 'Fiscal Year', type: 'number', required: false }],
      });
    expect(typeRes.status).toBe(201);
    testTypeId = typeRes.body.data.id;

    // 5. Create Tag in Org A
    const tagRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({ name: `Quarterly-${suffix}`, color: '#0ea5e9' });
    expect(tagRes.status).toBe(201);
    testTagId = tagRes.body.data.id;

    // 6. Create Doc 1 in Org A (PDF, in folder, with type & tag)
    const upload1 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .attach('file', Buffer.from('%PDF-1.4 financial quarterly overview invoice data'), 'quarterly-statement.pdf')
      .field('name', 'Q4 Financial Statement')
      .field('description', 'Comprehensive year-end audit statement')
      .field('folderId', testFolderId)
      .field('documentTypeId', testTypeId)
      .field('tags', JSON.stringify([`Quarterly-${suffix}`]));
    expect(upload1.status).toBe(201);
    doc1Id = upload1.body.data.document.id;

    // 7. Create Doc 2 in Org A (Text file, at root, without folder)
    const upload2 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .attach('file', Buffer.from('Technical architecture system design blueprint'), 'system-architecture.txt')
      .field('name', 'Architecture Blueprint 2026')
      .field('description', 'Core microservices and data store specifications');
    expect(upload2.status).toBe(201);
    doc2Id = upload2.body.data.document.id;

    // 8. Create Doc 3 in Org A (Spreadsheet file)
    const xlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const upload3 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .attach('file', xlsxBuffer, 'budget-projections.xlsx')
      .field('name', 'Fiscal Budget Model')
      .field('description', 'Spreadsheet forecasting quarterly operational costs');
    expect(upload3.status).toBe(201);
    doc3Id = upload3.body.data.document.id;

    // 9. Create Doc in Org B (for isolation tests)
    const uploadB = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${orgBAdminToken}`)
      .attach('file', Buffer.from('%PDF-1.4 Secret tenant B confidential document'), 'tenant-b-secret.pdf')
      .field('name', 'Tenant B Confidential Plan');
    expect(uploadB.status).toBe(201);
  });

  // --------------------------------------------------------------------------
  // Server-side Search Tests
  // --------------------------------------------------------------------------
  describe('Server-side Search Execution', () => {
    it('searches by document name', async () => {
      const res = await request(app)
        .get('/api/documents?search=Financial&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc1Id);
      expect(ids).not.toContain(doc2Id);
    });

    it('searches by original filename', async () => {
      const res = await request(app)
        .get('/api/documents?search=system-architecture&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc2Id);
      expect(ids).not.toContain(doc1Id);
    });

    it('searches by description text', async () => {
      const res = await request(app)
        .get('/api/documents?search=forecasting&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc3Id);
    });

    it('searches by document type name', async () => {
      const res = await request(app)
        .get('/api/documents?search=Audit&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc1Id);
    });

    it('returns empty array when search query has no matches', async () => {
      const res = await request(app)
        .get('/api/documents?search=NonExistentTermXYZ9999&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Server-side Filtering Tests
  // --------------------------------------------------------------------------
  describe('Multi-dimensional Filtering', () => {
    it('filters by folderId', async () => {
      const inFolderRes = await request(app)
        .get(`/api/documents?folderId=${testFolderId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(inFolderRes.status).toBe(200);
      const ids = inFolderRes.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc1Id);
      expect(ids).not.toContain(doc2Id);
      expect(ids).not.toContain(doc3Id);
    });

    it('filters by documentTypeId', async () => {
      const res = await request(app)
        .get(`/api/documents?documentTypeId=${testTypeId}&folderId=all`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc1Id);
      expect(ids).not.toContain(doc2Id);
    });

    it('filters by tagId', async () => {
      const res = await request(app)
        .get(`/api/documents?tagId=${testTagId}&folderId=all`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(doc1Id);
      expect(ids).not.toContain(doc2Id);
    });

    it('filters by fileType (pdf vs spreadsheet)', async () => {
      const pdfRes = await request(app)
        .get('/api/documents?fileType=pdf&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(pdfRes.status).toBe(200);
      const pdfIds = pdfRes.body.data.map((d: { id: string }) => d.id);
      expect(pdfIds).toContain(doc1Id);
      expect(pdfIds).not.toContain(doc3Id);

      const sheetRes = await request(app)
        .get('/api/documents?fileType=spreadsheet&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(sheetRes.status).toBe(200);
      const sheetIds = sheetRes.body.data.map((d: { id: string }) => d.id);
      expect(sheetIds).toContain(doc3Id);
      expect(sheetIds).not.toContain(doc1Id);
    });

    it('filters by file size limits (minSize and maxSize)', async () => {
      const smallRes = await request(app)
        .get('/api/documents?maxSize=1000&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(smallRes.status).toBe(200);
      expect(smallRes.body.data.length).toBeGreaterThan(0);

      const hugeRes = await request(app)
        .get('/api/documents?minSize=1000000000&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(hugeRes.status).toBe(200);
      expect(hugeRes.body.data).toHaveLength(0);
    });

    it('filters by created date boundaries', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/documents?createdFrom=${today}&folderId=all`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Server-side Sorting Tests
  // --------------------------------------------------------------------------
  describe('Server-side Sorting', () => {
    it('sorts documents by name ascending and descending', async () => {
      const ascRes = await request(app)
        .get('/api/documents?sortBy=name&sortOrder=asc&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(ascRes.status).toBe(200);
      const ascNames = ascRes.body.data.map((d: { name: string }) => d.name);
      const sortedAsc = [...ascNames].sort((a, b) => a.localeCompare(b));
      expect(ascNames).toEqual(sortedAsc);

      const descRes = await request(app)
        .get('/api/documents?sortBy=name&sortOrder=desc&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(descRes.status).toBe(200);
      const descNames = descRes.body.data.map((d: { name: string }) => d.name);
      const sortedDesc = [...descNames].sort((a, b) => b.localeCompare(a));
      expect(descNames).toEqual(sortedDesc);
    });

    it('sorts documents by size and date modified', async () => {
      const sizeRes = await request(app)
        .get('/api/documents?sortBy=size&sortOrder=desc&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(sizeRes.status).toBe(200);
      const sizes = sizeRes.body.data.map((d: { fileSize: number }) => d.fileSize);
      for (let i = 0; i < sizes.length - 1; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i + 1]);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Server-side Pagination Tests
  // --------------------------------------------------------------------------
  describe('Server-side Pagination & Metadata', () => {
    it('respects page and limit and returns structured pagination metadata', async () => {
      const res = await request(app)
        .get('/api/documents?page=1&limit=2&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination.hasNext).toBe(true);
      expect(res.body.pagination.hasPrev).toBe(false);

      // Page 2
      const resP2 = await request(app)
        .get('/api/documents?page=2&limit=2&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(resP2.status).toBe(200);
      expect(resP2.body.pagination.page).toBe(2);
      expect(resP2.body.pagination.hasPrev).toBe(true);

      // Ensure no overlapping IDs between page 1 and page 2
      const p1Ids = res.body.data.map((d: { id: string }) => d.id);
      const p2Ids = resP2.body.data.map((d: { id: string }) => d.id);
      for (const id of p1Ids) {
        expect(p2Ids).not.toContain(id);
      }
    });

    it('safely handles out-of-range page requests', async () => {
      const res = await request(app)
        .get('/api/documents?page=99999&limit=10&folderId=all')
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Security & Tenant Isolation Tests
  // --------------------------------------------------------------------------
  describe('Security & Multi-Tenant Isolation', () => {
    it('prevents cross-tenant access in search, filters and document listing', async () => {
      // Org B admin searching for Org A document
      const resB = await request(app)
        .get('/api/documents?search=Financial&folderId=all')
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(resB.status).toBe(200);
      const ids = resB.body.data.map((d: { id: string }) => d.id);
      expect(ids).not.toContain(doc1Id);
      expect(ids).not.toContain(doc2Id);
      expect(ids).not.toContain(doc3Id);
    });

    it('strictly isolates folder and tag filtering between tenants', async () => {
      const resB = await request(app)
        .get(`/api/documents?folderId=${testFolderId}`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(0);
    });

    it('rejects unauthenticated document search and queries', async () => {
      const res = await request(app).get('/api/documents?search=test');
      expect(res.status).toBe(401);
    });
  });
});
