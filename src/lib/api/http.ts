import { env } from '../../config/env';
import { ApiError } from './errors';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token, headers, signal }: ApiRequestOptions = {},
) {
  const url = `${env.apiBaseUrl}${path}`;
  const builtHeaders = buildHeaders(body, token, headers);
  const serializedBody = serializeBody(body);

  // Log requisição
  if (import.meta.env.DEV) {
    console.log('[API] Request:', {
      method,
      url,
      headers: Object.fromEntries(builtHeaders),
      body: body && typeof body === 'object' ? body : serializedBody,
    });
  }

  const response = await fetch(url, {
    method,
    headers: builtHeaders,
    body: serializedBody,
    signal,
  });

  const payload = await parseResponse(response);

  // Log resposta
  if (import.meta.env.DEV) {
    console.log('[API] Response:', {
      status: response.status,
      statusText: response.statusText,
      payload,
    });
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}

function buildHeaders(body: unknown, token?: string | null, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  if (body && !(body instanceof FormData)) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  return nextHeaders;
}

function serializeBody(body: unknown) {
  if (!body) {
    return undefined;
  }

  if (body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}
