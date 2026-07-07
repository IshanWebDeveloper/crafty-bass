import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { S3Service } from '../admin/s3.service.js';
import type {
  BrowseTradesmenDto,
  UpsertHomeownerProfileDto,
  UpsertTradesmanProfileDto,
} from './dto/index.js';

// Public avatar/portfolio images are stored as private R2 keys and presigned on
// read; a generous TTL keeps directory/profile URLs valid while the presigned
// cache dedupes repeated keys.
const PUBLIC_IMAGE_URL_TTL_SECONDS = 60 * 60;

// Normalises a free-text skill name into a catalog slug: lowercase, non-alphanumerics
// collapsed to hyphens, trimmed. Non-latin names (e.g. Sinhala/Tamil) collapse to
// empty, so we fall back to the lowercased name itself — still a stable, unique key.
function slugifySkill(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || name.trim().toLowerCase();
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  // Mints a signed URL for a stored object key, passing through null/empty.
  private async signImage(key: string | null): Promise<string | null> {
    if (!key) return key;
    return this.s3Service.getPresignedDownloadUrl(
      key,
      PUBLIC_IMAGE_URL_TTL_SECONDS,
    );
  }

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
    const { skillIds, skillNames, ...rest } = dto;
    const data = {
      bio: rest.bio ?? null,
      yearsExperience: rest.yearsExperience,
      hourlyRate: rest.hourlyRate ?? null,
      locationText: rest.locationText ?? null,
      city: rest.city ?? null,
      district: rest.district ?? null,
      serviceRadiusKm: rest.serviceRadiusKm,
      preferredLanguage: rest.preferredLanguage,
      // Only touch these when the client sends them so partial updates don't
      // wipe an existing list; the profile form always sends the full arrays.
      ...(rest.certifications !== undefined
        ? { certifications: rest.certifications }
        : {}),
      ...(rest.vehicles !== undefined ? { vehicles: rest.vehicles } : {}),
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

      // Only touch the skill set when the client sends either list, so partial
      // updates don't wipe existing skills. Typed skill names are find-or-created
      // in the shared catalog (deduped by slug) and merged with the catalog picks.
      if (skillIds || skillNames) {
        const resolvedIds: string[] = [];
        for (const name of skillNames ?? []) {
          const slug = slugifySkill(name);
          if (!slug) continue;
          const skill = await tx.skill.upsert({
            where: { slug },
            create: { slug, nameEn: name.trim() },
            update: {},
          });
          resolvedIds.push(skill.id);
        }
        const allSkillIds = Array.from(
          new Set([...(skillIds ?? []), ...resolvedIds]),
        );

        await tx.tradesmanSkill.deleteMany({
          where: { tradesmanProfileId: profile.id },
        });
        if (allSkillIds.length > 0) {
          await tx.tradesmanSkill.createMany({
            data: allSkillIds.map((skillId) => ({
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

  // Public directory of verified, available tradesmen. Decimals are coerced to
  // numbers so the JSON the directory page consumes matches its typed client.
  async listTradesmen(query: BrowseTradesmenDto) {
    const { page, limit, district, categoryId, skillId } = query;
    const skip = (page - 1) * limit;
    const where = {
      isVerified: true,
      isAvailable: true,
      ...(district ? { district } : {}),
      ...(skillId ? { skills: { some: { skillId } } } : {}),
      ...(categoryId ? { skills: { some: { skill: { categoryId } } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.tradesmanProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ avgRating: 'desc' }, { jobsCompleted: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              verification: { select: { primaryTrade: true } },
            },
          },
          skills: { include: { skill: true } },
        },
      }),
      this.prisma.tradesmanProfile.count({ where }),
    ]);

    const data = await Promise.all(
      rows.map(async (p) => ({
        userId: p.userId,
        name: p.user.name,
        image: await this.signImage(p.user.image),
        primaryTrade: p.user.verification?.primaryTrade ?? null,
        bio: p.bio,
        city: p.city,
        district: p.district,
        yearsExperience: p.yearsExperience,
        preferredLanguage: p.preferredLanguage,
        avgRating: Number(p.avgRating),
        ratingCount: p.ratingCount,
        jobsCompleted: p.jobsCompleted,
        isVerified: p.isVerified,
        skills: p.skills.map((s) => ({
          id: s.skill.id,
          nameEn: s.skill.nameEn,
        })),
      })),
    );

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async getTradesmanPublic(userId: string) {
    const profile = await this.prisma.tradesmanProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            verification: {
              select: { primaryTrade: true, portfolioKeys: true },
            },
          },
        },
        skills: { include: { skill: true } },
      },
    });
    if (!profile) throw new NotFoundException('Tradesman profile not found');

    // portfolioKeys is a Json column holding string[]; coerce defensively and
    // mint a signed URL per image.
    const portfolioKeys = Array.isArray(
      profile.user.verification?.portfolioKeys,
    )
      ? profile.user.verification.portfolioKeys.filter(
          (key): key is string => typeof key === 'string',
        )
      : [];
    const portfolio = (
      await Promise.all(portfolioKeys.map((key) => this.signImage(key)))
    ).filter((url): url is string => typeof url === 'string');

    return {
      userId: profile.userId,
      name: profile.user.name,
      image: await this.signImage(profile.user.image),
      portfolio,
      primaryTrade: profile.user.verification?.primaryTrade ?? null,
      bio: profile.bio,
      city: profile.city,
      district: profile.district,
      locationText: profile.locationText,
      yearsExperience: profile.yearsExperience,
      preferredLanguage: profile.preferredLanguage,
      certifications: profile.certifications,
      vehicles: profile.vehicles,
      hourlyRate:
        profile.hourlyRate != null ? Number(profile.hourlyRate) : null,
      serviceRadiusKm: profile.serviceRadiusKm,
      avgRating: Number(profile.avgRating),
      ratingCount: profile.ratingCount,
      jobsCompleted: profile.jobsCompleted,
      responseTimeMinutes: profile.responseTimeMinutes,
      isVerified: profile.isVerified,
      isAvailable: profile.isAvailable,
      skills: profile.skills.map((s) => ({
        id: s.skill.id,
        nameEn: s.skill.nameEn,
      })),
    };
  }
}
