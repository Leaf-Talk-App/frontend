import { Archive, ChevronDown, MessageSquare, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Button } from '../../components/button/Button';
import { ChatItem } from '../../components/chat-item/ChatItem';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { usersApi } from '../../lib/api/endpoints';
import { useChatsQuery } from './chats-hooks';
import type { LeafChatSummary, LeafUser } from '../../lib/api/contracts';
import './chats-page.css';

export function ChatsPage() {
  const navigate = useNavigate();
  const { accessToken, user: currentUser } = useAuth();
  const { data: chats, isLoading, error } = useChatsQuery();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Coleta IDs únicos de todos os outros participantes.
  // Conversa consigo mesmo (participants = [eu, eu]) não tem "outro" → cai no
  // fallback do próprio ID, senão o nome ficava num skeleton infinito (tracinho).
  const participantIds = useMemo(() => {
    if (!chats || !currentUser) return [];
    const ids = new Set<string>();
    chats.forEach((chat) => {
      const others = chat.participants?.filter((id) => id !== currentUser.id) ?? [];
      if (others.length) {
        others.forEach((id) => ids.add(id));
      } else if (chat.participants?.length) {
        ids.add(chat.participants[0]);
      }
    });
    return Array.from(ids);
  }, [chats, currentUser]);

  // Busca todos em paralelo com useQueries
  const userQueries = useQueries({
    queries: participantIds.map((userId) => ({
      queryKey: ['users', 'id', userId],
      queryFn: () => usersApi.getById(userId, { token: accessToken! }),
      enabled: Boolean(accessToken),
      staleTime: 5 * 60_000,
    })),
  });

  // Mapa id → LeafUser para lookup rápido
  const usersMap = useMemo(() => {
    const map: Record<string, LeafUser> = {};
    userQueries.forEach((q, i) => {
      if (q.data) map[participantIds[i]] = q.data;
    });
    return map;
  }, [userQueries, participantIds]);

  // IDs cujas queries falharam (usuário deletado / inválido → mostra "Usuário removido")
  const failedUserIds = useMemo(() => {
    const s = new Set<string>();
    userQueries.forEach((q, i) => {
      if (q.isError) s.add(participantIds[i]);
    });
    return s;
  }, [userQueries, participantIds]);

  // Filtro por nome OU por prévia da última mensagem
  const filteredChats = useMemo(() => {
    if (!chats) return [];
    const term = search.trim().toLowerCase();
    if (!term) return chats;

    return chats.filter((chat) => {
      const preview = chat.last_message?.content?.toLowerCase() ?? '';
      if (preview.includes(term)) return true;

      // Também filtra pelo nome do outro participante
      const otherId =
        chat.participants?.find((id) => id !== currentUser?.id) ??
        chat.participants?.[0];
      const other = otherId ? usersMap[otherId] : undefined;
      if (other) {
        const name = (other.display_name || other.name || '').toLowerCase();
        const email = (other.email || '').toLowerCase();
        return name.includes(term) || email.includes(term);
      }
      return false;
    });
  }, [chats, search, currentUser?.id, usersMap]);

  // Arquivadas ficam numa seção recolhível; ativas na lista principal.
  const activeChats = useMemo(() => filteredChats.filter((c) => !c.archived), [filteredChats]);
  const archivedChats = useMemo(() => filteredChats.filter((c) => c.archived), [filteredChats]);

  const renderChatLi = (chat: LeafChatSummary) => {
    const otherId =
      chat.participants?.find((id) => id !== currentUser?.id) ?? chat.participants?.[0];
    const otherUser = otherId ? usersMap[otherId] : undefined;
    const userNotFound = otherId ? failedUserIds.has(otherId) : false;
    return (
      <li key={chat._id}>
        <ChatItem
          chat={chat}
          otherUser={otherUser}
          userNotFound={userNotFound}
          onClick={() => navigate(`/chats/${chat._id}`)}
        />
      </li>
    );
  };

  return (
    <div className="chats-page">
      <aside className="chats-page__list-pane" aria-label="Conversas">
        <header className="chats-page__heading">
          <h1>Conversas</h1>
        </header>

        <div className="chats-page__search">
          <Search size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou mensagem…"
            aria-label="Buscar conversas"
          />
        </div>

        {isLoading ? (
          <div className="chats-page__status">
            <p>Carregando conversas…</p>
          </div>
        ) : error ? (
          <div className="chats-page__status chats-page__status--error">
            <p>Não foi possível carregar as conversas.</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Tentar novamente
            </Button>
          </div>
        ) : !chats || chats.length === 0 ? (
          <div className="chats-page__status">
            <p className="chats-page__status-title">Nenhuma conversa ainda</p>
            <p className="chats-page__status-hint">
              Encontre alguém para iniciar uma conversa.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => navigate(routePaths.search)}
            >
              Buscar pessoas
            </Button>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="chats-page__status">
            <p>Nenhum resultado para "{search}".</p>
          </div>
        ) : (
          <ul className="chats-page__list">
            {archivedChats.length > 0 && !search.trim() && (
              <li>
                <button
                  type="button"
                  className="chats-page__archived-toggle"
                  onClick={() => setShowArchived((v) => !v)}
                  aria-expanded={showArchived}
                >
                  <Archive size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span className="chats-page__archived-label">Arquivadas</span>
                  <span className="chats-page__archived-count">{archivedChats.length}</span>
                  <ChevronDown
                    size={16}
                    strokeWidth={2.4}
                    className={`chats-page__archived-chevron${
                      showArchived ? ' chats-page__archived-chevron--open' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            )}
            {(showArchived || search.trim()) && archivedChats.map(renderChatLi)}
            {activeChats.map(renderChatLi)}
          </ul>
        )}
      </aside>

      <section className="chats-page__welcome" aria-label="Conversa ativa">
        <div className="chats-page__welcome-card">
          <span className="chats-page__welcome-mark" aria-hidden="true">
            <MessageSquare size={28} strokeWidth={2.2} />
          </span>
          <h2>Selecione uma conversa</h2>
          <p>
            Escolha uma conversa na lista para ler mensagens, compartilhar arquivos e
            continuar seu trabalho com a comunidade Leaf.
          </p>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => navigate(routePaths.search)}
          >
            Iniciar conversa
          </Button>
          <small className="chats-page__welcome-foot">
            CRIPTOGRAFIA ATIVA · POWERED BY LEAF 1.4
          </small>
        </div>
      </section>
    </div>
  );
}
