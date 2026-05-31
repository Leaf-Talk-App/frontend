import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { apiRequest } from './http';

const originalFetch = globalThis.fetch;

describe('apiRequest', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends JSON requests with bearer authentication', async () => {
    mockFetchJson({ ok: true });

    const payload = await apiRequest<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: '123456',
      },
      token: 'token-123',
    });

    expect(payload).toEqual({ ok: true });

    const [, init] = getFetchCall();
    const headers = init.headers as Headers;

    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        email: 'user@example.com',
        password: '123456',
      }),
    );
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not set JSON content type for FormData uploads', async () => {
    mockFetchJson({ url: '/storage/file.pdf' });

    const formData = new FormData();
    formData.append('file', new Blob(['pdf']), 'file.pdf');

    await apiRequest('/uploads/file', {
      method: 'POST',
      body: formData,
    });

    const [, init] = getFetchCall();
    const headers = init.headers as Headers;

    expect(init.body).toBe(formData);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('parses empty responses as null', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    await expect(apiRequest('/messages/read/chat-id')).resolves.toBeNull();
  });

  it('throws ApiError with backend payload for failed responses', async () => {
    mockFetchJson(
      { detail: 'Invalid credentials' },
      {
        status: 401,
      },
    );

    await expect(apiRequest('/auth/login')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invalid credentials',
      status: 401,
      payload: { detail: 'Invalid credentials' },
    } satisfies Partial<ApiError>);
  });
});

function mockFetchJson(payload: unknown, init?: ResponseInit) {
  vi.mocked(globalThis.fetch).mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: init?.status ?? 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  );
}

function getFetchCall() {
  const calls = vi.mocked(globalThis.fetch).mock.calls;
  const call = calls.at(-1);

  if (!call) {
    throw new Error('fetch was not called.');
  }

  return call as [string, RequestInit];
}
