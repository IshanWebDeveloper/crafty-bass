import { Global, Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { AdminService } from './admin.service.js';
import { S3Service } from './s3.service.js';
import { PdfService } from './pdf.service.js';
import { ReviewsModule } from '../reviews/reviews.module.js';

@Global()
@Module({
  imports: [ReviewsModule],
  controllers: [AdminController, AdminReviewsController],
  providers: [AdminService, S3Service, PdfService],
  exports: [AdminService, S3Service, PdfService],
})
export class AdminModule {}
