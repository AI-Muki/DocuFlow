import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2D: Document Organization, Metadata, Custom Fields, Tags, Favorites & Bulk Operations', () => {
  let orgAAdminToken = '';
  let orgAEmployeeToken = '';
  let orgBAdminToken = '';
  let testDoc1Id = '';
  let testDoc2Id = '';
  let createdTypeId = '';
  let createdTagId = '';
  let destinationFolderId = '';

  beforeAll(async () => {
    // 1. Login as Org A Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    orgAAdminToken = adminLogin.body.data.token;

    // 2. Login as Org A Employee
    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@demo.local', password: 'Password123!' });
    expect(empLogin.status).toBe(200);
    orgAEmployeeToken = empLogin.body.data.token;

    // 3. Register and onboard a separate tenant (Organization B)
    const suffix = Date.now();
    const orgBRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: `orgb-admin-${suffix}@tenant-b.local`,
        password: 'Password123!',
        firstName: 'TenantB',
        lastName: 'Admin',
      });
    expect(orgBRegister.status).toBe(201);
    const initialToken = orgBRegister.body.data.token;

    const onbRes = await request(app)
      .post('/api/auth/onboarding/organization')
      .set('Authorization', `Bearer ${initialToken}`)
      .send({
        name: `Acme Corp ${suffix}`,
        slug: `acme-corp-${suffix}`,
      });
    expect(onbRes.status).toBe(201);
    orgBAdminToken = onbRes.body.data.token;

    // 4. Create two test documents in Org A for testing
    const doc1Res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({
        name: 'Phase 2D Document One',
        originalFileName: 'doc1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storageKey: 'org-demo/docs/doc1.pdf',
        checksum: '1111111111111111111111111111111111111111111111111111111111111111',
      });
    expect(doc1Res.status).toBe(201);
    testDoc1Id = doc1Res.body.data.id;

    const doc2Res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({
        name: 'Phase 2D Document Two',
        originalFileName: 'doc2.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageKey: 'org-demo/docs/doc2.pdf',
        checksum: '2222222222222222222222222222222222222222222222222222222222222222',
      });
    expect(doc2Res.status).toBe(201);
    testDoc2Id = doc2Res.body.data.id;

    // 5. Create a folder in Org A for testing bulk moves
    const folderRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({ name: 'Archive 2026' });
    expect(folderRes.status).toBe(201);
    destinationFolderId = folderRes.body.data.id;
  });

  describe('1. Document Types & Custom Fields Administration', () => {
    it('creates a new Document Type with custom name and description', async () => {
      const res = await request(app)
        .post('/api/document-types')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Legal NDA',
          description: 'Non-disclosure agreements with enterprise partners',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Legal NDA');
      createdTypeId = res.body.data.id;
    });

    it('updates a Document Type name and description', async () => {
      const res = await request(app)
        .put(`/api/document-types/${createdTypeId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Legal NDA Updated',
          description: 'Updated description for legal agreements',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Legal NDA Updated');
    });

    it('adds custom fields of various types (TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT) to Document Type', async () => {
      // 1. Text field (required)
      const textFieldRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Agreement Number',
          key: 'agreementNumber',
          type: 'TEXT',
          required: true,
          order: 1,
        });
      expect(textFieldRes.status).toBe(201);
      expect(textFieldRes.body.data.key).toBe('agreementNumber');
      expect(textFieldRes.body.data.required).toBe(true);

      // 2. Number field (optional)
      const numFieldRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Term Months',
          key: 'termMonths',
          type: 'NUMBER',
          required: false,
          order: 2,
        });
      expect(numFieldRes.status).toBe(201);

      // 3. Date field (required)
      const dateFieldRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Effective Date',
          key: 'effectiveDate',
          type: 'DATE',
          required: true,
          order: 3,
        });
      expect(dateFieldRes.status).toBe(201);

      // 4. Boolean field
      const boolFieldRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Mutual Agreement',
          key: 'isMutual',
          type: 'BOOLEAN',
          required: false,
          order: 4,
        });
      expect(boolFieldRes.status).toBe(201);

      // 5. Select field with options
      const selectFieldRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Jurisdiction',
          key: 'jurisdiction',
          type: 'SELECT',
          required: true,
          options: ['California', 'Delaware', 'New York', 'United Kingdom'],
          order: 5,
        });
      expect(selectFieldRes.status).toBe(201);

      // 6. Multi Select field with options
      const multiSelectRes = await request(app)
        .post(`/api/document-types/${createdTypeId}/fields`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Protected Data Types',
          key: 'protectedDataTypes',
          type: 'MULTI_SELECT',
          required: false,
          options: ['Source Code', 'Financial Data', 'Customer Lists', 'Trade Secrets'],
          order: 6,
        });
      expect(multiSelectRes.status).toBe(201);
    });

    it('updates a custom field definition', async () => {
      // Fetch fields of the document type
      const dtRes = await request(app)
        .get(`/api/document-types/${createdTypeId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(dtRes.status).toBe(200);
      const fields = dtRes.body.data.fields;
      expect(fields.length).toBe(6);

      const termField = fields.find((f: { key: string }) => f.key === 'termMonths');
      expect(termField).toBeDefined();

      const updateRes = await request(app)
        .put(`/api/document-types/${createdTypeId}/fields/${termField.id}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          name: 'Contract Duration (Months)',
          type: 'NUMBER',
          required: true,
          order: 2,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Contract Duration (Months)');
      expect(updateRes.body.data.required).toBe(true);
    });
  });

  describe('2. Required Fields & Field Validation Engine', () => {
    it('rejects metadata update when required fields are missing', async () => {
      // Assign the document type to testDoc1
      await request(app)
        .patch(`/api/documents/${testDoc1Id}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ documentTypeId: createdTypeId });

      // Try setting empty metadata when required fields exist
      const res = await request(app)
        .put(`/api/documents/${testDoc1Id}/metadata`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          metadata: {
            agreementNumber: 'NDA-2026-001',
            // Missing required effectiveDate and jurisdiction
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid data types (invalid date string, invalid select option)', async () => {
      const res = await request(app)
        .put(`/api/documents/${testDoc1Id}/metadata`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          metadata: {
            agreementNumber: 'NDA-2026-001',
            termMonths: 'not-a-number',
            effectiveDate: 'invalid-date-string',
            jurisdiction: 'Mars Colony', // Not in allowed options
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully validates and normalizes all custom field values', async () => {
      const res = await request(app)
        .put(`/api/documents/${testDoc1Id}/metadata`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          metadata: {
            agreementNumber: 'NDA-2026-001',
            termMonths: 24,
            effectiveDate: '2026-06-01',
            isMutual: true,
            jurisdiction: 'Delaware',
            protectedDataTypes: ['Source Code', 'Trade Secrets'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agreementNumber).toBe('NDA-2026-001');
      expect(res.body.data.termMonths).toBe(24);
      expect(res.body.data.jurisdiction).toBe('Delaware');
      expect(res.body.data.protectedDataTypes).toEqual(['Source Code', 'Trade Secrets']);
    });

    it('allows safe deletion of an unassigned document type but blocks deletion of assigned type', async () => {
      // 1. Attempting to delete createdTypeId which is assigned to testDoc1 must be blocked
      const blockedRes = await request(app)
        .delete(`/api/document-types/${createdTypeId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(blockedRes.status).toBe(409); // Conflict - in use by documents

      // 2. Create a temporary unassigned document type
      const tempType = await request(app)
        .post('/api/document-types')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ name: 'Temporary Type' });
      const tempId = tempType.body.data.id;

      // 3. Deleting unassigned type succeeds safely
      const deleteRes = await request(app)
        .delete(`/api/document-types/${tempId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });
  });

  describe('3. Tags Management & Filtering', () => {
    it('creates a new organization-specific tag', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ name: 'Confidential NDA' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Confidential NDA');
      createdTagId = res.body.data.id;
    });

    it('assigns tag to document', async () => {
      const res = await request(app)
        .post(`/api/documents/${testDoc1Id}/tags`)
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({ tagId: createdTagId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify tag is in document details
      const docRes = await request(app)
        .get(`/api/documents/${testDoc1Id}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(docRes.status).toBe(200);
      const tagNames = docRes.body.data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('Confidential NDA');
    });

    it('filters documents by tag', async () => {
      const filterRes = await request(app)
        .get(`/api/documents?tagId=${createdTagId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(filterRes.status).toBe(200);
      const docIds = filterRes.body.data.map((d: { id: string }) => d.id);
      expect(docIds).toContain(testDoc1Id);
      expect(docIds).not.toContain(testDoc2Id);
    });

    it('removes tag from document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDoc1Id}/tags/${createdTagId}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const docRes = await request(app)
        .get(`/api/documents/${testDoc1Id}`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      const tagNames = docRes.body.data.tags.map((t: { name: string }) => t.name);
      expect(tagNames).not.toContain('Confidential NDA');
    });
  });

  describe('4. User-Specific Favorites Isolation', () => {
    it('favorites are user-specific and do not leak to other users', async () => {
      // 1. Admin stars testDoc1
      const favRes = await request(app)
        .post(`/api/documents/${testDoc1Id}/favorite`)
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(favRes.status).toBe(200);
      expect(favRes.body.isFavorite).toBe(true);

      // 2. Admin queries favorites -> testDoc1 is present
      const adminFavs = await request(app)
        .get('/api/documents?view=favorites')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(adminFavs.body.data.some((d: { id: string }) => d.id === testDoc1Id)).toBe(true);

      // 3. Employee queries favorites -> testDoc1 is NOT present for employee
      const empFavs = await request(app)
        .get('/api/documents?view=favorites')
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);
      expect(empFavs.body.data.some((d: { id: string }) => d.id === testDoc1Id)).toBe(false);

      // 4. Employee's view of testDoc1 directly shows isFavorite = false
      const empDocRes = await request(app)
        .get(`/api/documents/${testDoc1Id}`)
        .set('Authorization', `Bearer ${orgAEmployeeToken}`);
      expect(empDocRes.body.data.isFavorite).toBe(false);
    });
  });

  describe('5. Bulk Operations', () => {
    it('executes bulk add-tag on multiple documents', async () => {
      const res = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          action: 'add-tag',
          documentIds: [testDoc1Id, testDoc2Id],
          tagId: createdTagId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);

      // Verify both docs have the tag
      const doc1 = await request(app).get(`/api/documents/${testDoc1Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      const doc2 = await request(app).get(`/api/documents/${testDoc2Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(doc1.body.data.tags.some((t: { id: string }) => t.id === createdTagId)).toBe(true);
      expect(doc2.body.data.tags.some((t: { id: string }) => t.id === createdTagId)).toBe(true);
    });

    it('executes bulk remove-tag on multiple documents', async () => {
      const res = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          action: 'remove-tag',
          documentIds: [testDoc1Id, testDoc2Id],
          tagId: createdTagId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);

      // Verify tag is removed from both
      const doc1 = await request(app).get(`/api/documents/${testDoc1Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      const doc2 = await request(app).get(`/api/documents/${testDoc2Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(doc1.body.data.tags.some((t: { id: string }) => t.id === createdTagId)).toBe(false);
      expect(doc2.body.data.tags.some((t: { id: string }) => t.id === createdTagId)).toBe(false);
    });

    it('executes bulk move to target folder', async () => {
      const res = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          action: 'move',
          documentIds: [testDoc1Id, testDoc2Id],
          targetFolderId: destinationFolderId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);

      const doc1 = await request(app).get(`/api/documents/${testDoc1Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      const doc2 = await request(app).get(`/api/documents/${testDoc2Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(doc1.body.data.folderId).toBe(destinationFolderId);
      expect(doc2.body.data.folderId).toBe(destinationFolderId);
    });

    it('executes bulk archive', async () => {
      const res = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          action: 'archive',
          documentIds: [testDoc1Id, testDoc2Id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);

      const doc1 = await request(app).get(`/api/documents/${testDoc1Id}`).set('Authorization', `Bearer ${orgAAdminToken}`);
      expect(doc1.body.data.status).toBe('ARCHIVED');
    });

    it('executes bulk delete to trash', async () => {
      const res = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgAAdminToken}`)
        .send({
          action: 'delete',
          documentIds: [testDoc1Id, testDoc2Id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.affectedCount).toBe(2);

      // Verify documents appear in trash view
      const trashRes = await request(app)
        .get('/api/documents?view=trash')
        .set('Authorization', `Bearer ${orgAAdminToken}`);
      const trashIds = trashRes.body.data.map((d: { id: string }) => d.id);
      expect(trashIds).toContain(testDoc1Id);
      expect(trashIds).toContain(testDoc2Id);
    });
  });

  describe('6. Organization Multi-Tenant Isolation', () => {
    it('prevents cross-tenant access to document types, tags, metadata, and bulk operations', async () => {
      // 1. Org B cannot read Org A's document type
      const docTypeRes = await request(app)
        .get(`/api/document-types/${createdTypeId}`)
        .set('Authorization', `Bearer ${orgBAdminToken}`);
      expect([403, 404]).toContain(docTypeRes.status);

      // 2. Org B cannot modify Org A's document type
      const updateRes = await request(app)
        .put(`/api/document-types/${createdTypeId}`)
        .set('Authorization', `Bearer ${orgBAdminToken}`)
        .send({ name: 'Hacked Document Type' });
      expect([403, 404]).toContain(updateRes.status);

      // 3. Org B cannot see Org A's tags
      const tagsRes = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${orgBAdminToken}`);
      expect(tagsRes.status).toBe(200);
      expect(tagsRes.body.data.some((t: { id: string }) => t.id === createdTagId)).toBe(false);

      // 4. Org B cannot access or update Org A's document metadata
      const metaRes = await request(app)
        .put(`/api/documents/${testDoc1Id}/metadata`)
        .set('Authorization', `Bearer ${orgBAdminToken}`)
        .send({ metadata: { agreementNumber: 'HACKED' } });
      expect([403, 404]).toContain(metaRes.status);

      // 5. Org B bulk operations on Org A's documents affect 0 documents
      const bulkRes = await request(app)
        .post('/api/documents/bulk')
        .set('Authorization', `Bearer ${orgBAdminToken}`)
        .send({
          action: 'delete',
          documentIds: [testDoc1Id, testDoc2Id],
        });
      // Either rejects or affects 0 documents
      if (bulkRes.status === 200) {
        expect(bulkRes.body.data.affectedCount).toBe(0);
      } else {
        expect([400, 403, 404]).toContain(bulkRes.status);
      }
    });
  });
});
