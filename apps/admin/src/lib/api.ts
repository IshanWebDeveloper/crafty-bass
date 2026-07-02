// Typed fetch wrapper for the Crafty Bass backend API.
// Mirrors apps/frontend/src/lib/api.ts: centralizes the base URL, cookie
// credentials, JSON handling, and error normalization so the admin app shares
// the same calling convention as the homeowner/tradesman web app.

// In the browser, calls go through the same-origin /api/* rewrite
// (next.config.ts), so a relative base keeps the better-auth cookie first-party.
// On the server there is no proxy hop, so reach the API origin directly.
export const API_BASE_URL =
  typeof window === 'undefined'
    ? `${process.env.API_PROXY_TARGET ?? 'http://localhost:3005'}/api/v1`
    : '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const hasJsonBody =
    init?.body !== undefined && !(init.body instanceof FormData);

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // non-JSON error body
    }
    const message =
      (body as { message?: string } | undefined)?.message ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  return (
    contentType.includes('application/json')
      ? await response.json()
      : await response.text()
  ) as T;
}

// Shared shape returned by the backend's paginated list endpoints
// (buildPaginationMeta in apps/backend/src/common/dto/pagination.dto.ts).
export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

// Serializes a params object into a `?a=b&c=d` query string, dropping
// undefined/empty values. Shared by the feature API modules.
export function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
