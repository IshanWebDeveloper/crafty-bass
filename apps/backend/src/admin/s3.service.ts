import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly presignedUrlExpiresIn: number;
  private readonly presignedUrlCache = new Map<
    string,
    { url: string; expiresAt: number }
  >();
  private readonly cacheSafetyWindowMs = 15_000;

  constructor(private readonly config: ConfigService) {
    const isProduction =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production';

    const bucketName = this.config.get<string>('AWS_BUCKET_NAME');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    // Optional S3-compatible endpoint. When set, the client talks to a
    // non-AWS provider (e.g. Cloudflare R2, MinIO, Backblaze B2) using the
    // same S3 API. R2's endpoint is https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    // and expects the pseudo-region "auto". `S3_ENDPOINT` takes precedence;
    // `R2_ENDPOINT` is accepted as an alias for clarity in R2-only deploys.
    const endpoint =
      this.config.get<string>('S3_ENDPOINT') ??
      this.config.get<string>('R2_ENDPOINT');
    const isCompatibleEndpoint = Boolean(endpoint);

    // R2 uses "auto"; fall back to it when a custom endpoint is set and no
    // region was provided, otherwise keep the AWS default.
    const region =
      this.config.get<string>('AWS_REGION') ??
      (isCompatibleEndpoint ? 'auto' : undefined);

    if (isProduction) {
      const missing = [
        ['AWS_BUCKET_NAME', bucketName],
        ['AWS_REGION', region],
        ['AWS_ACCESS_KEY_ID', accessKeyId],
        ['AWS_SECRET_ACCESS_KEY', secretAccessKey],
      ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

      if (missing.length > 0) {
        throw new Error(
          `S3Service refusing to start in production with missing storage env vars: ${missing.join(
            ', ',
          )}`,
        );
      }
    }

    this.bucketName = bucketName || 'test-bucket';
    const resolvedRegion = region || 'us-east-1';
    const resolvedAccessKeyId = accessKeyId || 'dummy-key';
    const resolvedSecretAccessKey = secretAccessKey || 'dummy-secret';

    const configuredExpiry = Number(
      this.config.get<string>('AWS_PRESIGNED_URL_EXPIRES_IN') ?? '3600',
    );
    this.presignedUrlExpiresIn =
      Number.isFinite(configuredExpiry) && configuredExpiry > 0
        ? configuredExpiry
        : 3600;

    this.logger.log(
      `Initialized S3Service: Bucket=${this.bucketName}, Region=${resolvedRegion}, ` +
        `Provider=${isCompatibleEndpoint ? `S3-compatible (${endpoint ?? ''})` : 'AWS S3'}, ` +
        `HasKey=${resolvedAccessKeyId !== 'dummy-key'}`,
    );

    this.s3Client = new S3Client({
      region: resolvedRegion,
      credentials: {
        accessKeyId: resolvedAccessKeyId,
        secretAccessKey: resolvedSecretAccessKey,
      },
      ...(endpoint
        ? {
            endpoint,
            // Path-style keeps the bucket in the URL path rather than the
            // hostname, which is the reliable addressing mode for R2/MinIO.
            forcePathStyle: true,
          }
        : {}),
      // AWS SDK v3.729+ adds default integrity checksums that R2 (and some
      // other S3-compatible stores) reject on presigned PUTs and streamed
      // uploads. Only compute/validate checksums when the operation requires
      // it so presigned URLs stay portable.
      ...(isCompatibleEndpoint
        ? {
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
          }
        : {}),
    });
  }

  /**
   * Uploads a buffer to S3 and returns a presigned URL to download it.
   */
  async uploadAndGetPresignedUrl(
    key: string,
    buffer: Buffer,
    contentType: string = 'application/pdf',
    expiresIn: number = 3600,
  ): Promise<string> {
    this.logger.log(`Uploading file ${key} to S3 bucket ${this.bucketName}`);

    try {
      // 1. Upload to S3
      await this.uploadObject(key, buffer, contentType);

      // 2. Generate Download Presigned URL
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, getCommand, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(
        `Error uploading to S3 or generating presigned URL: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async uploadObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
  ): Promise<void> {
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(putCommand);
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 60,
  ): Promise<string> {
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, putCommand, { expiresIn });
  }

  async getPresignedDownloadUrl(
    keyOrUrl: string,
    expiresIn: number = this.presignedUrlExpiresIn,
    downloadFileName?: string,
  ): Promise<string> {
    const objectKey = this.extractObjectKey(keyOrUrl);

    if (!objectKey) {
      return keyOrUrl;
    }

    try {
      this.cleanupExpiredPresignedUrls();

      const cacheKey = `${objectKey}:${expiresIn}:${downloadFileName ?? ''}`;
      const cached = this.presignedUrlCache.get(cacheKey);
      if (cached && cached.expiresAt - Date.now() > this.cacheSafetyWindowMs) {
        return cached.url;
      }

      const safeDownloadName = downloadFileName
        ? this.sanitizeDownloadFileName(downloadFileName)
        : undefined;

      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        ...(safeDownloadName
          ? {
              ResponseContentDisposition: `attachment; filename="${safeDownloadName}"`,
            }
          : {}),
      });

      const signedUrlResult: unknown = await getSignedUrl(
        this.s3Client,
        getCommand,
        { expiresIn },
      );
      const url =
        typeof signedUrlResult === 'string'
          ? signedUrlResult
          : String(signedUrlResult);
      this.presignedUrlCache.set(cacheKey, {
        url,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return url;
    } catch (error) {
      this.logger.warn(
        `Failed to generate product image presigned URL for key ${objectKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return keyOrUrl;
    }
  }

  /**
   * Lists object keys under a prefix. Callers should derive the prefix from
   * server-side state (e.g. an authenticated user id) - never from raw user
   * input - so the result set cannot be widened by a malicious caller.
   */
  async listObjectKeysWithPrefix(prefix: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });

    const response = await this.s3Client.send(command);
    const contents = response.Contents ?? [];
    return contents
      .map((entry) => entry.Key)
      .filter((key): key is string => typeof key === 'string');
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(deleteCommand);
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 object ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private extractObjectKey(keyOrUrl: string): string | null {
    const normalizedValue = keyOrUrl.trim();

    if (!normalizedValue) {
      return null;
    }

    if (normalizedValue.startsWith('s3://')) {
      return this.extractFromS3Uri(normalizedValue);
    }

    if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(normalizedValue)) {
      return normalizedValue.replace(/^\/+/, '');
    }

    try {
      const parsed = new URL(normalizedValue);
      const hostname = parsed.hostname.toLowerCase();
      const bucketName = this.bucketName.toLowerCase();
      const pathname = parsed.pathname.replace(/^\/+/, '');

      if (!pathname) {
        return null;
      }

      if (hostname === bucketName || hostname.startsWith(`${bucketName}.`)) {
        return decodeURIComponent(pathname);
      }

      if (hostname.includes('amazonaws.com')) {
        const segments = pathname.split('/').filter(Boolean);

        if (segments[0]?.toLowerCase() === bucketName) {
          return decodeURIComponent(segments.slice(1).join('/'));
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractFromS3Uri(s3Uri: string): string | null {
    const withoutScheme = s3Uri.slice('s3://'.length);
    const firstSlash = withoutScheme.indexOf('/');

    if (firstSlash === -1) {
      return null;
    }

    const bucket = withoutScheme.slice(0, firstSlash).toLowerCase();
    if (bucket !== this.bucketName.toLowerCase()) {
      return null;
    }

    return decodeURIComponent(withoutScheme.slice(firstSlash + 1));
  }

  private cleanupExpiredPresignedUrls() {
    const now = Date.now();
    for (const [key, value] of this.presignedUrlCache.entries()) {
      if (value.expiresAt <= now) {
        this.presignedUrlCache.delete(key);
      }
    }
  }

  private sanitizeDownloadFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
