// Normalise a Sri Lankan mobile number to E.164 (+94XXXXXXXXX).
// Accepts local formats like "077 123 4567", "0771234567", "771234567",
// or "+94771234567". Returns null if it isn't a valid 9-digit national number.
export function toE164LK(input: string): string | null {
  let national = (input || '').replace(/\D/g, '');
  if (national.startsWith('94')) national = national.slice(2);
  else if (national.startsWith('0')) national = national.slice(1);
  if (national.length !== 9) return null;
  return `+94${national}`;
}
