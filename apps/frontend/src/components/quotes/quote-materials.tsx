import { Wrench, Package, CalendarClock } from 'lucide-react';
import type { QuoteMaterial } from '@/lib/api/quotes';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Renders a quote's estimate: its labour + material line items (with quantity,
 * unit and line totals), the call-out/discount/VAT adjustments, and how long the
 * quote stays valid. Decimal values arrive as numbers-or-strings over the wire,
 * so we coerce with Number() before formatting. Renders nothing when empty.
 */
export function QuoteMaterials({
  materials,
  currency,
  calloutFee,
  discount,
  vatRate,
  validUntil,
  locale,
  dict,
}: {
  materials: QuoteMaterial[];
  currency: string;
  calloutFee?: number | null;
  discount?: number | null;
  vatRate?: number | null;
  validUntil?: string | null;
  locale: Locale;
  dict: Dictionary;
}) {
  const tb = dict.quotes.submitQuote.builder;
  const hasLines = materials && materials.length > 0;
  if (!hasLines && !calloutFee && !discount) return null;

  const money = (n: number) => `${currency} ${n.toLocaleString()}`;
  const labour = materials.filter((m) => m.category === 'LABOUR');
  const material = materials.filter((m) => m.category !== 'LABOUR');

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      {labour.length > 0 ? (
        <LineGroup
          icon={<Wrench className="size-3.5" aria-hidden />}
          label={tb.labour}
          lines={labour}
          money={money}
        />
      ) : null}
      {material.length > 0 ? (
        <LineGroup
          icon={<Package className="size-3.5" aria-hidden />}
          label={tb.material}
          lines={material}
          money={money}
          className={labour.length > 0 ? 'mt-3' : undefined}
        />
      ) : null}

      {calloutFee || discount || vatRate ? (
        <div className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
          {calloutFee ? (
            <Adjustment label={tb.callout} value={money(Number(calloutFee))} />
          ) : null}
          {discount ? (
            <Adjustment
              label={tb.discount}
              value={`-${money(Number(discount))}`}
            />
          ) : null}
          {vatRate ? (
            <Adjustment label={`${tb.vat} ${Number(vatRate)}%`} value="" />
          ) : null}
        </div>
      ) : null}

      {validUntil ? (
        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          {tb.validUntil.replace(
            '{date}',
            new Date(validUntil).toLocaleDateString(locale),
          )}
        </p>
      ) : null}
    </div>
  );
}

function LineGroup({
  icon,
  label,
  lines,
  money,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  lines: QuoteMaterial[];
  money: (n: number) => string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <ul className="mt-1.5 space-y-1">
        {lines.map((m) => {
          const qty = Number(m.quantity) || 1;
          const unit = m.unitPrice != null ? Number(m.unitPrice) : null;
          return (
            <li
              key={m.id}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {qty}
                  {m.unit ? ` ${m.unit}` : ''} ×
                </span>{' '}
                {m.name}
              </span>
              {unit != null ? (
                <span className="shrink-0 font-mono text-xs">
                  {money(qty * unit)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Adjustment({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      {value ? <span className="font-mono">{value}</span> : null}
    </div>
  );
}
