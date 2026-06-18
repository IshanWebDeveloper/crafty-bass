import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  UpsertHomeownerProfileDto,
  UpsertTradesmanProfileDto,
} from './dto/index.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        userType: true,
        homeownerProfile: true,
        tradesmanProfile: {
          include: { skills: { include: { skill: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async upsertHomeowner(userId: string, dto: UpsertHomeownerProfileDto) {
    const data = {
      locationText: dto.locationText ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      postalCode: dto.postalCode ?? null,
      preferredLanguage: dto.preferredLanguage,
    };

    const [profile] = await this.prisma.$transaction([
      this.prisma.homeownerProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { userType: 'HOMEOWNER' },
      }),
    ]);

    return profile;
  }

  async upsertTradesman(userId: string, dto: UpsertTradesmanProfileDto) {
    const { skillIds, ...rest } = dto;
    const data = {
      bio: rest.bio ?? null,
      yearsExperience: rest.yearsExperience,
      hourlyRate: rest.hourlyRate ?? null,
      locationText: rest.locationText ?? null,
      city: rest.city ?? null,
      district: rest.district ?? null,
      serviceRadiusKm: rest.serviceRadiusKm,
      preferredLanguage: rest.preferredLanguage,
    };

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.tradesmanProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
      await tx.user.update({
        where: { id: userId },
        data: { userType: 'TRADESMAN' },
      });

      if (skillIds) {
        await tx.tradesmanSkill.deleteMany({
          where: { tradesmanProfileId: profile.id },
        });
        if (skillIds.length > 0) {
          await tx.tradesmanSkill.createMany({
            data: skillIds.map((skillId) => ({
              tradesmanProfileId: profile.id,
              skillId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.tradesmanProfile.findUnique({
        where: { id: profile.id },
        include: { skills: { include: { skill: true } } },
      });
    });
  }

  async getTradesmanPublic(userId: string) {
    const profile = await this.prisma.tradesmanProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, image: true } },
        skills: { include: { skill: true } },
      },
    });
    if (!profile) throw new NotFoundException('Tradesman profile not found');
    return profile;
  }
}
