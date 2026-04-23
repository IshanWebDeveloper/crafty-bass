import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../categories/dto/index.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import {
  AdminCreateProductDto,
  AdminCreateVariantDto,
  DeleteUploadedImagesDto,
  AdminProductListQueryDto,
  AdminUpdateProductDto,
  AdminUpdateVariantDto,
  BulkImportProductsDto,
  UploadUrlQueryDto,
} from './dto/catalog.dto.js';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'List products for the admin inventory table' })
  listProducts(@Query() query: AdminProductListQueryDto) {
    return this.adminCatalogService.listProducts(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product for admin editing' })
  findProductById(@Param('id') id: string) {
    return this.adminCatalogService.findProductById(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product with variants and images' })
  createProduct(
    @CurrentUser('id') actorId: string,
    @Body() dto: AdminCreateProductDto,
  ) {
    return this.adminCatalogService.createProduct(dto, actorId);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update product details and images' })
  updateProduct(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.adminCatalogService.updateProduct(id, dto, actorId);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft-delete a product' })
  deleteProduct(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.adminCatalogService.deleteProduct(id, actorId);
  }

  @Post('products/bulk-import')
  @ApiOperation({ summary: 'Bulk import products from CSV content' })
  bulkImportProducts(
    @CurrentUser('id') actorId: string,
    @Body() dto: BulkImportProductsDto,
  ) {
    return this.adminCatalogService.bulkImportProducts(dto, actorId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories as an admin tree' })
  listCategories() {
    return this.adminCatalogService.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  createCategory(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.adminCatalogService.createCategory(dto, actorId);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminCatalogService.updateCategory(id, dto, actorId);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  deleteCategory(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.adminCatalogService.deleteCategory(id, actorId);
  }

  @Post('variants')
  @ApiOperation({ summary: 'Create a product variant' })
  createVariant(
    @CurrentUser('id') actorId: string,
    @Body() dto: AdminCreateVariantDto,
  ) {
    return this.adminCatalogService.createVariant(dto, actorId);
  }

  @Patch('variants/:id')
  @ApiOperation({ summary: 'Update a product variant' })
  updateVariant(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateVariantDto,
  ) {
    return this.adminCatalogService.updateVariant(id, dto, actorId);
  }

  @Delete('variants/:id')
  @ApiOperation({ summary: 'Delete a product variant' })
  deleteVariant(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.adminCatalogService.deleteVariant(id, actorId);
  }

  @Get('upload-url')
  @ApiOperation({
    summary: 'Generate a presigned S3 upload URL for product images',
  })
  getUploadUrl(@Query() query: UploadUrlQueryDto) {
    return this.adminCatalogService.getUploadUrl(
      query.filename,
      query.contentType,
    );
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a product image through backend to S3' })
  uploadImage(@UploadedFile() file: UploadedImageFile) {
    return this.adminCatalogService.uploadImage(file);
  }

  @Post('cleanup-images')
  @ApiOperation({
    summary: 'Delete uploaded product images that were discarded',
  })
  cleanupUploadedImages(@Body() dto: DeleteUploadedImagesDto) {
    return this.adminCatalogService.cleanupUploadedImages(dto.keys);
  }
}
