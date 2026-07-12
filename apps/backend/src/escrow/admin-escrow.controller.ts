import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from './escrow.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { EscrowListQueryDto, ResolveDisputeDto } from './dto/index.js';

// Admin/support monitoring surface for escrow. Listing every escrow is broader
// than the party-scoped `escrow:view` permission, so it is gated on staff roles
// rather than the permission statement. Refunds continue to use the existing
// party-or-staff `POST /escrows/:id/refund` route.
@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPPORT')
@Controller('admin/escrows')
export class AdminEscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  @ApiOperation({ summary: 'List all escrows (Admin/Support)' })
  listAll(@Query() query: EscrowListQueryDto) {
    return this.escrowService.listAll(query);
  }

  @Post(':id/resolve-dispute')
  @ApiOperation({
    summary:
      'Resolve a disputed job: cancel it and refund some/all of the deposit (Admin/Support)',
  })
  resolveDispute(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.escrowService.resolveDispute(userId, id, dto);
  }
}
