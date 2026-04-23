import { Body, Controller, Get, Post, Delete, Param, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsentService } from './consent.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpsertConsentDto } from './dto/index.js';

@ApiTags('Consent (GDPR)')
@ApiBearerAuth()
@Controller('users/me/consents')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all my consent records' })
  getConsents(@CurrentUser('id') userId: string) {
    return this.consentService.getConsents(userId);
  }

  @Post(':type')
  @ApiOperation({
    summary:
      'Grant consent for a type (marketing, recommendations, terms, privacy_policy)',
  })
  grantConsent(
    @CurrentUser('id') userId: string,
    @Param('type') consentType: string,
    @Body() dto: UpsertConsentDto,
    @Ip() ipAddress: string,
  ) {
    return this.consentService.grantConsent(userId, consentType, {
      ipAddress,
      consentVersion: dto.consentVersion,
      consentPayload: dto.consentPayload,
      grantedAt: dto.grantedAt,
    });
  }

  @Delete(':type')
  @ApiOperation({ summary: 'Revoke consent for a type' })
  revokeConsent(
    @CurrentUser('id') userId: string,
    @Param('type') consentType: string,
  ) {
    return this.consentService.revokeConsent(userId, consentType);
  }
}
