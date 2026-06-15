import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { groupsApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { useAuth } from '../../lib/auth/use-auth';
import type {
  CreateGroupRequest,
  GroupMessage,
  LeafGroup,
  MessageType,
  SendGroupMessageRequest,
  SetAdminRequest,
  UpdateGroupRequest,
} from '../../lib/api/contracts';

// helper: erro vindo do backend ({ error: "..." })
function hasError<T>(v: T | { error: string }): v is { error: string } {
  return Boolean(v) && typeof v === 'object' && 'error' in (v as object);
}

const MSG_LIMIT = 50;

// ── Lista de grupos do usuário ───────────────────────────────────────────────
export function useGroupsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.groups.mine,
    queryFn: async () => {
      if (!accessToken) throw new Error('No access token');
      return groupsApi.mine({ token: accessToken });
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 30_000,
  });
}

// ── Grupo único (detalhe) ────────────────────────────────────────────────────
export function useGroupQuery(groupId?: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.groups.byId(groupId ?? ''),
    queryFn: async (): Promise<LeafGroup | null> => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      const res = await groupsApi.getById(groupId, { token: accessToken });
      if (hasError(res)) return null;
      return res;
    },
    enabled: Boolean(groupId && accessToken),
    staleTime: 60_000,
  });
}

// ── Mensagens do grupo (infinite — mais antigas no topo) ─────────────────────
export function useGroupMessagesQuery(groupId?: string, enabled = true) {
  const { accessToken } = useAuth();

  const infiniteQuery = useInfiniteQuery({
    queryKey: groupId ? queryKeys.groups.messages(groupId) : ['groups', 'messages'],
    queryFn: async ({ pageParam = 0 }) => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      return groupsApi.messages(groupId, { token: accessToken }, pageParam as number, MSG_LIMIT);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < MSG_LIMIT) return undefined;
      return allPages.flat().length;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(groupId),
    staleTime: 2_000,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  // páginas chegam da mais recente p/ mais antiga → inverte as páginas e achata
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

// ── Criar grupo ──────────────────────────────────────────────────────────────
export function useCreateGroupMutation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGroupRequest) => {
      if (!accessToken) throw new Error('No access token');
      const res = await groupsApi.create(data, { token: accessToken });
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Enviar mensagem ao grupo (com atualização otimista) ──────────────────────
export function useSendGroupMessageMutation(groupId?: string) {
  const { accessToken, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendGroupMessageRequest) => {
      if (!accessToken) throw new Error('No access token');
      const res = await groupsApi.sendMessage(data, { token: accessToken });
      if (hasError(res)) throw new Error(res.error);
      return res;
    },

    onMutate: async (data) => {
      if (!groupId || !currentUser) return;
      const queryKey = queryKeys.groups.messages(groupId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<GroupMessage[]>>(queryKey);

      const optimistic: GroupMessage = {
        _id: `optimistic-${Date.now()}`,
        group_id: groupId,
        sender_id: currentUser.id,
        content: data.content,
        type: (data.type ?? 'text') as MessageType,
        file_url: data.file_url ?? null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<GroupMessage[]>>(queryKey, (old) => {
        if (!old) return { pages: [[optimistic]], pageParams: [0] };
        const pages = old.pages.map((p, i) => (i === 0 ? [...p, optimistic] : p));
        return { ...old, pages };
      });

      return { previous, queryKey };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(ctx.queryKey, ctx.previous);
      }
    },

    onSuccess: (res) => {
      if (!groupId || hasError(res)) return;
      const queryKey = queryKeys.groups.messages(groupId);
      queryClient.setQueryData<InfiniteData<GroupMessage[]>>(queryKey, (old) => {
        if (!old) return { pages: [[res]], pageParams: [0] };
        const pages = old.pages.map((p) =>
          p.map((m) => (m._id.startsWith('optimistic-') ? res : m)),
        );
        return { ...old, pages };
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Sair do grupo ────────────────────────────────────────────────────────────
export function useLeaveGroupMutation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!accessToken) throw new Error('No access token');
      return groupsApi.leave(groupId, { token: accessToken });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Adicionar membro (admin) ─────────────────────────────────────────────────
export function useAddMemberMutation(groupId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      const res = await groupsApi.addMember(
        { group_id: groupId, user_id: userId },
        { token: accessToken },
      );
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      if (groupId) queryClient.invalidateQueries({ queryKey: queryKeys.groups.byId(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Ações em mensagem do grupo (favoritar / apagar) ──────────────────────────
export function useGroupMessageActions(groupId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (groupId) queryClient.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) });
  };

  const favorite = useMutation({
    mutationFn: async (messageId: string) => {
      if (!accessToken) throw new Error('No access token');
      return groupsApi.favoriteMessage(messageId, { token: accessToken });
    },
    onSuccess: invalidate,
  });

  const deleteForMe = useMutation({
    mutationFn: async (messageId: string) => {
      if (!accessToken) throw new Error('No access token');
      return groupsApi.deleteMessageForMe(messageId, { token: accessToken });
    },
    onSuccess: invalidate,
  });

  const deleteForEveryone = useMutation({
    mutationFn: async (messageId: string) => {
      if (!accessToken) throw new Error('No access token');
      return groupsApi.deleteMessage(messageId, { token: accessToken });
    },
    onSuccess: invalidate,
  });

  return { favorite, deleteForMe, deleteForEveryone };
}

// ── Editar grupo: nome, descrição, regra de envio (admin) ────────────────────
export function useUpdateGroupMutation(groupId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<UpdateGroupRequest, 'group_id'>) => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      const res = await groupsApi.update({ group_id: groupId, ...data }, { token: accessToken });
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      if (groupId) queryClient.invalidateQueries({ queryKey: queryKeys.groups.byId(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Promover/rebaixar administrador (admin) ──────────────────────────────────
export function useSetAdminMutation(groupId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<SetAdminRequest, 'group_id'>) => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      const res = await groupsApi.setAdmin({ group_id: groupId, ...data }, { token: accessToken });
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      if (groupId) queryClient.invalidateQueries({ queryKey: queryKeys.groups.byId(groupId) });
    },
  });
}

// ── Remover membro (admin) ───────────────────────────────────────────────────
export function useRemoveMemberMutation(groupId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!accessToken || !groupId) throw new Error('Missing params');
      const res = await groupsApi.removeMember(
        { group_id: groupId, user_id: userId },
        { token: accessToken },
      );
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      if (groupId) queryClient.invalidateQueries({ queryKey: queryKeys.groups.byId(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}

// ── Entrar por código de convite ─────────────────────────────────────────────
export function useJoinGroupMutation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      if (!accessToken) throw new Error('No access token');
      const res = await groupsApi.join(code.trim(), { token: accessToken });
      if (hasError(res)) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
    },
  });
}
