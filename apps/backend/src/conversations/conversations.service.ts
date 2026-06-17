import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type {
  StartConversationDto,
  SendMessageDto,
  ConversationQueryDto,
  MessageQueryDto,
} from './dto/index.js';

const PARTICIPANT_SELECT = {
  userId: true,
  joinedAt: true,
  lastReadAt: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

const CONVERSATION_LIST_INCLUDE = {
  participants: { select: PARTICIPANT_SELECT },
  job: { select: { id: true, title: true, status: true } },
  messages: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      body: true,
      messageType: true,
      senderId: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: ConversationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const where = { participants: { some: { userId } } };

    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        include: CONVERSATION_LIST_INCLUDE,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data: rows, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: { select: PARTICIPANT_SELECT },
        job: { select: { id: true, title: true, status: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Not a participant');
    }
    return conversation;
  }

  async listMessages(userId: string, id: string, query: MessageQueryDto) {
    await this.findOne(userId, id); // authz + existence
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          recipientId: true,
          body: true,
          messageType: true,
          attachments: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.message.count({ where: { conversationId: id } }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async start(userId: string, dto: StartConversationDto) {
    // Determine the counterpart user. For JOB_DIRECT we look it up from the
    // job (the homeowner if the sender is the tradesman, and vice versa);
    // for DIRECT it must be supplied as recipientId.
    let recipientId: string | undefined = dto.recipientId;
    let jobId: string | undefined = dto.jobId;

    if (dto.type === 'JOB_DIRECT') {
      if (!jobId) {
        throw new BadRequestException('jobId is required for JOB_DIRECT');
      }
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          homeownerId: true,
          assignedTradesmanId: true,
          quotes: {
            where: { tradesmanId: userId },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!job) throw new NotFoundException('Job not found');
      if (job.homeownerId === userId) {
        // Homeowner is starting a conversation — counterpart must be supplied
        // (typically the tradesman they want to talk to, derived from a quote).
        if (!recipientId) {
          throw new BadRequestException(
            'recipientId is required when the homeowner starts a job conversation',
          );
        }
      } else {
        // Tradesman side: must have either quoted on the job or be assigned.
        const isAssigned = job.assignedTradesmanId === userId;
        const hasQuoted = job.quotes.length > 0;
        if (!isAssigned && !hasQuoted) {
          throw new ForbiddenException(
            'You must have quoted on this job to start a conversation',
          );
        }
        recipientId = job.homeownerId;
      }
    } else {
      // DIRECT
      if (!recipientId) {
        throw new BadRequestException(
          'recipientId is required for DIRECT conversations',
        );
      }
      jobId = undefined;
    }

    if (recipientId === userId) {
      throw new BadRequestException(
        'Cannot start a conversation with yourself',
      );
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');

    // Reuse an existing conversation between this pair (+ job, for JOB_DIRECT)
    // instead of creating a duplicate.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: dto.type,
        jobId: jobId ?? null,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      select: { id: true },
    });

    const now = new Date();
    const conversationId =
      existing?.id ??
      (
        await this.prisma.conversation.create({
          data: {
            type: dto.type,
            jobId: jobId ?? null,
            lastMessageAt: now,
            participants: {
              create: [{ userId }, { userId: recipientId }],
            },
          },
          select: { id: true },
        })
      ).id;

    // Send the opening message in the same flow.
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        recipientId,
        body: dto.body,
        messageType: dto.messageType,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });

    return this.findOne(userId, conversationId).then((conversation) => ({
      conversation,
      message,
    }));
  }

  async sendMessage(userId: string, id: string, dto: SendMessageDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        participants: { select: { userId: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const participantIds = conversation.participants.map((p) => p.userId);
    if (!participantIds.includes(userId)) {
      throw new ForbiddenException('Not a participant');
    }
    const recipientId = participantIds.find((pid) => pid !== userId) ?? null;

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: id,
          senderId: userId,
          recipientId,
          body: dto.body,
          messageType: dto.messageType,
        },
      }),
      this.prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: now },
      }),
    ]);
    return message;
  }

  async markRead(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { participants: { select: { userId: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Not a participant');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: { lastReadAt: now },
      }),
      this.prisma.message.updateMany({
        where: {
          conversationId: id,
          recipientId: userId,
          isRead: false,
        },
        data: { isRead: true, readAt: now },
      }),
    ]);
    return { markedAt: now };
  }
}
