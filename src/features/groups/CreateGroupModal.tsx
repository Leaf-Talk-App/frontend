import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, Users, X } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { Avatar } from '../../components/avatar/Avatar';
import { usersApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import { useChatsQuery } from '../chats/chats-hooks';
import { useCreateGroupMutation } from './groups-hooks';
import type { LeafUser } from '../../lib/api/contracts';
import './groups.css';

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

/**
 * Cria um grupo: nome + seleção de membros a partir dos contatos das conversas
 * existentes (mesma resolução de participantes usada na lista de conversas).
 */
export function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const { accessToken, user: currentUser } = useAuth();
  const { data: chats, isLoading: chatsLoading } = useChatsQuery();
  const createGroup = useCreateGroupMutation();

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // IDs dos outros participantes das conversas (candidatos a membros)
  const participantIds = useMemo(() => {
    if (!chats || !currentUser) return [];
    const ids = new Set<string>();
    chats.forEach((chat) => {
      chat.participants
        ?.filter((id) => id !== currentUser.id)
        .forEach((id) => ids.add(id));
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

  const contacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return participantIds
      .map((id, i) => ({ id, user: userQueries[i]?.data as LeafUser | undefined }))
      .filter((c) => c.user)
      .map((c) => ({
        id: c.id,
        name: c.user!.display_name || c.user!.name || 'Usuário',
        avatar: c.user!.avatar,
      }))
      .filter((c) => !term || c.name.toLowerCase().includes(term));
  }, [participantIds, userQueries, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && !createGroup.isPending;

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      const res = await createGroup.mutateAsync({
        name: name.trim(),
        members: Array.from(selected),
      });
      if ('group_id' in res) onCreated(res.group_id);
    } catch {
      /* erro exibido abaixo via createGroup.isError */
    }
  };

  return createPortal(
    <div className="chat-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chat-modal__card create-group" onClick={(e) => e.stopPropagation()}>
        <button className="chat-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2.2} />
        </button>
        <h3 className="chat-modal__name">
          <Users size={18} strokeWidth={2.2} aria-hidden="true" /> Novo grupo
        </h3>

        <label className="create-group__field">
          <span>Nome do grupo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Equipe Leaf"
            maxLength={60}
            autoFocus
          />
        </label>

        <div className="create-group__members-head">
          <span>Membros {selected.size > 0 ? `(${selected.size})` : ''}</span>
        </div>

        <div className="forward-modal__search create-group__search">
          <Search size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato…"
            aria-label="Buscar contato"
          />
        </div>

        {chatsLoading ? (
          <p className="chat-modal__empty">Carregando contatos…</p>
        ) : contacts.length === 0 ? (
          <p className="chat-modal__empty">
            {search.trim() ? 'Nenhum contato encontrado.' : 'Inicie conversas para ter contatos.'}
          </p>
        ) : (
          <ul className="create-group__list">
            {contacts.map((c) => {
              const isSel = selected.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`create-group__row${isSel ? ' create-group__row--on' : ''}`}
                    onClick={() => toggle(c.id)}
                  >
                    <Avatar
                      src={c.avatar}
                      initials={c.name.slice(0, 2).toUpperCase()}
                      size="sm"
                    />
                    <span className="create-group__row-name">{c.name}</span>
                    <span className={`create-group__check${isSel ? ' create-group__check--on' : ''}`}>
                      {isSel ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {createGroup.isError && (
          <p className="create-group__error" role="alert">
            Não foi possível criar o grupo. Tente novamente.
          </p>
        )}

        <button
          type="button"
          className="create-group__submit"
          disabled={!canCreate}
          onClick={handleCreate}
        >
          {createGroup.isPending ? 'CRIANDO…' : 'CRIAR GRUPO'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
