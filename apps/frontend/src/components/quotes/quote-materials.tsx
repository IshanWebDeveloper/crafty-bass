import { Package } from 'lucide-react';
import type { QuoteMaterial } from '@/lib/api/quotes';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Renders a quote's itemised materials/tools (name, quantity, estimated unit
 * price). Decimal values arrive as numbers-or-strings over the wire, so we
 * coerce with Number() before formatting. Renders nothing when the list is empty.
 */
export function QuoteMaterials({
  materials,
  currency,
  dict,
}: {
  materials: QuoteMaterial[];
  currency: string;
  dict: Dictionary;
}) {
  const t = dict.quotes;
  if (!materials || materials.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5">
        <Package className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-semibold">{t.materialsHeading}</span>
        <span className="text-[0.7rem] text-muted-foreground">
          · {t.materialsEstimate}
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {materials.map((m) => {
          const qty = Number(m.quantity) || 1;
          const unit = m.unitPrice != null ? Number(m.unitPrice) : null;
          return (
            <li
              key={m.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">{qty}×</span>{' '}
                {m.name}
              </span>
              {unit != null ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {currency} {unit.toLocaleString()}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
