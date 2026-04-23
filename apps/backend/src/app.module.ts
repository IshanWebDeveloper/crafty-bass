import { ZodValidationPipe, ZodSerializerInterceptor } from 'nestjs-zod';
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { auth } from './auth.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { SanitizationPipe } from './common/pipes/sanitize.pipe.js';
import { CustomThrottlerGuard } from './common/guards/throttler-behind-proxy.guard.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

// Feature modules
import { UsersModule } from './users/users.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { CartModule } from './cart/cart.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { WishlistModule } from './wishlist/wishlist.module.js';
import { SupportModule } from './support/support.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { TaxRatesModule } from './tax-rates/tax-rates.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { ConsentModule } from './consent/consent.module.js';
import { LegalModule } from './legal/legal.module.js';
import { DataRetentionCronService } from './common/cron/data-retention.cron.js';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({ isGlobal: true }),

    // Event Emitter
    EventEmitterModule.forRoot(),

    // Scheduled tasks (cron)
    ScheduleModule.forRoot(),

    // Background job processing (BullMQ — Upstash-compatible with TLS)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const url = new URL(redisUrl);
        const useTls = url.protocol === 'rediss:';

        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
            maxRetriesPerRequest: null, // required by BullMQ
            ...(useTls && { tls: {} }),
          },
        };
      },
    }),

    // Rate limiting — 100 requests per minute per IP (global)
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60000, limit: 100 }],
    }),

    // Database
    PrismaModule,

    // Caching (Upstash-compatible with TLS)
    // CacheModule.registerAsync({
    //   isGlobal: true,
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: async (configService: ConfigService) => {
    //     const redisUrl =
    //       configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    //     try {
    //       const url = new URL(redisUrl);
    //       const useTls = url.protocol === 'rediss:';
    //       const store = await redisStore({
    //         url: redisUrl,
    //         ...(useTls && { socket: { tls: true } }),
    //       });
    //       return { store };
    //     } catch {
    //       console.warn(
    //         '⚠️ Redis connection failed, falling back to default in-memory cache.',
    //       );
    //       return {};
    //     }
    //   },
    // }),

    // Authentication
    AuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
    }),

    // Feature modules
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    SupportModule,
    NotificationsModule,
    AdminModule,
    PromotionsModule,
    TaxRatesModule,
    RecommendationsModule,
    ConsentModule,
    LegalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DataRetentionCronService,

    // Global sanitization pipe
    {
      provide: APP_PIPE,
      useClass: SanitizationPipe,
    },

    // Global validation pipe (nestjs-zod)
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },

    // Global serialization interceptor (nestjs-zod)
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },

    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    // Global auth + RBAC guard
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },

    // Note: authentication route rate-limiting is handled by better-auth's `rateLimit` config

    // Global rate-limit guard (with Retry-After header & proxy IP support)
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
