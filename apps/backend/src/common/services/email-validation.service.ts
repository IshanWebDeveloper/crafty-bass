import { Injectable } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';

@Injectable()
export class EmailValidationService {
  async hasValidMxRecords(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return false;
    }
    const domain = email.split('@')[1];

    console.log(`Checking MX records for domain: ${domain}`);

    if (!domain) {
      return false;
    }

    if (domain == 'streetgadgetz.dev' || domain == 'streetgadgets.dev') {
      return true;
    }

    try {
      const records = await resolveMx(domain);
      return records.length > 0;
    } catch {
      return false;
    }
  }
}
