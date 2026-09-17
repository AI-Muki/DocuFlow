export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageUploadResult {
  key: string;
  size: number;
  checksum: string;
  url?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  filename?: string;
  inline?: boolean;
}

export interface StorageProvider {
  /**
   * Upload file data to storage destination
   */
  upload(key: string, data: Buffer, options?: StorageUploadOptions): Promise<StorageUploadResult>;

  /**
   * Download file data from storage
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if file exists in storage
   */
  exists(key: string): Promise<boolean>;

  /**
   * Generate a time-limited signed URL for secure file download or viewing
   */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
}

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: string;
  normalizedExtension: string;
  error?: string;
}
