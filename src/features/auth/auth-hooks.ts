import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ApiError } from '../../lib/api/errors';
import { authApi, usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { useAuth } from '../../lib/auth/use-auth';
import type { UpdateProfileRequest, VerifyEmailRequest } from '../../lib/api/contracts';

type CurrentUserQueryOptions = {
  enabled?: boolean;
};

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const { setAccessToken } = useAuth();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess(data) {
      setAccessToken(data.access_token);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auth.currentUser,
      });
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: authApi.register,
  });
}

export function useCurrentUserQuery({ enabled = true }: CurrentUserQueryOptions = {}) {
  const { accessToken, clearAccessToken } = useAuth();

  return useQuery({
    queryKey: queryKeys.auth.currentUser,
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token.');
      }

      try {
        return await usersApi.me({ token: accessToken });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken();
        }

        throw error;
      }
    },
    enabled: Boolean(accessToken) && enabled,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAccessToken } = useAuth();

  return useCallback(() => {
    clearAccessToken();
    queryClient.removeQueries({ queryKey: queryKeys.auth.all });
  }, [clearAccessToken, queryClient]);
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      if (!accessToken) {
        throw new Error('No access token');
      }

      return usersApi.updateProfile(data, { token: accessToken });
    },
    onSuccess: () => {
      // Invalidate current user query to refetch updated data
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auth.currentUser,
      });
    },
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: authApi.verifyEmail,
  });
}

export function useResendCodeMutation() {
  return useMutation({
    mutationFn: (email: string) => authApi.resendCode(email),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword({ email }),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword({ token, password }),
  });
}

export function useGoogleAuthUrlMutation() {
  return useMutation({
    mutationFn: (redirectUri: string) => authApi.googleUrl(redirectUri),
  });
}

export function useGoogleExchangeMutation() {
  const queryClient = useQueryClient();
  const { setAccessToken } = useAuth();

  return useMutation({
    mutationFn: ({ code, redirectUri }: { code: string; redirectUri: string }) =>
      authApi.googleExchange({ code, redirect_uri: redirectUri }),
    onSuccess(data) {
      setAccessToken(data.access_token);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser });
    },
  });
}
