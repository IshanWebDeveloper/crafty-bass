import { JobStatus } from './prisma-types.js';
import { sharedTypes } from './shared-types.js';

describe('sharedTypes', () => {
  it('should work', () => {
    expect(sharedTypes()).toEqual('shared-types');
  });

  it('should re-export Prisma enums for frontend-safe imports', () => {
    expect(JobStatus.OPEN).toEqual('OPEN');
  });
});
