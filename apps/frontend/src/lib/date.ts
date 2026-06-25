// Bridges the `yyyy-MM-dd` strings our date form fields store (the format a
// native <input type="date"> produces, and what `z.coerce.date()` accepts) with
// the `Date` objects the @repo/ui DatePicker works in. Deliberately local-time:
// building the Date from its parts (rather than `new Date('2026-06-26')`, which
// parses as UTC midnight) keeps a picked day from sliding to the day before in
// negative-offset timezones.

export function parseDateInput(
  value: string | undefined | null,
): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function formatDateInput(date: Date | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
