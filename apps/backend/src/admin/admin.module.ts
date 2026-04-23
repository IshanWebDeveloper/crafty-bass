import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { AdminService } from './admin.service.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { S3Service } from './s3.service.js';
import { PdfService } from './pdf.service.js';
import { ReportProcessor } from './report.processor.js';
import { ProductsModule } from '../products/products.module.js';
import { ReviewsModule } from '../reviews/reviews.module.js';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'reports' }),
    ProductsModule,
    ReviewsModule,
  ],
  controllers: [
    AdminController,
    AdminCatalogController,
    AdminReviewsController,
  ],
  providers: [
    AdminService,
    AdminCatalogService,
    S3Service,
    PdfService,
    ReportProcessor,
  ],
  exports: [AdminService, S3Service, PdfService],
})
export class AdminModule {}
