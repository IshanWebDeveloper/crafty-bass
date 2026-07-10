'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { loadStripe } from '@stripe/stripe-js';
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { Button } from '@repo/ui';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { fundEscrow, type FundEscrowResult } from '@/lib/api/escrow';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
);

// Stripe Elements render inside an iframe, so the parent document's CSS custom
// properties (var(--foreground) etc.) are NOT visible to them — the card input
// fell back to Stripe's default dark text, invisible on our dark surface.
// Resolve a token to the concrete rgb() the browser computes for it so Stripe
// gets a literal colour it can use inside the iframe.
function resolveCssColor(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed || fallback;
}

// Collects card details via a Stripe Element, creates a PaymentMethod
// client-side, then hands it to POST /escrows/:id/fund. If Stripe requires
// additional authentication (3DS), confirms it here and re-submits once to
// finalize — the webhook is the authoritative fallback either way.
function CardPaymentForm({
  escrowId,
  submitLabel,
  submittingLabel,
  onFunded,
}: {
  escrowId: string;
  submitLabel: string;
  submittingLabel: string;
  onFunded: (result: FundEscrowResult) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState({
    foreground: '#0a0a0a',
    muted: '#71717a',
  });

  useEffect(() => {
    setColors({
      foreground: resolveCssColor('--foreground', '#0a0a0a'),
      muted: resolveCssColor('--muted-foreground', '#71717a'),
    });
  }, [resolvedTheme]);

  async function handleSubmit() {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setSubmitting(true);
    try {
      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({ type: 'card', card });
      if (pmError || !paymentMethod) {
        toast.error(pmError?.message ?? 'Card details are invalid');
        return;
      }

      let result = await fundEscrow(escrowId, 'card', paymentMethod.id);

      if (result.requiresAction && result.clientSecret) {
        const confirmed = await stripe.confirmCardPayment(result.clientSecret);
        if (confirmed.error) {
          toast.error(confirmed.error.message ?? 'Payment failed');
          return;
        }
        result = await fundEscrow(escrowId, 'card', paymentMethod.id);
      }

      onFunded(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fund');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background px-3 py-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '14px',
                color: colors.foreground,
                iconColor: colors.muted,
                '::placeholder': { color: colors.muted },
              },
            },
          }}
        />
      </div>
      <Button
        size="lg"
        className="h-auto w-full min-h-9 flex-wrap py-2 whitespace-normal"
        onClick={handleSubmit}
        disabled={!stripe || submitting}
      >
        <Lock className="size-4 shrink-0" aria-hidden />
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}

export function StripeCardForm(props: Parameters<typeof CardPaymentForm>[0]) {
  return (
    <Elements stripe={stripePromise}>
      <CardPaymentForm {...props} />
    </Elements>
  );
}
