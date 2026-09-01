import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { UpdatePrivacyPolicyDto } from './dto/index.js';

const PRIVACY_POLICY_KEY = 'privacy_policy';
const DEFAULT_PRIVACY_POLICY_VERSION = '2026-03-31';

const DEFAULT_PRIVACY_POLICY_CONTENT = `# Crafty Bass Privacy Policy (UK GDPR)

Last updated: 31 March 2026

## 1. Who We Are
Crafty Bass is the data controller for personal data processed through this marketplace, which connects homeowners with tradesmen.

## 2. What We Collect
We collect account details, profile information (including verification documents for tradesmen), job postings, quotes, messages between users, reviews, and service usage data needed to operate the marketplace.

## 3. Why We Process Data
We process personal data to match homeowners with tradesmen, facilitate quotes and communication, support reviews and disputes, secure accounts, meet legal obligations, and improve service quality.

## 4. Lawful Bases (UK GDPR)
Our processing relies on contract performance, legal obligations, legitimate interests, and consent where required.

## 5. Cookies and Tracking
Essential cookies are required for core site functionality. Non-essential cookies (analytics and marketing) are only used based on your preferences.

## 6. Data Sharing
We share data only with trusted processors needed for identity verification, communications, and platform operations under appropriate safeguards. Job details visible to tradesmen are limited to what is necessary to submit a quote.

## 7. International Transfers
Where transfers outside the UK occur, we apply lawful safeguards such as adequacy decisions or approved contractual protections.

## 8. Retention
We retain personal data only as long as necessary for service delivery, legal compliance, and dispute resolution, then securely delete or anonymize it.

## 9. Your Rights
You may request access, correction, deletion, restriction, portability, and objection. You may also withdraw consent at any time.

## 10. Contact and Complaints
For privacy requests, contact support through Crafty Bass. You may also complain to the UK Information Commissioner's Office (ICO).
`;

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrivacyPolicy() {
    const existing = await this.prisma.legalDocument.findUnique({
      where: { key: PRIVACY_POLICY_KEY },
    });

    if (existing) {
      return existing;
    }

    // Seed the shipped default on first read so a fresh database still serves a
    // policy. Two concurrent first reads would race, so treat a lost race as a
    // hit rather than a 500.
    return this.prisma.legalDocument.upsert({
      where: { key: PRIVACY_POLICY_KEY },
      update: {},
      create: {
        key: PRIVACY_POLICY_KEY,
        title: 'Privacy Policy',
        version: DEFAULT_PRIVACY_POLICY_VERSION,
        content: DEFAULT_PRIVACY_POLICY_CONTENT,
      },
    });
  }

  async updatePrivacyPolicy(dto: UpdatePrivacyPolicyDto) {
    const title = dto.title ?? 'Privacy Policy';

    return this.prisma.legalDocument.upsert({
      where: { key: PRIVACY_POLICY_KEY },
      update: { title, version: dto.version, content: dto.content },
      create: {
        key: PRIVACY_POLICY_KEY,
        title,
        version: dto.version,
        content: dto.content,
      },
    });
  }
}
