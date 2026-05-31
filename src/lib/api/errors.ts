export type ApiErrorPayload = {
  detail?: string;
  message?: string;
  error?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: ApiErrorPayload | unknown;

  constructor(status: number, payload: ApiErrorPayload | unknown) {
    const message = getPayloadMessage(payload) || `Request failed with status ${status}`;

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getPayloadMessage(payload: ApiErrorPayload | unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as ApiErrorPayload;

  return candidate.detail ?? candidate.message ?? candidate.error;
}
