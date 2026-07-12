import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

// S3Service is provided globally by AdminModule (@Global), so it can be injected
// here without importing AdminModule.
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
