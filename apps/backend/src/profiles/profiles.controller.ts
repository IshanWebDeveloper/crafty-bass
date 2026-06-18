import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import {
  UpsertHomeownerProfileDto,
  UpsertTradesmanProfileDto,
} from './dto/index.js';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @Permissions('profile', 'view')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my profile (user + homeowner/tradesman)' })
  getMine(@CurrentUser('id') userId: string) {
    return this.profilesService.getMine(userId);
  }

  @Put('me/homeowner')
  @Permissions('profile', 'edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update my homeowner profile' })
  upsertHomeowner(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertHomeownerProfileDto,
  ) {
    return this.profilesService.upsertHomeowner(userId, dto);
  }

  @Put('me/tradesman')
  @Permissions('profile', 'edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update my tradesman profile' })
  upsertTradesman(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertTradesmanProfileDto,
  ) {
    return this.profilesService.upsertTradesman(userId, dto);
  }

  @Public()
  @Get('tradesmen/:userId')
  @ApiOperation({ summary: 'Get a public tradesman profile' })
  getTradesmanPublic(@Param('userId') userId: string) {
    return this.profilesService.getTradesmanPublic(userId);
  }
}
