import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('AppShell Drag & Drop Intake Flow Integration Suite', () => {
  let authToken = '';
  let folderId = '';

  beforeAll(async () => {
    // 1. Login as Admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.local', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.data.token;

    // 2. Create Target Folder for Intake
    const folderRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Intake Drop Destination ${Date.now()}`,
        color: '#2563eb',
      });

    expect(folderRes.status).toBe(201);
    folderId = folderRes.body.data.id;
  });

  it('Step 1: Intakes document dropped directly into target folder via upload API', async () => {
    const pdfBuffer = Buffer.from(`%PDF-1.4 Intake Drop Zone File ${Date.now()}`);
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folderId', folderId)
      .field('name', 'Intake Direct File')
      .attach('file', pdfBuffer, 'intake-report.pdf');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.document).toBeDefined();
    expect(uploadRes.body.data.document.folderId).toBe(folderId);
    expect(uploadRes.body.data.document.name).toBe('Intake Direct File');
  });

  it('Step 2: Intakes document into Root Directory when no folderId is provided', async () => {
    const pdfBuffer = Buffer.from(`%PDF-1.4 Root Intake File ${Date.now()}`);
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', pdfBuffer, 'root-intake.pdf');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.document.folderId).toBeNull();
  });

  it('Step 3: Handles duplicate intake detection for dropped files', async () => {
    const uniqueContent = `%PDF-1.4 Deduplication Check Intake ${Date.now()}`;
    const pdfBuffer = Buffer.from(uniqueContent);

    // Initial intake
    const upload1 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', pdfBuffer, 'first-drop.pdf');

    expect(upload1.status).toBe(201);

    // Duplicate drop attempt
    const upload2 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', pdfBuffer, 'second-drop.pdf');

    expect(upload2.status).toBe(409);
    expect(upload2.body.isDuplicate).toBe(true);
    expect(upload2.body.data.existingDocument.id).toBe(upload1.body.data.document.id);
  });
});
