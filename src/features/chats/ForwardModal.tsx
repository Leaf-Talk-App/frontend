import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, Send, X } from 'lucide-react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../components/avatar/Avatar';
import { messagesApi, usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { useAuth } from '../../lib/auth/use-auth';
import { useChatsQuery } from './chats-hooks';
import type { LeafMessage, LeafUser } from '../../lib/api/contracts';
import './forward-modal.css';

interface ForwardModalProps {
  message: LeafMessage;
  onClose: () => void;
}

/**
 * Encaminhar uma mensagem para uma conversa existente. Lista as conversas do
 * usuário, resolve o nome do outro participante e reusa POST /messages/send
 * (mesma mensagem: conteúdo + tipo + anexo) — sem alteração no backend.
 */
export function ForwardModal({ message, onClose }: ForwardModalProps) {
  const { accessToken, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: chats, isLoading: chatsLoading } = useChatsQuery();
  const [search, setSearch] = useState('');
  const [doneId, setDoneId] = useState<string | null>(null);

  // IDs dos outros participantes (igual à lista de conversas)
  const participantIds = useMemo(() => {
    if (!chats || !currentUser) return [];
    const ids = new Set<string>();
    chats.forEach((chat) => {
      const others = chat.participants?.filter((id) => id !== currentUser.id) ?? [];
      if (others.length) others.forEach((id) => ids.add(id));
      else if (chat.participants?.length) ids.add(chat.participants[0]);
    });
    return Array.from(ids);
  }, [chats, currentUser]);

  const userQueries = useQueries({
    queries: participantIds.map((userId) => ({
      queryKey: ['users', 'id', userId],
      queryFn: () => usersApi.getById(userId, { token: accessToken! }),
      enabled: Boolean(accessToken),
      staleTime: 5 * 60_000,
    })),
  });

  const usersMap = useMemo(() => {
    const map: Record<string, LeafUser> = {};
    userQueries.forEach((q, i) => {
      if (q.data) map[participantIds[i]] = q.data;
    });
    return map;
  }, [userQueries, participantIds]);

  const forwardMutation = useMutation({
    mutationFn: ({ chatId, receiverId }: { chatId: string; receiverId: string }) =>
      messagesApi.send(
        {
          chat_id: chatId,
          receiver_id: receiverId,
          content: message.content,
          type: message.type ?? 'text',
          file_url: message.file_url ?? null,
        },
        { token: accessToken! },
      ),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.byChatId(vars.chatId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      setDoneId(vars.chatId);
      // fecha logo após o feedback de "enviado"
      window.setTimeout(onClose, 700);
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (chats ?? [])
      .map((chat) => {
        const otherId =
          chat.participants?.find((id) => id !== currentUser?.id) ?? chat.participants?.[0];
        const other = otherId ? usersMap[otherId] : undefined;
        const name = other?.display_name || other?.name || '';
        return { chatId: chat._id, receiverId: otherId ?? '', name, other };
      })
      .filter((r) => r.receiverId && (!term || r.name.toLowerCase().includes(term)));
  }, [chats, currentUser?.id, usersMap, search]);

  return createPortal(
    <div className="chat-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chat-modal__card forward-modal" onClick={(e) => e.stopPropagation()}>
        <button className="chat-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2.2} />
        </button>
        <h3 className="chat-modal__name">Encaminhar para…</h3>

        <div className="forward-modal__search">
          <Search size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa…"
            aria-label="Buscar conversa"
            autoFocus
          />
        </div>

        {chatsLoading ? (
          <p className="chat-modal__empty">Carregando conversas…</p>
        ) : rows.length === 0 ? (
          <p className="chat-modal__empty">Nenhuma conversa encontrada.</p>
        ) : (
          <ul className="forward-modal__list">
            {rows.map((r) => {
              const initials = (r.name || '?')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const sent = doneId === r.chatId;
              return (
                <li key={r.chatId}>
                  <button
                    className="forward-modal__row"
                    disabled={forwardMutation.isPending || sent}
                    onClick={() =>
                      forwardMutation.mutate({ chatId: r.chatId, receiverId: r.receiverId })
                    }
                  >
                    <Avatar src={r.other?.avatar} initials={initials} size="sm" online={r.other?.online} />
                    <span className="forward-modal__row-name">{r.name || 'Usuário removido'}</span>
                    {sent ? (
                      <Check size={18} strokeWidth={2.4} className="forward-modal__sent" />
                    ) : (
                      <Send size={16} strokeWidth={2.2} className="forward-modal__send-icon" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
