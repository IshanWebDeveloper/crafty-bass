import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { TranslationService } from './translation.service.js';
import { TranslateDto } from './dto/index.js';

@ApiTags('Translation')
@ApiBearerAuth()
@Controller('translate')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  // Authenticated-only (no @Permissions): any signed-in user may translate
  // marketplace content into their preferred language.
  @Post()
  @ApiOperation({ summary: 'Translate user-generated content into a locale' })
  translate(@Body() dto: TranslateDto, @Req() req: Request) {
    return this.translationService.translate(dto, req.headers);
  }
}
