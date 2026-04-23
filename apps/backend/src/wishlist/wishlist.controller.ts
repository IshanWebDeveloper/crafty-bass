import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AddWishlistItemDto } from './dto/index.js';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get my wishlist' })
  getWishlist(@CurrentUser('id') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Get('share-link')
  @ApiOperation({ summary: 'Get my wishlist share link' })
  getShareLink(@CurrentUser('id') userId: string) {
    return this.wishlistService.getShareLink(userId);
  }

  @Public()
  @Get('shared/:shareToken')
  @ApiOperation({ summary: 'Get public shared wishlist by token' })
  getPublicWishlist(@Param('shareToken') shareToken: string) {
    return this.wishlistService.getPublicWishlist(shareToken);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add product to wishlist' })
  addItem(@CurrentUser('id') userId: string, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(userId, dto.productId);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeItem(userId, productId);
  }
}
