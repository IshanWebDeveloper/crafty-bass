import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { S3Service } from '../admin/s3.service.js';
import type { CreateJobDto } from './dto/index.js';

const OWNER = 'owner-1';

function makeService() {
  const jobCreate = jest.fn(
    (): Promise<unknown> => Promise.resolve({ id: 'j1' }),
  );
  const prisma = {
    user: {
      findUnique: jest.fn(
        (): Promise<unknown> => Promise.resolve({ userType: 'HOMEOWNER' }),
      ),
      update: jest.fn((): Promise<unknown> => Promise.resolve({})),
    },
    skill: { findMany: jest.fn((): Promise<unknown[]> => Promise.resolve([])) },
    job: { create: jobCreate },
  } as unknown as PrismaService;

  const getPresignedDownloadUrl = jest.fn(
    (key: unknown): Promise<string> =>
      Promise.resolve(`https://signed.example/${String(key)}`),
  );
  const s3 = { getPresignedDownloadUrl } as unknown as S3Service;
  const notifications = {} as unknown as NotificationsService;

  return {
    service: new JobsService(prisma, notifications, s3),
    jobCreate,
    getPresignedDownloadUrl,
  };
}

function dto(photoKeys?: string[]): CreateJobDto {
  return {
    title: 'Ceiling fan wobbling',
    description: 'The fan wobbles and the light is dead.',
    descriptionLanguage: 'EN',
    urgency: 'MEDIUM',
    ...(photoKeys ? { photoKeys } : {}),
  } as unknown as CreateJobDto;
}

// The client echoes photo keys back from POST /uploads, so they're untrusted.
// If this boundary regresses, a caller could attach any object in the bucket to
// their own job and then read it back through the presigned URLs findOne mints.
describe('JobsService.create - photo key ownership', () => {
  it('accepts keys under the caller own job-photos prefix', async () => {
    const { service, jobCreate } = makeService();
    const key = `job-photos/${OWNER}/abc.png`;

    await service.create(OWNER, dto([key]));

    const arg = jobCreate.mock.calls[0][0] as { data: { photoKeys: string[] } };
    expect(arg.data.photoKeys).toEqual([key]);
  });

  it.each([
    ['another user job-photos', 'job-photos/someone-else/evil.png'],
    ['another user kyc document', 'kyc/someone-else/nic-front.pdf'],
    ['the caller own kyc document', `kyc/${OWNER}/nic-front.pdf`],
    ['a traversal escape', `job-photos/${OWNER}/../../kyc/x/nic.pdf`],
  ])('rejects %s', async (_label, key) => {
    const { service, jobCreate } = makeService();

    await expect(service.create(OWNER, dto([key]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // The whole request is refused - no job is written with the bad key
    // stripped out, which would silently hide the attempt.
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it('rejects the batch when only one key of several is foreign', async () => {
    const { service, jobCreate } = makeService();

    await expect(
      service.create(
        OWNER,
        dto([`job-photos/${OWNER}/ok.png`, 'job-photos/other/bad.png']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it('defaults to an empty array when no photos are sent', async () => {
    const { service, jobCreate } = makeService();

    await service.create(OWNER, dto());

    const arg = jobCreate.mock.calls[0][0] as { data: { photoKeys: string[] } };
    expect(arg.data.photoKeys).toEqual([]);
  });
});
