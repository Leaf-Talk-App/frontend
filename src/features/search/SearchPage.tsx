import { BadgeCheck, MessageSquare, Search as SearchIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/avatar/Avatar';
import {
  ErrorMessage,
  LoadingSpinner,
} from '../../components/feedback/FeedbackComponents';
import { chatsApi } from '../../lib/api/endpoints';
import type { LeafUser } from '../../lib/api/contracts';
import { useAuth } from '../../lib/auth/use-auth';
import { useUserSearch } from './search-hooks';
import './search-page.css';

function initialsFor(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function SearchPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const {
    data: results,
    isLoading: isSearching,
    error: searchError,
  } = useUserSearch({
    query,
    enabled: Boolean(accessToken),
  });

  const handleStartChat = async (user: LeafUser) => {
    if (!accessToken || isCreatingChat) return;
    setCreatingFor(user._id);
    setIsCreatingChat(true);
    try {
      const response = await chatsApi.create(
        { user_id: user._id },
        { token: accessToken },
      );
      navigate(`/chats/${response.chat_id}`);
    } catch (error) {
      console.error('[Search] Failed to create chat:', error);
    } finally {
      setIsCreatingChat(false);
      setCreatingFor(null);
    }
  };

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const count = results?.length ?? 0;

  return (
    <div className="search-page">
      <header className="search-page__head">
        <h1>Buscar pessoas</h1>
      </header>

      <div className="search-page__bar">
        <SearchIcon size={20} strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar pessoas"
          autoFocus
        />
        {query ? (
          <button
            type="button"
            className="search-page__clear"
            onClick={() => setQuery('')}
            aria-label="Limpar busca"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <section className="search-page__results" aria-label="Pessoas">
        {!hasQuery ? (
          <div className="search-page__empty">
            <span className="search-page__empty-mark" aria-hidden="true">
              <SearchIcon size={26} strokeWidth={2.2} />
            </span>
            <h3>Encontre pessoas no Leaf</h3>
            <p>Digite um nome ou e-mail para começar a conversar.</p>
          </div>
        ) : isSearching ? (
          <div className="search-page__status">
            <LoadingSpinner message="Buscando pessoas…" />
          </div>
        ) : searchError ? (
          <div className="search-page__status">
            <ErrorMessage error="Não foi possível carregar as pessoas. Tente novamente." />
          </div>
        ) : count === 0 ? (
          <div className="search-page__empty">
            <span className="search-page__empty-mark" aria-hidden="true">
              <SearchIcon size={26} strokeWidth={2.2} />
            </span>
            <h3>Nenhuma pessoa encontrada</h3>
            <p>Tente outro nome ou e-mail.</p>
          </div>
        ) : (
          <>
            <p className="search-page__count">
              {count} resultado{count > 1 ? 's' : ''}
            </p>
            <ul className="user-list">
              {results!.map((user) => {
                const name = user.display_name || user.name || 'Membro do Leaf';
                return (
                  <li key={user._id} className="user-row">
                    <Avatar
                      src={user.avatar}
                      initials={initialsFor(name)}
                      size="md"
                      online={user.online}
                    />
                    <div className="user-row__info">
                      <p className="user-row__name">
                        {name}
                        {user.verified ? (
                          <BadgeCheck
                            size={16}
                            strokeWidth={2.4}
                            className="user-row__verified"
                            aria-label="Verificado"
                          />
                        ) : null}
                      </p>
                      <p className="user-row__handle">{user.email}</p>
                      {user.bio ? <p className="user-row__role">{user.bio}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="user-row__btn"
                      onClick={() => handleStartChat(user)}
                      disabled={isCreatingChat}
                    >
                      {creatingFor === user._id ? (
                        'Abrindo…'
                      ) : (
                        <>
                          <MessageSquare size={15} strokeWidth={2.4} aria-hidden="true" />
                          Conversar
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
