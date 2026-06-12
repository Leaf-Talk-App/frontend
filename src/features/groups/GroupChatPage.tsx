import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LogOut, Send, Users } from 'lucide-react';
import { Avatar } from '../../components/avatar/Avatar';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import { usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { useWebSocket } from '../chats/useWebSocket';
import {
  useGroupMessagesQuery,
  useGroupQuery,
  useLeaveGroupMutation,
  useSendGroupMessageMutation,
} from './groups-hooks';
import type { LeafUser } from '../../lib/api/contracts';
import '../chats/chat-window-page.css';
import './groups.css';

function initialsOf(name: string): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, accessToken } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroupQuery(groupId);
  const {
    data: messages,
    isLoading: messagesLoading,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlder,
  } = useGroupMessagesQuery(groupId);
  const sendMutation = useSendGroupMessageMutation(groupId);
  const leaveMutation = useLeaveGroupMutation();

  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resolve nomes dos membros para exibir o autor de cada mensagem recebida.
  const memberIds = group?.members ?? [];
  const memberQueries = useQueries({
    queries: memberIds.map((id) => ({
      queryKey: ['users', 'id', id],
      queryFn: () => usersApi.getById(id, { token: accessToken! }),
      enabled: Boolean(accessToken) && id !== currentUser?.id,
      staleTime: 5 * 60_000,
    })),
  });
  const nameById = useMemo(() => {
    const map: Record<string, string> = { humberto: 'Humberto' };
    memberIds.forEach((id, i) => {
      const u = memberQueries[i]?.data as LeafUser | undefined;
      if (u) map[id] = u.display_name || u.name || '';
    });
    return map;
  }, [memberIds, memberQueries]);

  // WS: novas mensagens do grupo → invalida o histórico (refetch).
  const handleWs = useCallback(
    (data: any) => {
      if (data?.type === 'group_message' && data.group_id === groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
      }
    },
    [groupId, queryClient],
  );
  useWebSocket({ userId: currentUser?.id, enabled: Boolean(currentUser?.id), onMessage: handleWs });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMutation.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !groupId || sendMutation.isPending) return;
    sendMutation.mutate({ group_id: groupId, content });
    setInput('');
  };

  const handleLeave = () => {
    if (!groupId) return;
    leaveMutation.mutate(groupId, {
      onSuccess: () => navigate(routePaths.groups),
    });
  };

  if (!currentUser) return null;

  const groupName = group?.name ?? (groupLoading ? '' : 'Grupo');
  const memberCount = group?.member_count ?? memberIds.length;

  return (
    <div className="chat-window-page">
      <header className="chat-window-page__header">
        <button
          className="chat-window-page__back"
          type="button"
          aria-label="Voltar para grupos"
          onClick={() => navigate(routePaths.groups)}
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>

        <div className="chat-window-page__user-info">
          <Avatar src={group?.photo ?? undefined} initials={initialsOf(groupName || 'G')} size="sm" />
          <div className="chat-window-page__user-meta">
            <h2 className="chat-window-page__name">
              {groupLoading ? <span className="chat-window-page__name-skeleton" /> : groupName}
            </h2>
            <p className="chat-window-page__status">
              {memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}` : ''}
            </p>
          </div>
        </div>

        <div className="group-menu">
          <button
            type="button"
            className="group-menu__trigger"
            aria-label="Opções do grupo"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Users size={18} strokeWidth={2.2} />
          </button>
          {menuOpen && (
            <>
              <div className="group-menu__backdrop" onClick={() => setMenuOpen(false)} />
              <div className="group-menu__sheet" role="menu">
                <button
                  type="button"
                  className="group-menu__item group-menu__item--danger"
                  onClick={handleLeave}
                  disabled={leaveMutation.isPending}
                >
                  <LogOut size={15} strokeWidth={2.2} />
                  {leaveMutation.isPending ? 'Saindo…' : 'Sair do grupo'}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="chat-window-page__messages" aria-live="polite">
        {hasOlderMessages && !messagesLoading && (
          <div className="chat-window-page__load-more">
            <button
              type="button"
              className="chat-window-page__load-more-btn"
              onClick={() => fetchOlderMessages()}
              disabled={isFetchingOlder}
            >
              {isFetchingOlder ? 'Carregando…' : '↑ Carregar mensagens antigas'}
            </button>
          </div>
        )}

        {messagesLoading ? (
          <div className="chat-window-page__status-block">
            <p>Carregando mensagens…</p>
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="chat-window-page__empty">
            <h3>Nenhuma mensagem ainda</h3>
            <p>Seja o primeiro a falar no grupo 👋</p>
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = m.sender_id === currentUser.id;
            const author = nameById[m.sender_id] || 'Membro';
            return (
              <div key={m._id} className={`group-msg-row${isOwn ? ' group-msg-row--own' : ''}`}>
                {!isOwn && <span className="group-msg-row__author">{author}</span>}
                <MessageBubble
                  content={m.content}
                  type={m.type ?? 'text'}
                  fileUrl={m.file_url}
                  isSender={isOwn}
                  timestamp={formatTime(m.created_at)}
                  status={isOwn ? 'sent' : undefined}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-window-page__composer-wrap">
        <form className="group-composer" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mensagem… (chame a IA com @Humberto)"
            className="group-composer__input"
            aria-label="Mensagem para o grupo"
          />
          <button
            type="submit"
            className="group-composer__send"
            aria-label="Enviar"
            disabled={!input.trim() || sendMutation.isPending}
          >
            <Send size={18} strokeWidth={2.4} />
          </button>
        </form>
        <small className="chat-window-page__footnote">CRIPTOGRAFIA ATIVA · POWERED BY LEAF 1.4</small>
      </footer>
    </div>
  );
}
