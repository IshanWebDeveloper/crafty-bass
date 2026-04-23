import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller.js';
import { WishlistService } from './wishlist.service.js';
import { WishlistPriceDropCronService } from './wishlist-price-drop.cron.js';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, WishlistPriceDropCronService],
  exports: [WishlistService],
})
export class WishlistModule {}
