'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Wrench, Package } from 'lucide-react';
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { maxDeposit, computeQuoteTotals, VAT_RATE } from '@repo/validation';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createQuote } from '@/lib/api/quotes';
import { getMyProfile } from '@/lib/api/profiles';
import { DepositEligibility } from '@/components/escrow/deposit-eligibility';
import { formatLKR } from '@/lib/currency';
import { ApiError } from '@/lib/api';
import { parseDateInput, formatDateInput } from '@/lib/date';
import type { Dictionary } from '@/i18n/dictionaries';

// Units of measurement for a line's quantity — labour (job, hr, point…) and
// materials (kg, m, bag…) share one list.
const UNITS = [
  'job',
  'hr',
  'visit',
  'point',
  'fitting',
  'pcs',
  'set',
  'pair',
  'kg',
  'g',
  'm',
  'cm',
  'm²',
  'm³',
  'l',
  'ml',
  'inch',
  'bag',
  'box',
  'roll',
  'sheet',
] as const;

const LineItemSchema = z.object({
  category: z.enum(['LABOUR', 'MATERIAL']),
  name: z.string().trim().max(160),
  quantity: z.string(),
  unit: z.string(),
  unitPrice: z.string(),
});

const SubmitQuoteSchema = z.object({
  lineItems: z.array(LineItemSchema),
  calloutFee: z.string().optional(),
  discount: z.string().optional(),
  applyVat: z.boolean(),
  validityDays: z.string(),
  currency: z.string().trim().length(3),
  message: z.string().trim().max(2000).optional(),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
  wantDeposit: z.boolean(),
  deposit: z.string().optional(),
});
type SubmitQuoteValues = z.infer<typeof SubmitQuoteSchema>;

const emptyLine = (category: 'LABOUR' | 'MATERIAL') => ({
  category,
  name: '',
  quantity: '1',
  unit: category === 'LABOUR' ? 'job' : '',
  unitPrice: '',
});

const num = (v: string | undefined) => Number(v) || 0;

