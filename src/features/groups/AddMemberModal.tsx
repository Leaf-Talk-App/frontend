import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { Avatar } from '../../components/avatar/Avatar';
import { usersApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import { useChatsQuery } from '../chats/chats-hooks';
import { useAddMemberMutation } from './groups-hooks';
import type { LeafUser } from '../../lib/api/contracts';
import './groups.css';

interface AddMemberModalProps {
  groupId: string;
  currentMembers: string[];
  onClose: () => void;
}

/** Adiciona membros a um grupo existente (apenas admin). Lista contatos das
 *  conversas que ainda não estão no grupo. */
export function AddMemberModal({ groupId, currentMembers, onClose }: AddMemberModalProps) {
  const { accessToken, user: currentUser } = useAuth();
  const { data: chats, isLoading: chatsLoading } = useChatsQuery();
  const addMember = useAddMemberMutation(groupId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const memberSet = useMemo(() => new Set(currentMembers), [currentMembers]);

  const participantIds = useMemo(() => {
    if (!chats || !currentUser) return [];
    const ids = new Set<string>();
    chats.forEach((chat) => {
      chat.participants
        ?.filter((id) => id !== currentUser.id && !memberSet.has(id))
        .forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [chats, currentUser, memberSet]);

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
      .map((c) => ({ id: c.id, name: c.user!.display_name || c.user!.name || 'Usuário', avatar: c.user!.avatar }))
      .filter((c) => !term || c.name.toLowerCase().includes(term));
  }, [participantIds, userQueries, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAdd = async () => {
    if (selected.size === 0 || addMember.isPending) return;
    // adiciona um a um (endpoint é por usuário)
    for (const id of selected) {
      try {
        await addMember.mutateAsync(id);
      } catch {
        /* segue para os demais */
      }
    }
    setDone(true);
    window.setTimeout(onClose, 600);
  };

  return createPortal(
    <div className="chat-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chat-modal__card create-group" onClick={(e) => e.stopPropagation()}>
        <button className="chat-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2.2} />
        </button>
        <h3 className="chat-modal__name">
          <UserPlus size={18} strokeWidth={2.2} aria-hidden="true" /> Adicionar membros
        </h3>

        <div className="forward-modal__search create-group__search">
          <Search size={16} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato…"
            aria-label="Buscar contato"
            autoFocus
          />
        </div>

        {chatsLoading ? (
          <p className="chat-modal__empty">Carregando contatos…</p>
        ) : contacts.length === 0 ? (
          <p className="chat-modal__empty">
            {search.trim() ? 'Nenhum contato encontrado.' : 'Todos os seus contatos já estão no grupo.'}
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
                    <Avatar src={c.avatar} initials={c.name.slice(0, 2).toUpperCase()} size="sm" />
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

        <button
          type="button"
          className="create-group__submit"
          disabled={selected.size === 0 || addMember.isPending || done}
          onClick={handleAdd}
        >
          {done ? 'ADICIONADO' : addMember.isPending ? 'ADICIONANDO…' : `ADICIONAR ${selected.size || ''}`.trim()}
        </button>
      </div>
    </div>,
    document.body,
  );
}
