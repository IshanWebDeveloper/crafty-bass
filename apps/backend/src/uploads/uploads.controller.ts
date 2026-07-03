import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  UploadsService,
  MAX_UPLOAD_BYTES,
  type UploadedFileLike,
} from './uploads.service.js';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @Permissions('profile', 'edit')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a file (kyc/avatar/portfolio/voice-intro) to object storage',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('category') category: string,
  ) {
    return this.uploadsService.upload(userId, category, file);
  }
}
