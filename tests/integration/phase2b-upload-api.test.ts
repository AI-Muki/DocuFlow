import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('Phase 2B: Document File Upload & Download REST API Integration', () => {
  let adminToken = '';
  let employeeToken = '';
  let uploadedDocId = '';
  const testFileBuffer = Buffer.from(`%PDF-1.4 API Integration Document Content ${Date.now()}`);

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

  it('POST /api/documents/upload - handles multipart file upload and creates document & version 1', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', testFileBuffer, 'handbook.pdf')
      .field('name', 'Employee Handbook 2026')
      .field('description', 'Comprehensive workplace policies')
      .field('tags', JSON.stringify(['HR', 'Policy']));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.isDuplicate).toBe(false);
    expect(res.body.data.document).toBeDefined();
    expect(res.body.data.document.name).toBe('Employee Handbook 2026');
    expect(res.body.data.document.originalFileName).toBe('handbook.pdf');
    expect(res.body.data.document.mimeType).toBe('application/pdf');
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.version.versionNumber).toBe(1);

    uploadedDocId = res.body.data.document.id;
  });

  it('POST /api/documents/upload - rejects duplicate file upload with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', testFileBuffer, 'handbook_copy.pdf');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.isDuplicate).toBe(true);
    expect(res.body.message).toBe('An identical file already exists.');
    expect(res.body.data.existingDocument.id).toBe(uploadedDocId);
  });

  it('POST /api/documents/upload - permits duplicate when allowDuplicate=true is provided', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', testFileBuffer, 'handbook_copy.pdf')
      .field('allowDuplicate', 'true');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.isDuplicate).toBe(false);
    expect(res.body.data.document.id).not.toBe(uploadedDocId);
  });

  it('GET /api/documents/:id/download - securely downloads binary file with attachment header', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');
    expect(res.body.toString('utf-8')).toBe(testFileBuffer.toString('utf-8'));
  });

  it('GET /api/documents/:id/preview - sends file buffer with inline disposition', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/preview`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('inline; filename=');
  });

  it('GET /api/documents/:id/signed-url - produces valid signed token download URL', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/signed-url`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toContain('/api/documents/files/download?token=');

    // Access the download token publicly without Authorization header
    const token = new URL(res.body.data.url, 'http://localhost:3000').searchParams.get('token')!;
    const downloadRes = await request(app).get(`/api/documents/files/download?token=${token}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('application/pdf');
    expect(downloadRes.body.toString('utf-8')).toBe(testFileBuffer.toString('utf-8'));
  });

  it('POST /api/documents/:id/versions/upload - uploads revision file as Version 2', async () => {
    const revisionBuffer = Buffer.from(`%PDF-1.4 Revision 2 Content with updates ${Date.now()}`);

    const res = await request(app)
      .post(`/api/documents/${uploadedDocId}/versions/upload`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', revisionBuffer, 'handbook_v2.pdf')
      .field('changeDescription', 'Updated remote work policy');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.versionNumber).toBe(2);
    expect(res.body.data.changeDescription).toBe('Updated remote work policy');

    // Download version 2 specifically
    const v2Download = await request(app)
      .get(`/api/documents/${uploadedDocId}/download?version=2`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(v2Download.status).toBe(200);
    expect(v2Download.body.toString('utf-8')).toBe(revisionBuffer.toString('utf-8'));
  });
});
