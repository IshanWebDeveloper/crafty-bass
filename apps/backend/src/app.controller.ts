import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10000) // 10 seconds cache ttl
  @ApiOperation({ summary: 'Health check (cached)' })
  getHello(): string {
    return this.appService.getHello();
  }
}
