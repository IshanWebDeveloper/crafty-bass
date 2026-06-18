import { resolveMx } from 'node:dns/promises';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lightweight deliverability check used before sending a verification email:
 * validates basic shape, then confirms the domain publishes MX records.
 */
export async function hasValidMxRecords(email: string): Promise<boolean> {
  if (!EMAIL_REGEX.test(email)) {
    return false;
  }

  const domain = email.split('@')[1];
  if (!domain) {
    return false;
  }

  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}
