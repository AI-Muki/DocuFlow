import crypto from 'crypto';
import path from 'path';
import type { StorageProvider } from './storage.types.ts';
import { LocalStorageProvider } from './local-storage.provider.ts';
import { storageConfig } from './storage.config.ts';

export class StorageService {
  private static instance: StorageService;
  private provider: StorageProvider;
  private localProvider: LocalStorageProvider;

  private constructor() {
    this.localProvider = new LocalStorageProvider(
      storageConfig.localStorageDir,
      storageConfig.signedUrlSecret
    );

    if (storageConfig.provider === 'local') {
      this.provider = this.localProvider;
    } else {
      // Prepared for future S3/Cloud Storage provider integration
      this.provider = this.localProvider;
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getProvider(): StorageProvider {
    return this.provider;
  }

  public getLocalProvider(): LocalStorageProvider {
    return this.localProvider;
  }

  /**
   * Set custom provider (useful for testing or switching to S3 in future)
   */
  public setProvider(provider: StorageProvider): void {
    this.provider = provider;
  }

  /**
   * Computes cryptographic SHA-256 checksum for a file buffer
   */
  public calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Sanitizes a file name by removing dangerous characters and path traversal sequences
   */
  public sanitizeFileName(fileName: string): string {
    // Strip directory paths
    const baseName = path.basename(fileName);
    // Replace non-alphanumeric (except dot, dash, underscore) with underscore
    const cleaned = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    // Prevent hidden files or files starting with dot
    return cleaned.replace(/^\.+/, 'file_');
  }

  /**
   * Generates a collision-resistant, tenant-isolated storage key
   * e.g. tenants/{orgId}/documents/{year}/{month}/{uuid}_{filename}
   */
  public generateStorageKey(orgId: string, originalFileName: string): string {
    const safeName = this.sanitizeFileName(originalFileName);
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const randomUuid = crypto.randomUUID();

    return `tenants/${orgId}/documents/${year}/${month}/${randomUuid}_${safeName}`;
  }
}

export const storageService = StorageService.getInstance();
