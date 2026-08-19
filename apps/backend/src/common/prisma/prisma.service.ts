import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, createDbAdapter } from '@repo/db';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: createDbAdapter(),
      // Job.photoKeys holds raw R2 object keys. They're an internal storage
      // detail - clients get presigned URLs instead (JobsService.withPhotoUrls)
      // - and the job list endpoints select with `include`, which would return
      // every scalar. Omitting globally means a new list query can't leak them
      // by default; the one reader that needs them opts back in explicitly with
      // `omit: { photoKeys: false }`.
      omit: {
        job: { photoKeys: true },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Prisma $on event typing
    (this as any).$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > 200) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
      }
    });

    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
