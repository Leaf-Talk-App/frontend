import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import type { AiChatRequest } from '../../lib/api/contracts';

export function useAiChatMutation() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (data: AiChatRequest) => {
      if (!accessToken) {
        throw new Error('No access token');
      }

      return aiApi.chat(data, { token: accessToken });
    },
  });
}
