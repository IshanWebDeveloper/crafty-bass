import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/index.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all categories (tree structure)' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get('tradesmen-counts')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({
    summary: 'Available tradesman counts per category (by slug)',
  })
  tradesmenCounts() {
    return this.categoriesService.getTradesmanCounts();
  }

  @Public()
  @Get(':slug')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({ summary: 'Get category by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @Permissions('category', 'create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create category (Admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @Permissions('category', 'update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('category', 'delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete category (Admin)' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
