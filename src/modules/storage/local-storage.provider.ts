import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type {
  SignedUrlOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from './storage.types.ts';
import { storageConfig } from './storage.config.ts';
import { ForbiddenError } from '../../lib/errors.ts';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private secret: string;

  constructor(baseDir?: string, secret?: string) {
    this.baseDir = path.resolve(process.cwd(), baseDir || storageConfig.localStorageDir);
    this.secret = secret || storageConfig.signedUrlSecret;
  }

  /**
   * Resolves and verifies that the target path does not escape the base directory
   */
  private getSafePath(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new ForbiddenError('Security violation: invalid storage key');
    }

    const fullPath = path.resolve(this.baseDir, key);
    const normalizedBase = path.resolve(this.baseDir);

    if (!fullPath.startsWith(normalizedBase + path.sep) && fullPath !== normalizedBase) {
      throw new ForbiddenError('Security violation: path traversal detected');
    }

    return fullPath;
  }

  public async upload(
    key: string,
    data: Buffer,
    _options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const fullPath = this.getSafePath(key);
    const parentDir = path.dirname(fullPath);

    // Ensure parent directory exists
    await fs.mkdir(parentDir, { recursive: true });

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(data).digest('hex');

    // Write file to disk
    await fs.writeFile(fullPath, data);

    return {
      key,
      size: data.length,
      checksum,
    };
  }

  public async download(key: string): Promise<Buffer> {
    const fullPath = this.getSafePath(key);

    try {
      return await fs.readFile(fullPath);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ENOENT') {
        throw new Error(`File not found in storage: ${key}`);
      }
      throw err;
    }
  }

  public async delete(key: string): Promise<void> {
    const fullPath = this.getSafePath(key);

    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  public async exists(key: string): Promise<boolean> {
    const fullPath = this.getSafePath(key);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  public async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresInSeconds || storageConfig.signedUrlExpirySeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const payload = {
      key,
      exp: expiresAt,
      fn: options?.filename,
      inline: options?.inline ? 1 : 0,
    };

    const encodedData = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(encodedData)
      .digest('base64url');

    const token = `${encodedData}.${signature}`;
    return `/api/documents/files/download?token=${encodeURIComponent(token)}`;
  }

  /**
   * Verifies a signed URL token and returns the payload if valid
   */
  public verifySignedToken(
    token: string
  ): { key: string; filename?: string; inline?: boolean } | null {
    try {
      const [encodedData, signature] = token.split('.');
      if (!encodedData || !signature) return null;

      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(encodedData)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(encodedData, 'base64url').toString('utf8'));
      if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }

      return {
        key: decoded.key,
        filename: decoded.fn,
        inline: Boolean(decoded.inline),
      };
    } catch {
      return null;
    }
  }
}
