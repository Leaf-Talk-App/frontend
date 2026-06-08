import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import type { AiChatRequest } from '../../lib/api/contracts';

const AI_HISTORY_KEY = ['ai', 'history'] as const;

export function useAiChatMutation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AiChatRequest) => {
      if (!accessToken) {
        throw new Error('No access token');
      }

      return aiApi.chat(data, { token: accessToken });
    },
    // O backend persiste a mensagem antes de responder. Invalidar aqui garante
    // que, ao sair e voltar, o /ai/history traga TODAS as mensagens (inclusive
    // as recentes) — antes o cache stale (30s) escondia as últimas.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_HISTORY_KEY });
    },
  });
}

/**
 * Carrega o histórico persistido do Humberto (GET /ai/history).
 * O backend salva cada par usuário/assistente em `ai_conversations`,
 * então as mensagens sobrevivem a sair/voltar da tela.
 *
 * staleTime 0 + refetchOnMount 'always': ao remontar a tela, sempre busca a
 * versão fresca do servidor (não hidrata a partir de cache antigo).
 */
export function useAiHistoryQuery() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: AI_HISTORY_KEY,
    queryFn: () => aiApi.history({ token: accessToken! }),
    enabled: Boolean(accessToken),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useClearAiHistoryMutation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => aiApi.clearHistory({ token: accessToken! }),
    onSuccess: () => {
      queryClient.setQueryData(AI_HISTORY_KEY, []);
    },
  });
}
