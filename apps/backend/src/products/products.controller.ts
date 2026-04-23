import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductQueryDto,
  ProductSearchQueryDto,
  CompareQueryDto,
} from './dto/index.js';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Browse products with filtering and search' })
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Autocomplete product search suggestions' })
  search(
    @Query() query: ProductSearchQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.productsService.searchSuggestions(query.q, query.limit, userId);
  }

  @Public()
  @Get('compare')
  @ApiOperation({ summary: 'Compare up to 4 products side-by-side' })
  compare(@Query() query: CompareQueryDto) {
    return this.productsService.compare(query.ids as unknown as string[]);
  }

  @Public()
  @Get('brands')
  @ApiOperation({ summary: 'List available product brands' })
  getBrands(): Promise<string[]> {
    const service = this.productsService as unknown as {
      getBrands: () => Promise<string[]>;
    };

    return service.getBrands();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @Permissions('product', 'view:<id>')
  @ApiBearerAuth()
  @CacheTTL(300)
  @ApiOperation({ summary: 'Get product details by ID (Admin)' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Public()
  @Get('slug/:slug')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Get product details by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Post()
  @Permissions('product', 'create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product with variants and images (Admin)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Permissions('product', 'update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product details (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/variants/:variantId/stock')
  @Permissions('product', 'update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update variant stock level (Admin)' })
  updateStock(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.productsService.updateStock(variantId, dto);
  }

  @Delete(':id')
  @Permissions('product', 'delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete product (Admin)' })
  remove(@Param('id') id: string) {
    return this.productsService.softDelete(id);
  }
}
