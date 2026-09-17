import { ValidationError } from '../../lib/errors.ts';
import type { FileValidationResult } from './storage.types.ts';

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'txt',
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const EXTENSION_TO_MIME_MAP: Record<SupportedExtension, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
};

// Common alternative MIME types provided by browsers
export const ACCEPTABLE_MIMES_BY_EXT: Record<SupportedExtension, string[]> = {
  pdf: ['application/pdf', 'application/x-pdf'],
  doc: ['application/msword', 'application/x-msword', 'application/octet-stream'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ],
  xls: ['application/vnd.ms-excel', 'application/x-msexcel', 'application/octet-stream'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ],
  ppt: ['application/vnd.ms-powerpoint', 'application/x-mspowerpoint', 'application/octet-stream'],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ],
  png: ['image/png', 'image/x-png'],
  jpg: ['image/jpeg', 'image/pjpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/pjpeg', 'image/jpg'],
  txt: ['text/plain', 'text/x-log', 'application/txt'],
};

/**
 * Validates buffer magic bytes against expected file type signatures
 */
function verifyBufferMagicBytes(buffer: Buffer, ext: SupportedExtension): boolean {
  if (!buffer || buffer.length === 0) {
    // Zero-byte files for txt are valid empty files; binaries are not
    return ext === 'txt';
  }

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (ext === 'pdf') {
    if (buffer.length < 4) return false;
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === 'png') {
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // JPG / JPEG: FF D8 FF
  if (ext === 'jpg' || ext === 'jpeg') {
    if (buffer.length < 3) return false;
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // Modern Office (docx, xlsx, pptx): ZIP archive (PK\x03\x04)
  if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
    if (buffer.length < 4) return false;
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
    );
  }

  // Legacy Office (doc, xls, ppt): OLE Compound Document (D0 CF 11 E0 A1 B1 1A E1)
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    );
  }

  // Plain text (txt): must not contain binary null bytes in initial chunk
  if (ext === 'txt') {
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return false; // Null byte indicates binary data
      }
    }
    return true;
  }

  return false;
}

/**
 * Authoritative backend validation of file extension, MIME type, and binary signature
 */
export function validateFileContent(
  buffer: Buffer,
  fileName: string,
  declaredMimeType?: string
): FileValidationResult {
  if (!fileName || typeof fileName !== 'string') {
    return {
      isValid: false,
      detectedMimeType: '',
      normalizedExtension: '',
      error: 'File name is missing or invalid',
    };
  }

  const parts = fileName.toLowerCase().split('.');
  if (parts.length < 2) {
    return {
      isValid: false,
      detectedMimeType: '',
      normalizedExtension: '',
      error: 'File must have a valid extension',
    };
  }

  const ext = parts[parts.length - 1] as SupportedExtension;
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      detectedMimeType: '',
      normalizedExtension: ext,
      error: `Unsupported file extension '.${ext}'. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}`,
    };
  }

  // Check declared MIME type if provided
  if (declaredMimeType) {
    const cleanedDeclared = declaredMimeType.split(';')[0].trim().toLowerCase();
    const acceptable = ACCEPTABLE_MIMES_BY_EXT[ext] || [];
    // Allow octet-stream only if magic bytes match
    if (
      !acceptable.includes(cleanedDeclared) &&
      cleanedDeclared !== 'application/octet-stream' &&
      cleanedDeclared !== 'binary/octet-stream'
    ) {
      return {
        isValid: false,
        detectedMimeType: cleanedDeclared,
        normalizedExtension: ext,
        error: `Declared MIME type '${declaredMimeType}' does not match extension '.${ext}'`,
      };
    }
  }

  // Inspect binary signature / magic bytes
  const isMagicValid = verifyBufferMagicBytes(buffer, ext);
  if (!isMagicValid) {
    return {
      isValid: false,
      detectedMimeType: '',
      normalizedExtension: ext,
      error: `File signature mismatch: binary contents do not match expected .${ext} structure`,
    };
  }

  const authoritativeMime = EXTENSION_TO_MIME_MAP[ext];

  return {
    isValid: true,
    detectedMimeType: authoritativeMime,
    normalizedExtension: ext,
  };
}

/**
 * Throws a ValidationError if the file fails validation
 */
export function assertValidFile(
  buffer: Buffer,
  fileName: string,
  declaredMimeType?: string,
  maxSizeBytes?: number
): { mimeType: string; extension: string } {
  if (maxSizeBytes && buffer.length > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMb = (buffer.length / (1024 * 1024)).toFixed(1);
    throw new ValidationError(
      `File size exceeds maximum allowed limit of ${maxMb}MB (uploaded: ${actualMb}MB)`
    );
  }

  const result = validateFileContent(buffer, fileName, declaredMimeType);
  if (!result.isValid) {
    throw new ValidationError(result.error || 'Invalid file format');
  }

  return {
    mimeType: result.detectedMimeType,
    extension: result.normalizedExtension,
  };
}

/**
 * Sanitizes a filename preventing directory traversal and removing illegal characters
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, '');
  return base.replace(/[\0\x00-\x1f\x7f]/g, '').trim() || 'unnamed_file';
}
