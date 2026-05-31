const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_WS_BASE_URL = 'ws://localhost:8000';

export const env = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? DEFAULT_API_BASE_URL,
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, '') ?? DEFAULT_WS_BASE_URL,
};
