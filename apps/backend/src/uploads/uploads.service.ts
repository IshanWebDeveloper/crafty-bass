import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { S3Service } from '../admin/s3.service.js';

// A subset of multer's file shape — @types/multer isn't installed, so we type
// only the fields we actually use rather than relying on the ambient
// Express.Multer.File namespace.
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface CategoryRule {
  prefix: string;
  exactMimes: readonly string[];
  // Prefix matches (e.g. "audio/") let a category accept a whole MIME family.
  mimePrefixes?: readonly string[];
  maxBytes: number;
}

const MB = 1024 * 1024;

// Each upload category maps to a key prefix, an allowed MIME set, and a size
// cap. The prefix keeps kyc/avatar/portfolio objects in separate namespaces.
export const CATEGORY_RULES = {
  kyc: {
    prefix: 'kyc',
    exactMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 15 * MB,
  },
  avatar: {
    prefix: 'avatars',
    exactMimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * MB,
  },
  portfolio: {
    prefix: 'portfolio',
    exactMimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 10 * MB,
  },
  'voice-intro': {
    prefix: 'voice',
    exactMimes: [],
    mimePrefixes: ['audio/'],
    maxBytes: 10 * MB,
  },
} satisfies Record<string, CategoryRule>;

export type UploadCategory = keyof typeof CATEGORY_RULES;

// Bound the multer buffer to the largest category cap; per-category limits are
// enforced afterwards in the service so a too-large file for its category is a
// clean 400 rather than a mid-stream multer abort.
export const MAX_UPLOAD_BYTES = 15 * MB;

// Short-lived preview URL returned to the client immediately after upload so it
// can render a thumbnail before the key is persisted anywhere.
const PREVIEW_URL_TTL_SECONDS = 600;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'aac',
};

function isUploadCategory(value: string): value is UploadCategory {
  return value in CATEGORY_RULES;
}

function mimeAllowed(rule: CategoryRule, mime: string): boolean {
  if (rule.exactMimes.includes(mime)) return true;
  return (rule.mimePrefixes ?? []).some((prefix) => mime.startsWith(prefix));
}

function extensionForMime(mime: string): string {
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  // Fallback for accepted-by-prefix MIMEs (e.g. an uncommon audio subtype):
  // derive a safe extension from the subtype.
  const subtype = mime.split('/')[1] ?? '';
  const safe = subtype.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return safe || 'bin';
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Validates a multipart upload against its category rules, stores it in R2
   * under a server-derived key (never the client filename), and returns the key
   * plus a short-lived presigned URL for immediate preview.
   */
  async upload(
    userId: string,
    category: string,
    file: UploadedFileLike | undefined,
  ): Promise<{ key: string; url: string }> {
    if (!file) {
      throw new BadRequestException('No file was provided');
    }

    if (!isUploadCategory(category)) {
      throw new BadRequestException(
        `Invalid upload category "${category ?? ''}"`,
      );
    }

    const rule = CATEGORY_RULES[category];

    if (!mimeAllowed(rule, file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for ${category} uploads`,
      );
    }

    if (file.size > rule.maxBytes) {
      const maxMb = Math.round(rule.maxBytes / MB);
      throw new BadRequestException(
        `File is too large for ${category} uploads (max ${maxMb} MB)`,
      );
    }

    // Key = <prefix>/<userId>/<uuid>.<ext>. The extension comes from the
    // validated MIME type, and userId is taken from the authenticated session,
    // so a caller can only ever write under their own namespace.
    const key = `${rule.prefix}/${userId}/${randomUUID()}.${extensionForMime(
      file.mimetype,
    )}`;

    await this.s3Service.uploadObject(key, file.buffer, file.mimetype);
    this.logger.log(`Stored ${category} upload for user ${userId} at ${key}`);

    const url = await this.s3Service.getPresignedDownloadUrl(
      key,
      PREVIEW_URL_TTL_SECONDS,
    );

    return { key, url };
  }
}