export function SubmitQuotePanel({
  jobId,
  dict,
}: {
  jobId: string;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.quotes;
  const ts = t.submitQuote;
  const tb = ts.builder;
  const [alreadyQuoted, setAlreadyQuoted] = useState(false);

  const { register, handleSubmit, watch, setValue, control, reset } =
    useForm<SubmitQuoteValues>({
      resolver: zodResolver(SubmitQuoteSchema),
      defaultValues: {
        lineItems: [emptyLine('LABOUR'), emptyLine('MATERIAL')],
        calloutFee: '',
        discount: '',
        applyVat: false,
        validityDays: '14',
        currency: 'LKR',
        message: '',
        estimatedStart: '',
        estimatedCompletion: '',
        wantDeposit: false,
        deposit: '',
      },
    });

  const lineItems = useFieldArray({ control, name: 'lineItems' });

  const watchedLines = watch('lineItems') ?? [];
  const applyVat = watch('applyVat');
  const wantDeposit = watch('wantDeposit');
  const deposit = num(watch('deposit'));

  // Live breakdown — computed with the same helper the backend uses, so the
  // preview matches what gets stored.
  const totals = computeQuoteTotals(
    watchedLines.map((l) => ({
      category: l.category,
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
    })),
    {
      calloutFee: num(watch('calloutFee')),
      discount: num(watch('discount')),
      applyVat,
    },
  );

  // Only fetch the tradesman's trust profile once they opt into a deposit.
  const { data: profile } = useQuery({
    queryKey: ['profiles', 'me'],
    queryFn: getMyProfile,
    enabled: wantDeposit,
    staleTime: 60_000,
  });

  const trust = {
    verified: profile?.tradesmanProfile?.isVerified ?? false,
    rating: profile?.tradesmanProfile?.avgRating ?? 0,
    completed: profile?.tradesmanProfile?.jobsCompleted ?? 0,
    bgChecked: profile?.tradesmanProfile?.backgroundChecked ?? false,
  };
  const allowedDeposit = maxDeposit(trust, totals.total, totals.materials);
  const cappedDeposit = Math.min(deposit, allowedDeposit);

  const lineForSubmit = watchedLines
    .map((l) => ({
      category: l.category,
      name: l.name.trim(),
      quantity: num(l.quantity) || 1,
      unit: l.unit || undefined,
      unitPrice: num(l.unitPrice),
    }))
    .filter((l) => l.name.length > 0 && l.unitPrice > 0);

  const canSubmit = lineForSubmit.length > 0;

  const mutation = useMutation({
    mutationFn: (values: SubmitQuoteValues) =>
      createQuote(jobId, {
        lineItems: lineForSubmit,
        calloutFee: values.calloutFee ? num(values.calloutFee) : undefined,
        discount: values.discount ? num(values.discount) : undefined,
        applyVat: values.applyVat,
        validityDays: Number(values.validityDays) || 14,
        depositRequested:
          values.wantDeposit && cappedDeposit > 0 ? cappedDeposit : undefined,
        currency: values.currency,
        message: values.message || undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      }),
    onSuccess: () => {
      toast.success(ts.success);
      reset();
      void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      void qc.invalidateQueries({ queryKey: ['my-quotes'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyQuoted(true);
        toast.info(err.message);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit quote',
      );
    },
  });

  if (alreadyQuoted) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{ts.heading}</CardTitle>
        <CardDescription>{ts.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => {
            if (canSubmit) mutation.mutate(v);
          })}
          className="space-y-5"
        >
          {/* Line items */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">{tb.estimate}</span>
              <span className="text-xs text-muted-foreground">
                {tb.estimateHint}
              </span>
            </div>

            {lineItems.fields.map((field, index) => (
              <LineRow
                key={field.id}
                index={index}
                category={watchedLines[index]?.category ?? 'MATERIAL'}
                amount={
                  num(watchedLines[index]?.quantity) *
                  num(watchedLines[index]?.unitPrice)
                }
                register={register}
                setValue={setValue}
                unitValue={watchedLines[index]?.unit}
                onRemove={() => lineItems.remove(index)}
                canRemove={lineItems.fields.length > 1}
                tb={tb}
                ts={ts}
              />
            ))}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => lineItems.append(emptyLine('LABOUR'))}
              >
                <Wrench className="size-4" aria-hidden />
                {tb.addLabour}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => lineItems.append(emptyLine('MATERIAL'))}
              >
                <Package className="size-4" aria-hidden />
                {tb.addMaterial}
              </Button>
            </div>
          </div>

          {/* Adjustments */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">{tb.adjustments}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-callout">{tb.callout}</Label>
                <Input
                  id="quote-callout"
                  type="number"
                  min={0}
                  step="0.01"
                  {...register('calloutFee')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-discount">{tb.discount}</Label>
                <Input
                  id="quote-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  {...register('discount')}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={applyVat}
                onCheckedChange={(c) => setValue('applyVat', c === true)}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium">
                  {tb.applyVat.replace('{rate}', String(VAT_RATE))}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {tb.vatHint}
                </span>
              </span>
            </label>
          </div>

          {/* Breakdown */}
          <div className="space-y-1 rounded-lg border border-border p-4 font-mono text-sm">
            <BreakdownRow label={tb.labour} value={formatLKR(totals.labour)} />
            <BreakdownRow
              label={tb.material}
              value={formatLKR(totals.materials)}
            />
            {totals.callout > 0 ? (
              <BreakdownRow
                label={tb.callout}
                value={formatLKR(totals.callout)}
              />
            ) : null}
            {totals.discount > 0 ? (
              <BreakdownRow
                label={tb.discount}
                value={`–${formatLKR(totals.discount)}`}
                muted
              />
            ) : null}
            <BreakdownRow
              label={tb.subtotal}
              value={formatLKR(totals.subtotal)}
            />
            {applyVat ? (
              <BreakdownRow
                label={`${tb.vat} ${VAT_RATE}%`}
                value={formatLKR(totals.vat)}
              />
            ) : null}
            <div className="mt-1.5 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>{tb.total}</span>
              <span>{formatLKR(totals.total)}</span>
            </div>
          </div>

          {/* Currency + validity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quote-currency">{ts.currency}</Label>
              <Input id="quote-currency" {...register('currency')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-validity">{tb.validity}</Label>
              <Input
                id="quote-validity"
                type="number"
                min={1}
                max={90}
                {...register('validityDays')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote-message">{t.message}</Label>
            <Textarea id="quote-message" rows={3} {...register('message')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quote-start">{t.estimatedStart}</Label>
              <DatePicker
                id="quote-start"
                value={parseDateInput(watch('estimatedStart'))}
                onChange={(date) =>
                  setValue('estimatedStart', formatDateInput(date), {
                    shouldValidate: true,
                  })
                }
                disabledDates={{ before: new Date() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-completion">{t.estimatedCompletion}</Label>
              <DatePicker
                id="quote-completion"
                value={parseDateInput(watch('estimatedCompletion'))}
                onChange={(date) =>
                  setValue('estimatedCompletion', formatDateInput(date), {
                    shouldValidate: true,
                  })
                }
                disabledDates={{ before: new Date() }}
              />
            </div>
          </div>

          {/* Escrow deposit */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={wantDeposit}
                onCheckedChange={(c) => setValue('wantDeposit', c === true)}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-semibold">
                  {ts.requestDeposit}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {ts.requestDepositHint}
                </span>
              </span>
            </label>

            {wantDeposit ? (
              <div className="space-y-3 border-t border-border pt-3">
                <DepositEligibility
                  trust={trust}
                  quoteTotal={totals.total}
                  materialsAmount={totals.materials}
                  dict={dict}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quote-deposit">{ts.depositToRequest}</Label>
                    <span className="text-xs text-muted-foreground">
                      {ts.depositMax.replace(
                        '{amount}',
                        formatLKR(allowedDeposit),
                      )}
                    </span>
                  </div>
                  <Input
                    id="quote-deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    max={allowedDeposit}
                    {...register('deposit')}
                  />
                  {totals.total > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {ts.depositPercent
                        .replace(
                          '{pct}',
                          String(
                            Math.round((cappedDeposit / totals.total) * 100),
                          ),
                        )
                        .replace(
                          '{balance}',
                          formatLKR(totals.total - cappedDeposit),
                        )}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {!canSubmit ? (
            <p className="text-xs text-muted-foreground">{tb.atLeastOneLine}</p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending
              ? ts.submitting
              : `${ts.submit} · ${formatLKR(totals.total)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type Builder = Dictionary['quotes']['submitQuote']['builder'];
type Sub = Dictionary['quotes']['submitQuote'];

function LineRow({
  index,
  category,
  amount,
  register,
  setValue,
  unitValue,
  onRemove,
  canRemove,
  tb,
  ts,
}: {
  index: number;
  category: 'LABOUR' | 'MATERIAL';
  amount: number;
  register: ReturnType<typeof useForm<SubmitQuoteValues>>['register'];
  setValue: ReturnType<typeof useForm<SubmitQuoteValues>>['setValue'];
  unitValue: string | undefined;
  onRemove: () => void;
  canRemove: boolean;
  tb: Builder;
  ts: Sub;
}) {
  const isLabour = category === 'LABOUR';
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={
            isLabour
              ? 'flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'flex size-6 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400'
          }
        >
          {isLabour ? (
            <Wrench className="size-3.5" aria-hidden />
          ) : (
            <Package className="size-3.5" aria-hidden />
          )}
        </span>
        <Input
          aria-label={isLabour ? tb.labour : tb.material}
          placeholder={isLabour ? tb.labourPlaceholder : tb.materialPlaceholder}
          className="h-8 flex-1"
          {...register(`lineItems.${index}.name`)}
        />
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={ts.materialsList.remove}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-[3.5rem_1fr_1fr_auto] items-center gap-2 pl-8">
        <Input
          aria-label={ts.materialsList.quantity}
          type="number"
          min={0}
          step="0.01"
          className="h-8"
          {...register(`lineItems.${index}.quantity`)}
        />
        <Select
          value={unitValue || undefined}
          onValueChange={(value) =>
            setValue(`lineItems.${index}.unit`, (value as string) ?? '')
          }
        >
          <SelectTrigger className="h-8" aria-label={ts.materialsList.unit}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label={tb.rate}
          type="number"
          min={0}
          step="0.01"
          placeholder={tb.rate}
          className="h-8"
          {...register(`lineItems.${index}.unitPrice`)}
        />
        <span className="ml-auto min-w-16 text-right font-mono text-sm font-medium">
          {formatLKR(amount)}
        </span>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>
        {value}
      </span>
    </div>
  );
}
