import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { CreateMaterialRequestDto } from './dto/index.js';

const REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true, image: true } },
} as const;

// A job must be underway for its tradesman to ask for more materials.
const ACTIVE_STATUSES: readonly string[] = ['ASSIGNED', 'IN_PROGRESS'];

@Injectable()
export class MaterialRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // Only the job's assigned tradesman may raise a request, and only while the
  // job is active. Ownership/role is enforced here (not via RBAC statements).
  async create(userId: string, jobId: string, dto: CreateMaterialRequestDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, assignedTradesmanId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.assignedTradesmanId !== userId) {
      throw new ForbiddenException(
        'Only the assigned tradesman can request materials',
      );
    }
    if (!ACTIVE_STATUSES.includes(job.status)) {
      throw new ConflictException(
        'Materials can only be requested while the job is active',
      );
    }
    return this.prisma.materialRequest.create({
      data: {
        jobId,
        requestedById: userId,
        note: dto.note,
        estimatedCost: dto.estimatedCost ?? null,
        currency: dto.currency,
      },
      include: REQUEST_INCLUDE,
    });
  }

  // Visible to the job's homeowner and its assigned tradesman.
  async listForJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { homeownerId: true, assignedTradesmanId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId && job.assignedTradesmanId !== userId) {
      throw new ForbiddenException('Not allowed to view these requests');
    }
    return this.prisma.materialRequest.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: REQUEST_INCLUDE,
    });
  }

  // The homeowner approves or declines a pending request.
  async respond(userId: string, id: string, approve: boolean) {
    const request = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { job: { select: { homeownerId: true } } },
    });
    if (!request) throw new NotFoundException('Material request not found');
    if (request.job.homeownerId !== userId) {
      throw new ForbiddenException(
        'Only the homeowner can respond to material requests',
      );
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('This request has already been answered');
    }
    return this.prisma.materialRequest.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'DECLINED',
        respondedAt: new Date(),
      },
      include: REQUEST_INCLUDE,
    });
  }
}
