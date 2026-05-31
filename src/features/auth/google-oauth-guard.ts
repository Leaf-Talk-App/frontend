const KEY_PREFIX = 'leaf_google_oauth:';

export type GoogleOAuthStatus = 'pending' | 'success' | 'failed';

export function getGoogleOAuthStatus(code: string): GoogleOAuthStatus | null {
  const value = sessionStorage.getItem(`${KEY_PREFIX}${code}`);
  if (value === 'pending' || value === 'success' || value === 'failed') {
    return value;
  }
  return null;
}

export function setGoogleOAuthStatus(code: string, status: GoogleOAuthStatus) {
  sessionStorage.setItem(`${KEY_PREFIX}${code}`, status);
}

/** Evita reutilizar o mesmo authorization code (Google só aceita uma vez). */
export function claimGoogleOAuthCode(code: string): boolean {
  const key = `${KEY_PREFIX}${code}`;
  if (sessionStorage.getItem(key)) {
    return false;
  }
  sessionStorage.setItem(key, 'pending');
  return true;
}
