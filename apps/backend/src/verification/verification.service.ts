import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  SubmitVerificationDto,
  RejectVerificationDto,
} from './dto/index.js';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  // A tradesman submits (or resubmits) their KYC details. Resubmitting always
  // returns the record to PENDING for re-review; an already-approved tradesman
  // cannot resubmit.
  async submit(userId: string, dto: SubmitVerificationDto) {
    const existing = await this.prisma.tradesmanVerification.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (existing?.status === 'APPROVED') {
      throw new ConflictException('Your verification is already approved');
    }

    const data = {
      status: 'PENDING' as const,
      fullName: dto.fullName,
      gender: dto.gender ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
      nicNumber: dto.nicNumber,
      addressLine: dto.addressLine ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      primaryTrade: dto.primaryTrade ?? null,
      yearsExperience: dto.yearsExperience,
      nicFrontKey: dto.nicFrontKey ?? null,
      nicBackKey: dto.nicBackKey ?? null,
      photoKey: dto.photoKey ?? null,
      gramaNiladhariKey: dto.gramaNiladhariKey ?? null,
      licenceKey: dto.licenceKey ?? null,
      licenceNumber: dto.licenceNumber ?? null,
      policeClearanceKey: dto.policeClearanceKey ?? null,
      serviceRadiusKm: dto.serviceRadiusKm,
      crewType: dto.crewType ?? null,
      helperCount: dto.helperCount ?? null,
      portfolioKeys: dto.portfolioKeys ?? undefined,
      guarantorName: dto.guarantorName ?? null,
      guarantorNic: dto.guarantorNic ?? null,
      voiceIntroKey: dto.voiceIntroKey ?? null,
      payoutAccountHolder: dto.payoutAccountHolder ?? null,
      payoutBank: dto.payoutBank ?? null,
      payoutBranch: dto.payoutBranch ?? null,
      payoutAccountNumber: dto.payoutAccountNumber ?? null,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
    };

    return this.prisma.$transaction(async (tx) => {
      // Submitting marks the user as a tradesman.
      await tx.user.update({
        where: { id: userId },
        data: { userType: 'TRADESMAN' },
      });
      return tx.tradesmanVerification.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    });
  }

  async getMine(userId: string) {
    return this.prisma.tradesmanVerification.findUnique({ where: { userId } });
  }

  async listPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { status: 'PENDING' as const };
    const [data, total] = await Promise.all([
      this.prisma.tradesmanVerification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
      this.prisma.tradesmanVerification.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  // Reviewer approves: flips the tradesman's profile to verified, and to
  // background-checked when a police-clearance document is attached.
  async approve(reviewerId: string, id: string) {
    const submission = await this.prisma.tradesmanVerification.findUnique({
      where: { id },
    });
    if (!submission) throw new NotFoundException('Verification not found');
    if (submission.status === 'APPROVED') {
      throw new ConflictException('Already approved');
    }

    const backgroundChecked = submission.policeClearanceKey != null;

    return this.prisma.$transaction(async (tx) => {
      await tx.tradesmanProfile.upsert({
        where: { userId: submission.userId },
        create: {
          userId: submission.userId,
          isVerified: true,
          backgroundChecked,
          yearsExperience: submission.yearsExperience,
          serviceRadiusKm: submission.serviceRadiusKm,
          city: submission.city,
          district: submission.district,
        },
        update: { isVerified: true, backgroundChecked },
      });
      return tx.tradesmanVerification.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
    });
  }

  async reject(reviewerId: string, id: string, dto: RejectVerificationDto) {
    const submission = await this.prisma.tradesmanVerification.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!submission) throw new NotFoundException('Verification not found');
    if (submission.status === 'APPROVED') {
      throw new ConflictException('Cannot reject an approved verification');
    }
    return this.prisma.tradesmanVerification.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
  }
}
