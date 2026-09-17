import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LocalStorageProvider } from '../../src/modules/storage/local-storage.provider.ts';
import {
  assertValidFile,
  sanitizeFileName,
} from '../../src/modules/storage/mime-validator.ts';
import { ValidationError, ForbiddenError } from '../../src/lib/errors.ts';

describe('Phase 2B: Local Storage Provider & MIME Validation', () => {
  const testStorageDir = path.join(process.cwd(), 'storage-test-sandbox');
  const secretKey = 'super-secret-signing-key-for-tests-12345';
  let provider: LocalStorageProvider;

  beforeEach(() => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    provider = new LocalStorageProvider(testStorageDir, secretKey);
  });

  afterEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('LocalStorageProvider Operations & Security', () => {
    it('stores, checks existence, downloads, and deletes files securely', async () => {
      const storageKey = 'tenants/org-test-123/documents/sample-doc.pdf';
      const fileBuffer = Buffer.from('%PDF-1.4 test content here for storage verification');

      // Upload
      const uploadResult = await provider.upload(storageKey, fileBuffer, {
        contentType: 'application/pdf',
      });

      expect(uploadResult.key).toBe(storageKey);
      expect(uploadResult.size).toBe(fileBuffer.length);

      // Exists check
      const exists = await provider.exists(storageKey);
      expect(exists).toBe(true);

      // Download
      const downloaded = await provider.download(storageKey);
      expect(downloaded.toString('utf-8')).toBe(fileBuffer.toString('utf-8'));

      // Delete
      await provider.delete(storageKey);
      const existsAfter = await provider.exists(storageKey);
      expect(existsAfter).toBe(false);
    });

    it('strictly prevents path traversal attacks outside the storage root', async () => {
      const maliciousTraversalKey = '../../../../etc/passwd';
      const fileBuffer = Buffer.from('malicious payload');

      await expect(
        provider.upload(maliciousTraversalKey, fileBuffer, {
          contentType: 'text/plain',
        })
      ).rejects.toThrow(ForbiddenError);

      await expect(provider.download(maliciousTraversalKey)).rejects.toThrow(ForbiddenError);
      await expect(provider.exists(maliciousTraversalKey)).rejects.toThrow(ForbiddenError);
      await expect(provider.delete(maliciousTraversalKey)).rejects.toThrow(ForbiddenError);
    });

    it('generates tamper-proof signed download URLs with HMAC token', async () => {
      const storageKey = 'tenants/org-test-123/documents/contract.pdf';
      const signedUrl = await provider.getSignedUrl(storageKey, {
        expiresInSeconds: 60,
        filename: 'contract.pdf',
        inline: false,
      });

      expect(signedUrl).toContain('/api/documents/files/download?token=');
      const urlObj = new URL(signedUrl, 'http://localhost:3000');
      const token = urlObj.searchParams.get('token')!;
      expect(token).toBeDefined();

      // Verify token with provider
      const payload = provider.verifySignedToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.key).toBe(storageKey);
      expect(payload!.filename).toBe('contract.pdf');
      expect(payload!.inline).toBe(false);
    });

    it('rejects tampered or forged download tokens', async () => {
      const validUrl = await provider.getSignedUrl('tenants/org-1/documents/file.pdf', {
        expiresInSeconds: 300,
        filename: 'file.pdf',
      });
      const urlObj = new URL(validUrl, 'http://localhost:3000');
      const token = urlObj.searchParams.get('token')!;

      // Tamper with base64 data
      const parts = token.split('.');
      const tamperedToken = `${parts[0].slice(0, -4)}AAAA.${parts[1]}`;

      const verified = provider.verifySignedToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('rejects expired download tokens', () => {
      const expiredPayload = {
        key: 'tenants/org-1/documents/file.pdf',
        exp: Math.floor(Date.now() / 1000) - 60,
        fn: 'file.pdf',
        inline: 0,
      };

      const crypto = require('crypto');
      const jsonStr = JSON.stringify(expiredPayload);
      const b64 = Buffer.from(jsonStr).toString('base64url');
      const sig = crypto.createHmac('sha256', secretKey).update(b64).digest('base64url');
      const expiredToken = `${b64}.${sig}`;

      const verified = provider.verifySignedToken(expiredToken);
      expect(verified).toBeNull();
    });
  });

  describe('MIME & Magic Bytes Authoritative Validation', () => {
    it('validates authentic PDF files with %PDF- header', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7 standard PDF content');
      const validated = assertValidFile(validPdfBuffer, 'agreement.pdf', 'application/pdf');

      expect(validated.extension).toBe('pdf');
      expect(validated.mimeType).toBe('application/pdf');
    });

    it('validates authentic PNG files with PNG magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const validated = assertValidFile(pngHeader, 'chart.png', 'image/png');

      expect(validated.extension).toBe('png');
      expect(validated.mimeType).toBe('image/png');
    });

    it('validates authentic JPEG files with JPEG magic bytes', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const validated = assertValidFile(jpegHeader, 'photo.jpg', 'image/jpeg');

      expect(validated.extension).toBe('jpg');
      expect(validated.mimeType).toBe('image/jpeg');
    });

    it('validates authentic ZIP-based Office Open XML documents (DOCX, XLSX, PPTX)', () => {
      const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      const docxValidated = assertValidFile(zipHeader, 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(docxValidated.extension).toBe('docx');

      const xlsxValidated = assertValidFile(zipHeader, 'budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(xlsxValidated.extension).toBe('xlsx');
    });

    it('validates authentic CFBF legacy Office documents (DOC, XLS, PPT)', () => {
      const cfbfHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const docValidated = assertValidFile(cfbfHeader, 'legacy.doc', 'application/msword');
      expect(docValidated.extension).toBe('doc');
      expect(docValidated.mimeType).toBe('application/msword');
    });

    it('rejects spoofed executable files disguised as PDF', () => {
      // Windows PE EXE header MZ
      const fakePdfBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      expect(() => {
        assertValidFile(fakePdfBuffer, 'trojan.pdf', 'application/pdf');
      }).toThrow(ValidationError);
    });

    it('rejects unsupported extensions and MIME types', () => {
      const buffer = Buffer.from('console.log("hello");');

      expect(() => {
        assertValidFile(buffer, 'script.js', 'application/javascript');
      }).toThrow(/Unsupported file extension/i);
    });

    it('rejects files exceeding maximum file size', () => {
      const buffer = Buffer.from('%PDF-1.4 test');

      expect(() => {
        assertValidFile(buffer, 'huge.pdf', 'application/pdf', 5); // 5 bytes max
      }).toThrow(/exceeds maximum allowed limit/i);
    });

    it('sanitizes unsafe filenames with directory traversals', () => {
      expect(sanitizeFileName('../../secret.pdf')).toBe('secret.pdf');
      expect(sanitizeFileName('C:\\Windows\\system32\\calc.exe.pdf')).toBe('calc.exe.pdf');
      expect(sanitizeFileName('normal-document_2026.pdf')).toBe('normal-document_2026.pdf');
    });
  });
});
