import { describe, expect, it } from 'vitest';
import { ApiError, getPayloadMessage } from './errors';

describe('ApiError', () => {
  it('uses FastAPI detail as the error message', () => {
    const error = new ApiError(401, { detail: 'Invalid credentials' });

    expect(error.message).toBe('Invalid credentials');
    expect(error.status).toBe(401);
    expect(error.payload).toEqual({ detail: 'Invalid credentials' });
  });

  it('falls back to a status message when the payload has no message', () => {
    const error = new ApiError(500, {});

    expect(error.message).toBe('Request failed with status 500');
  });
});

describe('getPayloadMessage', () => {
  it('reads supported backend error fields in priority order', () => {
    expect(
      getPayloadMessage({
        detail: 'detail message',
        message: 'message field',
        error: 'error field',
      }),
    ).toBe('detail message');
    expect(getPayloadMessage({ message: 'message field' })).toBe('message field');
    expect(getPayloadMessage({ error: 'error field' })).toBe('error field');
  });

  it('returns undefined for unsupported payloads', () => {
    expect(getPayloadMessage(null)).toBeUndefined();
    expect(getPayloadMessage('plain error')).toBeUndefined();
  });
});
