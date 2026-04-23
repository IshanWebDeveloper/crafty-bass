import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

interface GrantConsentOptions {
  ipAddress?: string;
  consentVersion?: string;
  consentPayload?: Record<string, unknown>;
  grantedAt?: string;
}

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all consent records for a user.
   */
  async getConsents(userId: string) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Grant or update consent for a specific type.
   */
  async grantConsent(
    userId: string,
    consentType: string,
    options?: GrantConsentOptions,
  ) {
    const grantedAt = options?.grantedAt ?? new Date().toISOString();

    return this.prisma.userConsent.upsert({
      where: {
        userId_consentType: { userId, consentType },
      },
      create: {
        userId,
        consentType,
        granted: true,
        grantedAt,
        ipAddress: options?.ipAddress,
        consentVersion: options?.consentVersion,
        consentPayload: {
          toJSON() {
            return options?.consentPayload ?? {};
          },
        },
      },
      update: {
        granted: true,
        grantedAt,
        revokedAt: null,
        ipAddress: options?.ipAddress,
        consentVersion: options?.consentVersion,
        consentPayload: {
          toJSON() {
            return options?.consentPayload ?? {};
          },
        },
      },
    });
  }

  /**
   * Revoke consent for a specific type.
   */
  async revokeConsent(userId: string, consentType: string) {
    const consent = await this.prisma.userConsent.findUnique({
      where: {
        userId_consentType: { userId, consentType },
      },
    });

    if (!consent) {
      throw new NotFoundException(
        `No consent record found for type "${consentType}"`,
      );
    }

    return this.prisma.userConsent.update({
      where: { id: consent.id },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Check if a user has granted a specific consent type.
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const consent = await this.prisma.userConsent.findUnique({
      where: {
        userId_consentType: { userId, consentType },
      },
    });

    return consent?.granted ?? false;
  }
}
