import { JobStatus } from './prisma-types';
import { sharedTypes } from './shared-types';

describe('sharedTypes', () => {
  it('should work', () => {
    expect(sharedTypes()).toEqual('shared-types');
  });

  it('should re-export Prisma enums for frontend-safe imports', () => {
    expect(JobStatus.OPEN).toEqual('OPEN');
  });
});
