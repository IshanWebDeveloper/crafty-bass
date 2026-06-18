import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List skills (optionally filtered by category)' })
  list(@Query('categoryId') categoryId?: string) {
    return this.prisma.skill.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: { nameEn: 'asc' },
    });
  }
}
