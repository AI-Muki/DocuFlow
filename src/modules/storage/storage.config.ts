export interface StorageConfig {
  provider: 'local' | 's3';
  localStorageDir: string;
  maxFileSizeBytes: number;
  signedUrlExpirySeconds: number;
  signedUrlSecret: string;
}

export function getStorageConfig(): StorageConfig {
  const maxBytes = parseInt(process.env.MAX_FILE_SIZE_BYTES || '26214400', 10);
  const expiry = parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600', 10);
  const secret =
    process.env.STORAGE_SIGNED_URL_SECRET ||
    process.env.AUTH_SECRET ||
    'docuflow-storage-signing-secret-default-key-32';

  return {
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3') || 'local',
    localStorageDir: process.env.LOCAL_STORAGE_DIR || 'storage_uploads',
    maxFileSizeBytes: isNaN(maxBytes) || maxBytes <= 0 ? 26214400 : maxBytes,
    signedUrlExpirySeconds: isNaN(expiry) || expiry <= 0 ? 3600 : expiry,
    signedUrlSecret: secret,
  };
}

export const storageConfig = getStorageConfig();
