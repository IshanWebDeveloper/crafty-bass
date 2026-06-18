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
import { ConversationsService } from './conversations.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  StartConversationDto,
  SendMessageDto,
  ConversationQueryDto,
  MessageQueryDto,
} from './dto/index.js';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @Permissions('conversation', 'list')
  @ApiOperation({ summary: 'List the current user’s conversations' })
  listMine(
    @CurrentUser('id') userId: string,
    @Query() query: ConversationQueryDto,
  ) {
    return this.service.listMine(userId, query);
  }

  @Post()
  @Permissions('conversation', 'create')
  @ApiOperation({
    summary: 'Start (or reuse) a conversation and send the opening message',
  })
  start(@CurrentUser('id') userId: string, @Body() dto: StartConversationDto) {
    return this.service.start(userId, dto);
  }

  @Get(':id')
  @Permissions('conversation', 'view')
  @ApiOperation({ summary: 'Get a conversation (participant only)' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Get(':id/messages')
  @Permissions('message', 'list')
  @ApiOperation({ summary: 'List messages in a conversation' })
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.service.listMessages(userId, id, query);
  }

  @Post(':id/messages')
  @Permissions('message', 'create')
  @ApiOperation({ summary: 'Send a message into an existing conversation' })
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(userId, id, dto);
  }

  @Patch(':id/read')
  @Permissions('conversation', 'view')
  @ApiOperation({ summary: 'Mark received messages in this conversation read' })
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }
}
