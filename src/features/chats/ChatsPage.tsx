import { Archive, ChevronDown, LogIn, MessageSquare, Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/button/Button';
import { ChatItem } from '../../components/chat-item/ChatItem';
import { routePaths } from '../../routes/paths';
import { useChatsQuery, usePinChatMutation } from './chats-hooks';
import { CreateGroupModal } from '../groups/CreateGroupModal';
import { useJoinGroupMutation } from '../groups/groups-hooks';
import type { LeafChatSummary } from '../../lib/api/contracts';
import './chats-page.css';

type Filter = 'unread' | 'groups';

export function ChatsPage() {
  const navigate = useNavigate();
  const { data: chats, isLoading, error } = useChatsQuery();
  const pinMutation = usePinChatMutation();
  const joinMutation = useJoinGroupMutation();

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [creating, setCreating] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const toggleFilter = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });

  const goToItem = (chat: LeafChatSummary) =>
    navigate(chat.kind === 'group' ? `/groups/${chat._id}` : `/chats/${chat._id}`);

  const togglePin = (chat: LeafChatSummary) => {
    setPinError(null);
    pinMutation.mutate(chat._id, {
      onSuccess: (res) => {
        if (res && 'error' in res && res.error) setPinError(res.error);
      },
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    joinMutation.mutate(code.trim(), {
      onSuccess: (res) => {
        setCode('');
        setJoinOpen(false);
        if (res && 'group_id' in res && res.group_id) navigate(`/groups/${res.group_id}`);
      },
    });
  };

  // Filtro por texto (nome do contato/grupo, e-mail ou prévia) + chips
  // (não lidas / grupos). Multi-filtro: combinam com AND.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (chats ?? []).filter((c) => {
      if (filters.has('unread') && !(c.unread_count ?? 0)) return false;
      if (filters.has('groups') && c.kind !== 'group') return false;
      if (!term) return true;
      const name =
        c.kind === 'group'
          ? c.name ?? ''
          : c.other_user?.display_name || c.other_user?.name || '';
      const email = c.other_user?.email ?? '';
      const preview = c.last_message?.content ?? '';
      return (
        name.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term) ||
        preview.toLowerCase().includes(term)
      );
    });
  }, [chats, search, filters]);

  const activeChats = useMemo(() => filtered.filter((c) => !c.archived), [filtered]);
  const archivedChats = useMemo(() => filtered.filter((c) => c.archived), [filtered]);

  const renderItem = (chat: LeafChatSummary) => (
    <li key={chat._id}>
      <ChatItem chat={chat} onClick={() => goToItem(chat)} onTogglePin={() => togglePin(chat)} />
    </li>
  );

  const FilterChip = ({ f, label }: { f: Filter; label: string }) => (
    <button
      type="button"
      className={`chats-page__filter${filters.has(f) ? ' chats-page__filter--on' : ''}`}
      aria-pressed={filters.has(f)}
      onClick={() => toggleFilter(f)}
    >
      {label}
    </button>
  );

  return (
    <div className="chats-page">
      <aside className="chats-page__list-pane" aria-label="Conversas">
        <header className="chats-page__heading">
          <h1>Conversas</h1>
          <div className="chats-page__heading-actions">
            <button
              type="button"
              className="chats-page__head-btn"
              onClick={() => setJoinOpen((v) => !v)}
              title="Entrar em grupo por código"
              aria-label="Entrar em grupo por código"
            >
              <LogIn size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="chats-page__head-btn chats-page__head-btn--primary"
              onClick={() => setCreating(true)}
              title="Novo grupo"
              aria-label="Novo grupo"
            >
              <Users size={15} strokeWidth={2.4} aria-hidden="true" />
              <Plus size={11} strokeWidth={3} aria-hidden="true" />
            </button>
          </div>
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

        {/* Filtros combináveis */}
        <div className="chats-page__filters" role="group" aria-label="Filtros">
          <button
            type="button"
            className={`chats-page__filter${filters.size === 0 ? ' chats-page__filter--on' : ''}`}
            aria-pressed={filters.size === 0}
            onClick={() => setFilters(new Set())}
          >
            Todas
          </button>
          <FilterChip f="unread" label="Não lidas" />
          <FilterChip f="groups" label="Grupos" />
        </div>

        {joinOpen && (
          <form className="chats-page__join-form" onSubmit={handleJoin}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código de convite…"
              aria-label="Código de convite"
              autoFocus
            />
            <button type="submit" disabled={!code.trim() || joinMutation.isPending}>
              {joinMutation.isPending ? '…' : 'Entrar'}
            </button>
          </form>
        )}
        {joinMutation.isError && (
          <p className="chats-page__inline-error" role="alert">Código inválido. Confira e tente de novo.</p>
        )}
        {pinError && <p className="chats-page__inline-error" role="alert">{pinError}</p>}

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
            <p className="chats-page__status-hint">Encontre alguém para iniciar uma conversa.</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => navigate(routePaths.search)}
            >
              Buscar pessoas
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="chats-page__status">
            <p>Nenhum resultado{search.trim() ? ` para "${search}"` : ''}.</p>
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
            {(showArchived || search.trim()) && archivedChats.map(renderItem)}
            {activeChats.map(renderItem)}
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
            Escolha uma conversa ou grupo na lista para ler mensagens, compartilhar arquivos e
            continuar com a comunidade Leaf.
          </p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(routePaths.search)}>
            Iniciar conversa
          </Button>
        </div>
      </section>

      {creating && (
        <CreateGroupModal
          onClose={() => setCreating(false)}
          onCreated={(groupId) => {
            setCreating(false);
            navigate(`/groups/${groupId}`);
          }}
        />
      )}
    </div>
  );
}
