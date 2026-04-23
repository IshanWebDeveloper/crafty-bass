import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { LegalService } from './legal.service.js';
import { UpdatePrivacyPolicyDto } from './dto/index.js';

@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get('privacy-policy')
  @ApiOperation({ summary: 'Get privacy policy content (public)' })
  getPrivacyPolicy() {
    return this.legalService.getPrivacyPolicy();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Patch('privacy-policy')
  @ApiOperation({ summary: 'Update privacy policy content (admin)' })
  updatePrivacyPolicy(@Body() dto: UpdatePrivacyPolicyDto) {
    return this.legalService.updatePrivacyPolicy(dto);
  }
}
