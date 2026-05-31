import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { AuthContext, type AuthContextValue, type AuthUser } from './auth-context';
import { tokenStorage } from './token-storage';

/** Decodifica o payload do JWT sem verificar assinatura (seguro no cliente). */
function parseJwtUser(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub || !payload.email) return null;
    return { id: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setTokenState] = useState<string | null>(() => tokenStorage.get());

  const setAccessToken = useCallback((token: string) => {
    tokenStorage.set(token);
    setTokenState(token);
  }, []);

  const clearAccessToken = useCallback(() => {
    tokenStorage.clear();
    setTokenState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user: parseJwtUser(accessToken),
      isAuthenticated: Boolean(accessToken),
      setAccessToken,
      clearAccessToken,
    }),
    [accessToken, clearAccessToken, setAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
