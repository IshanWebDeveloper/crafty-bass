import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { UpdatePrivacyPolicyDto } from './dto/index.js';

const PRIVACY_POLICY_KEY = 'privacy_policy';
const DEFAULT_PRIVACY_POLICY_VERSION = '2026-03-31';

const DEFAULT_PRIVACY_POLICY_CONTENT = `# StreetGadgetz Privacy Policy (UK GDPR)

Last updated: 31 March 2026

## 1. Who We Are
StreetGadgetz is the data controller for personal data processed through this platform.

## 2. What We Collect
We collect account details, order and payment records, delivery information, support communications, and service usage data needed to operate the store.

## 3. Why We Process Data
We process personal data to fulfil orders, provide customer support, secure accounts, meet legal obligations, and improve service quality.

## 4. Lawful Bases (UK GDPR)
Our processing relies on contract performance, legal obligations, legitimate interests, and consent where required.

## 5. Cookies and Tracking
Essential cookies are required for core site functionality. Non-essential cookies (analytics and marketing) are only used based on your preferences.

## 6. Data Sharing
We share data only with trusted processors needed for payments, delivery, communications, and platform operations under appropriate safeguards.

## 7. International Transfers
Where transfers outside the UK occur, we apply lawful safeguards such as adequacy decisions or approved contractual protections.

## 8. Retention
We retain personal data only as long as necessary for service delivery, legal compliance, and dispute resolution, then securely delete or anonymize it.

## 9. Your Rights
You may request access, correction, deletion, restriction, portability, and objection. You may also withdraw consent at any time.

## 10. Contact and Complaints
For privacy requests, contact support through StreetGadgetz. You may also complain to the UK Information Commissioner's Office (ICO).
`;

type LegalDocumentRecord = {
  id: string;
  key: string;
  title: string;
  version: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrivacyPolicy() {
    const existing = await this.prisma.$queryRaw<LegalDocumentRecord[]>`
      SELECT
        id,
        key,
        title,
        version,
        content,
        "createdAt",
        "updatedAt"
      FROM legal_document
      WHERE key = ${PRIVACY_POLICY_KEY}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    const created = await this.prisma.$queryRaw<LegalDocumentRecord[]>`
      INSERT INTO legal_document (id, key, title, version, content, "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()},
        ${PRIVACY_POLICY_KEY},
        ${'Privacy Policy'},
        ${DEFAULT_PRIVACY_POLICY_VERSION},
        ${DEFAULT_PRIVACY_POLICY_CONTENT},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        key,
        title,
        version,
        content,
        "createdAt",
        "updatedAt"
    `;

    return created[0];
  }

  async updatePrivacyPolicy(dto: UpdatePrivacyPolicyDto) {
    const updated = await this.prisma.$queryRaw<LegalDocumentRecord[]>`
      INSERT INTO legal_document (id, key, title, version, content, "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()},
        ${PRIVACY_POLICY_KEY},
        ${dto.title ?? 'Privacy Policy'},
        ${dto.version},
        ${dto.content},
        NOW(),
        NOW()
      )
      ON CONFLICT (key)
      DO UPDATE SET
        title = EXCLUDED.title,
        version = EXCLUDED.version,
        content = EXCLUDED.content,
        "updatedAt" = NOW()
      RETURNING
        id,
        key,
        title,
        version,
        content,
        "createdAt",
        "updatedAt"
    `;

    return updated[0];
  }
}
