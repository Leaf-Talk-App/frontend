import { MessageSquare, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/button/Button';
import { ChatItem } from '../../components/chat-item/ChatItem';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { useChatsQuery, useParticipantQuery } from './chats-hooks';
import type { LeafChatSummary } from '../../lib/api/contracts';
import './chats-page.css';

// Wrapper que busca os dados do outro participante para cada chat
function ChatRow({
  chat,
  currentUserId,
  onClick,
}: {
  chat: LeafChatSummary;
  currentUserId?: string;
  onClick: () => void;
}) {
  const otherUserId = chat.participants?.find((id) => id !== currentUserId);
  const { data: otherUser } = useParticipantQuery(otherUserId);

  return <ChatItem chat={chat} otherUser={otherUser} onClick={onClick} />;
}

export function ChatsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: chats, isLoading, error } = useChatsQuery();
  const [search, setSearch] = useState('');

  const filteredChats = useMemo(() => {
    if (!chats) return [];
    const term = search.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter((chat) => {
      const preview = chat.last_message?.content?.toLowerCase() ?? '';
      return preview.includes(term);
    });
  }, [chats, search]);

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
            placeholder="Buscar mensagens…"
            aria-label="Buscar mensagens"
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
            <p>Nenhuma conversa corresponde a "{search}".</p>
          </div>
        ) : (
          <ul className="chats-page__list">
            {filteredChats.map((chat) => (
              <li key={chat._id}>
                <ChatRow
                  chat={chat}
                  currentUserId={currentUser?.id}
                  onClick={() => navigate(`/chats/${chat._id}`)}
                />
              </li>
            ))}
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
