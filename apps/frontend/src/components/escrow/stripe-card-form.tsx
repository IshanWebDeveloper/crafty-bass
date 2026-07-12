'use client';

import { useState } from 'react';
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
                color: 'var(--foreground)',
                '::placeholder': { color: 'var(--muted-foreground)' },
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
