import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { chatsApi, messagesApi, usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import type {
  LeafChatSummary,
  LeafMessage,
  LeafUser,
  MessageType,
  SendMessageRequest,
} from '../../lib/api/contracts';
import { useAuth } from '../../lib/auth/use-auth';

// ── Lista de chats do usuário ────────────────────────────────────────────────
interface UseChatsSummaryOptions {
  enabled?: boolean;
}

export function useChatsQuery({ enabled = true }: UseChatsSummaryOptions = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: queryKeys.chats.mine,
    queryFn: async () => {
      if (!accessToken) throw new Error('No access token');
      return chatsApi.mine({ token: accessToken });
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 30_000,
  });
}

// ── Chat único por ID — resolve o problema do currentChat undefined ──────────
export function useChatQuery(chatId?: string) {
  const { accessToken } = useAuth();
  const chatsQuery = useChatsQuery();

  // Tenta resolver do cache da lista primeiro (sem request extra)
  const fromList = useMemo(
    () => chatsQuery.data?.find((c) => c._id === chatId),
    [chatsQuery.data, chatId],
  );

  const singleQuery = useQuery({
    queryKey: queryKeys.chats.byId(chatId ?? ''),
    queryFn: async () => {
      if (!accessToken || !chatId) throw new Error('Missing params');
      return chatsApi.getById(chatId, { token: accessToken });
    },
    // busca individualmente só quando a lista não trouxe o chat
    enabled: Boolean(chatId && accessToken && !fromList && !chatsQuery.isLoading),
    staleTime: 60_000,
  });

  return {
    data: fromList ?? singleQuery.data,
    isLoading: chatsQuery.isLoading || (!fromList && singleQuery.isLoading),
    error: singleQuery.error,
  };
}

// ── Participante de um chat (busca dados do usuário pelo ID) ─────────────────
export function useParticipantQuery(userId?: string) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['users', 'id', userId ?? ''],
    queryFn: async () => {
      if (!accessToken || !userId) throw new Error('Missing params');
      return usersApi.getById(userId, { token: accessToken });
    },
    enabled: Boolean(userId && accessToken),
    staleTime: 5 * 60_000,
  });
}

const MSG_LIMIT = 50;

// ── Mensagens de um chat (infinite scroll — mais antigas no topo) ─────────────
interface UseMessagesQueryOptions {
  chatId?: string;
  enabled?: boolean;
}

export function useMessagesQuery({ chatId, enabled = true }: UseMessagesQueryOptions = {}) {
  const { accessToken } = useAuth();

  const infiniteQuery = useInfiniteQuery({
    queryKey: chatId ? queryKeys.messages.byChatId(chatId) : ['messages'],
    queryFn: async ({ pageParam = 0 }) => {
      if (!accessToken || !chatId) throw new Error('Missing access token or chatId');
      return messagesApi.history(chatId, { token: accessToken }, pageParam as number, MSG_LIMIT);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // se voltou menos de MSG_LIMIT itens, não há mais páginas
      if (lastPage.length < MSG_LIMIT) return undefined;
      return allPages.flat().length; // skip = total já carregado
    },
    enabled: enabled && Boolean(accessToken) && Boolean(chatId),
    staleTime: 5_000,
  });

  // Flatten em ordem cronológica. As páginas chegam da mais RECENTE (página 0)
  // para a mais antiga (paginação desc no backend), e cada página já vem em
  // ordem cronológica interna → inverte a ordem DAS PÁGINAS antes de achatar.
  const data = infiniteQuery.data
    ? [...infiniteQuery.data.pages].reverse().flat()
    : undefined;

  return {
    ...infiniteQuery,
    data,
    fetchOlderMessages: infiniteQuery.fetchNextPage,
    hasOlderMessages: infiniteQuery.hasNextPage,
    isFetchingOlder: infiniteQuery.isFetchingNextPage,
  };
}

// ── Envio de mensagem com atualização otimista ────────────────────────────────
export function useSendMessageMutation() {
  const { accessToken, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendMessageRequest) => {
      if (!accessToken) throw new Error('No access token');
      return messagesApi.send(data, { token: accessToken });
    },

    // Atualização otimista: adiciona ao cache InfiniteData<LeafMessage[]>
    onMutate: async (data) => {
      if (!data.chat_id || !currentUser) return;

      const queryKey = queryKeys.messages.byChatId(data.chat_id);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<InfiniteData<LeafMessage[]>>(queryKey);

      const optimisticMessage: LeafMessage = {
        _id: `optimistic-${Date.now()}`,
        chat_id: data.chat_id,
        sender_id: currentUser.id,
        receiver_id: data.receiver_id,
        content: data.content ?? '',
        type: (data.type ?? 'text') as MessageType,
        file_url: data.file_url ?? null,
        status: 'sent',
        read: false,
        edited: false,
        deleted: false,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<LeafMessage[]>>(queryKey, (old) => {
        if (!old) return { pages: [[optimisticMessage]], pageParams: [0] };
        // Adiciona ao FIM da página 0 — que é a janela mais recente
        // (paginação desc: página 0 = últimas 50, em ordem cronológica)
        const updatedPages = old.pages.map((page, i) =>
          i === 0 ? [...page, optimisticMessage] : page,
        );
        return { ...old, pages: updatedPages };
      });

      return { previous, queryKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },

    onSuccess: (response, variables) => {
      if (!variables.chat_id) return;

      const queryKey = queryKeys.messages.byChatId(variables.chat_id);

      if (response._id) {
        const realMessage: LeafMessage = {
          _id: response._id,
          chat_id: response.chat_id ?? variables.chat_id,
          sender_id: response.sender_id ?? currentUser?.id ?? '',
          receiver_id: response.receiver_id ?? variables.receiver_id,
          content: response.content ?? variables.content ?? '',
          type: (response.type ?? variables.type ?? 'text') as MessageType,
          file_url: response.file_url ?? variables.file_url ?? null,
          status: response.status,
          read: response.read ?? false,
          edited: response.edited ?? false,
          deleted: response.deleted ?? false,
          created_at: response.created_at ?? new Date().toISOString(),
        };

        // Substitui otimista pela real em todas as páginas
        queryClient.setQueryData<InfiniteData<LeafMessage[]>>(queryKey, (old) => {
          if (!old) return { pages: [[realMessage]], pageParams: [0] };
          const updatedPages = old.pages.map((page) =>
            page.map((m) => (m._id.startsWith('optimistic-') ? realMessage : m)),
          );
          return { ...old, pages: updatedPages };
        });
      } else {
        queryClient.invalidateQueries({ queryKey });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
    },
  });
}

// ── Chats enriquecidos com dados do outro usuário (usado na lista) ────────────
export interface EnrichedChatItem extends LeafChatSummary {
  otherUser?: LeafUser;
}

export function useChatsWithUsers() {
  const { accessToken } = useAuth();
  const chatsQuery = useChatsQuery();

  const enrichedChats = useMemo<EnrichedChatItem[]>(() => {
    if (!chatsQuery.data) return [];
    return chatsQuery.data.map((chat) => ({
      ...chat,
      otherUser: undefined, // populated per-item via useParticipantQuery
    }));
  }, [chatsQuery.data]);

  return {
    chats: enrichedChats,
    isLoading: chatsQuery.isLoading,
    error: chatsQuery.error,
  };
}
