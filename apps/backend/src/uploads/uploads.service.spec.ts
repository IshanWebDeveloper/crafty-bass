import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { UploadsService, type UploadedFileLike } from './uploads.service.js';
import type { S3Service } from '../admin/s3.service.js';

function makeService() {
  const uploadObject = jest.fn((): Promise<void> => Promise.resolve());
  const getPresignedDownloadUrl = jest.fn(
    (): Promise<string> => Promise.resolve('https://signed.example/preview'),
  );
  const s3 = {
    uploadObject,
    getPresignedDownloadUrl,
  } as unknown as S3Service;
  return {
    service: new UploadsService(s3),
    uploadObject,
    getPresignedDownloadUrl,
  };
}

function file(overrides: Partial<UploadedFileLike> = {}): UploadedFileLike {
  return {
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('binary'),
    ...overrides,
  };
}

describe('UploadsService.upload', () => {
  it('rejects when no file is provided', async () => {
    const { service } = makeService();
    await expect(
      service.upload('u1', 'avatar', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown category', async () => {
    const { service, uploadObject } = makeService();
    await expect(service.upload('u1', 'bogus', file())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('rejects a MIME type not allowed for the category', async () => {
    const { service } = makeService();
    // PDF is fine for kyc but not for avatar.
    await expect(
      service.upload('u1', 'avatar', file({ mimetype: 'application/pdf' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a file larger than the category cap', async () => {
    const { service } = makeService();
    await expect(
      service.upload('u1', 'avatar', file({ size: 6 * 1024 * 1024 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores under a server-derived key (prefix/userId/uuid.ext) and returns key + url', async () => {
    const { service, uploadObject } = makeService();
    const result = await service.upload('user-123', 'avatar', file());

    expect(uploadObject).toHaveBeenCalledTimes(1);
    const [key, buffer, mime] = (uploadObject.mock.calls as unknown[][])[0] as [
      string,
      Buffer,
      string,
    ];
    // Extension comes from the validated MIME, never the client filename.
    expect(key).toMatch(/^avatars\/user-123\/[0-9a-f-]{36}\.png$/);
    expect(mime).toBe('image/png');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(result.key).toBe(key);
    expect(result.url).toBe('https://signed.example/preview');
  });

  it('accepts a PDF for kyc and audio for voice-intro with correct extensions', async () => {
    const { service, uploadObject } = makeService();
    await service.upload('u1', 'kyc', file({ mimetype: 'application/pdf' }));
    await service.upload('u1', 'voice-intro', file({ mimetype: 'audio/mpeg' }));

    const calls = uploadObject.mock.calls as unknown[][];
    const kycKey = calls[0][0] as string;
    const voiceKey = calls[1][0] as string;
    expect(kycKey).toMatch(/^kyc\/u1\/[0-9a-f-]{36}\.pdf$/);
    expect(voiceKey).toMatch(/^voice\/u1\/[0-9a-f-]{36}\.mp3$/);
  });
});
