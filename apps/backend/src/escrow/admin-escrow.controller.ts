import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from './escrow.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { EscrowListQueryDto } from './dto/index.js';

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
}
