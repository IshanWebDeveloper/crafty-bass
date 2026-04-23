import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  CreateTicketDto,
  AddMessageDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  TicketQueryDto,
  RequestReturnApprovalDto,
  ReviewReturnApprovalDto,
} from './dto/index.js';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (own for customers, all for staff)' })
  list(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: TicketQueryDto,
  ) {
    return this.supportService.listTickets(userId, role, query);
  }

  @Get('returns/approval-requests')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List return tickets waiting for admin approval' })
  listPendingReturnApprovals() {
    return this.supportService.listPendingReturnApprovalTickets();
  }

  @Get('returns/approval-history')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List return approval workflow history events' })
  listReturnApprovalHistory(@Query('limit') limit?: string) {
    return this.supportService.listReturnApprovalHistory(
      limit ? Number.parseInt(limit, 10) : 30,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details with messages' })
  get(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') ticketId: string,
  ) {
    return this.supportService.getTicket(ticketId, userId, role);
  }

  @Post(':id/messages')
  @Permissions('ticket', 'reply')
  @ApiOperation({ summary: 'Add a message to ticket' })
  addMessage(
    @CurrentUser('id') senderId: string,
    @CurrentUser('role') senderRole: string,
    @Param('id') ticketId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.supportService.addMessage(ticketId, senderId, senderRole, dto);
  }

  @Post(':id/request-approval')
  @Roles('SUPPORT')
  @ApiOperation({
    summary: 'Support requests admin approval to complete a return ticket',
  })
  requestReturnApproval(
    @Param('id') ticketId: string,
    @CurrentUser('id') requesterId: string,
    @Body() dto: RequestReturnApprovalDto,
  ) {
    return this.supportService.requestReturnCompletionApproval(
      ticketId,
      requesterId,
      dto,
    );
  }

  @Post(':id/approval-decision')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin approves or rejects return completion' })
  reviewReturnApproval(
    @Param('id') ticketId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewReturnApprovalDto,
  ) {
    return this.supportService.reviewReturnCompletionApproval(
      ticketId,
      reviewerId,
      dto,
    );
  }

  @Patch(':id/status')
  @Permissions('ticket', 'resolve')
  @ApiOperation({ summary: 'Update ticket status (Staff only)' })
  updateStatus(
    @Param('id') ticketId: string,
    @CurrentUser('id') changedById: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.supportService.updateStatus(ticketId, dto, changedById);
  }

  @Patch(':id/assign')
  @Permissions('ticket', 'assign')
  @ApiOperation({ summary: 'Assign agent to ticket (Admin only)' })
  assign(@Param('id') ticketId: string, @Body() dto: AssignTicketDto) {
    return this.supportService.assignAgent(ticketId, dto);
  }
}
