// Typed fetch wrapper for the Crafty Bass backend API.
// Centralizes the base URL, cookie credentials, JSON handling, and error
// normalization (formalizes the ad-hoc pattern previously in privacy-actions).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api/v1';

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
