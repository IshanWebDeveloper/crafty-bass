import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ProductCatalogWriteService } from './product-catalog-write.service.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductCatalogWriteService],
  exports: [ProductsService, ProductCatalogWriteService],
})
export class ProductsModule {}
