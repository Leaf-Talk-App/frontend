import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';
import { tokenStorage } from './token-storage';

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number; // segundos (epoch)
}

/** Decodifica o payload do JWT sem verificar assinatura (seguro no cliente). */
function decodeJwt(token: string | null): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  } catch {
    return null;
  }
}

/** Payload VÁLIDO = tem sub/email E exp no futuro. Caso contrário → null (sessão inválida/expirada). */
function validPayload(token: string | null): JwtPayload | null {
  const p = decodeJwt(token);
  if (!p || !p.sub || !p.email) return null;
  if (typeof p.exp !== 'number' || p.exp * 1000 <= Date.now()) return null;
  return p;
}

export function AuthProvider({ children }: PropsWithChildren) {
  // Init: ao abrir o app, descarta token ausente/expirado antes de qualquer navegação.
  const [accessToken, setTokenState] = useState<string | null>(() => {
    const t = tokenStorage.get();
    if (t && !validPayload(t)) {
      tokenStorage.clear();
      return null;
    }
    return t;
  });

  const setAccessToken = useCallback((token: string) => {
    tokenStorage.set(token);
    setTokenState(token);
  }, []);

  const clearAccessToken = useCallback(() => {
    tokenStorage.clear();
    setTokenState(null);
  }, []);

  // Auto-logout: agenda a saída exatamente para quando o token expirar.
  useEffect(() => {
    const p = validPayload(accessToken);
    if (!p) {
      if (accessToken) clearAccessToken();
      return;
    }
    const ms = (p.exp as number) * 1000 - Date.now();
    const id = window.setTimeout(clearAccessToken, Math.max(0, ms));
    return () => window.clearTimeout(id);
  }, [accessToken, clearAccessToken]);

  const value = useMemo<AuthContextValue>(() => {
    const p = validPayload(accessToken);
    return {
      accessToken,
      user: p ? { id: p.sub as string, email: p.email as string } : null,
      isAuthenticated: Boolean(p),
      setAccessToken,
      clearAccessToken,
    };
  }, [accessToken, clearAccessToken, setAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
