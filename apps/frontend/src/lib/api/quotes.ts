import { apiFetch } from '../api';

export type QuoteStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED';

export type QuoteLineCategory = 'LABOUR' | 'MATERIAL';

export type QuoteMaterial = {
  id: string;
  category: QuoteLineCategory;
  name: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
};

export type Quote = {
  id: string;
  jobId: string;
  tradesmanId: string;
  amount: number;
  materialsAmount: number | null;
  calloutFee: number | null;
  discount: number | null;
  vatRate: number | null;
  materials: QuoteMaterial[];
  depositRequested: number | null;
  currency: string;
  message: string | null;
  estimatedStart: string | null;
  estimatedCompletion: string | null;
  validUntil: string | null;
  status: QuoteStatus;
  respondedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  tradesman: {
    id: string;
    name: string;
    image: string | null;
    tradesmanProfile: {
      avgRating: number;
      ratingCount: number;
      jobsCompleted: number;
    } | null;
  };
};

export type CreateQuoteBody = {
  lineItems: {
    category: QuoteLineCategory;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
  }[];
  calloutFee?: number;
  discount?: number;
  applyVat?: boolean;
  validityDays: number;
  depositRequested?: number;
  currency: string;
  message?: string;
  estimatedStart?: string;
  estimatedCompletion?: string;
};

export type MyQuote = Omit<Quote, 'tradesman'> & {
  job: {
    id: string;
    title: string;
    status:
      | 'OPEN'
      | 'ASSIGNED'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'EXPIRED';
    city: string | null;
    district: string | null;
  };
};

export function listQuotesForJob(jobId: string) {
  return apiFetch<Quote[]>(`/jobs/${jobId}/quotes`);
}

export function listMyQuotes() {
  return apiFetch<MyQuote[]>(`/quotes/mine`);
}

export function createQuote(jobId: string, body: CreateQuoteBody) {
  return apiFetch<Quote>(`/jobs/${jobId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateQuote(id: string, body: CreateQuoteBody) {
  return apiFetch<Quote>(`/quotes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function acceptQuote(id: string) {
  return apiFetch<Quote>(`/quotes/${id}/accept`, { method: 'PATCH' });
}

export function rejectQuote(id: string) {
  return apiFetch<Quote>(`/quotes/${id}/reject`, { method: 'PATCH' });
}

export function withdrawQuote(id: string) {
  return apiFetch<Quote>(`/quotes/${id}/withdraw`, { method: 'PATCH' });
}
