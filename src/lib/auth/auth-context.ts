import { createContext } from 'react';

export type AuthUser = {
  id: string;    // == JWT sub
  email: string;
};

export type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
