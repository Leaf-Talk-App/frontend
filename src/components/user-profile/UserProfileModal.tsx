import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../avatar/Avatar';
import { usersApi, chatsApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import type { LeafUser } from '../../lib/api/contracts';
import '../../features/chats/chat-header-menu.css';

interface Props {
  userId: string;
  onClose: () => void;
  /** mostra o botão "Conversar" (abre/cria a conversa 1:1) */
  allowChat?: boolean;
}

/** Perfil de um usuário em modal — reutilizável (grupo, busca, etc.). */
export function UserProfileModal({ userId, onClose, allowChat = true }: Props) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const { data: u, isLoading } = useQuery({
    queryKey: ['users', 'id', userId],
    queryFn: () => usersApi.getById(userId, { token: accessToken! }),
    enabled: Boolean(accessToken && userId),
    staleTime: 60_000,
  });

  const user = u as LeafUser | undefined;
  const name = user?.display_name || user?.name || 'Membro do Leaf';
  const initials = name.slice(0, 2).toUpperCase();

  const openChat = async () => {
    if (!accessToken) return;
    try {
      const res = await chatsApi.create({ user_id: userId }, { token: accessToken });
      onClose();
      navigate(`/chats/${res.chat_id}`);
    } catch {
      /* ignora */
    }
  };

  return createPortal(
    <div className="chat-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chat-modal__card" onClick={(e) => e.stopPropagation()}>
        <button className="chat-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2.2} />
        </button>
        {isLoading ? (
          <p className="chat-modal__empty">Carregando perfil…</p>
        ) : (
          <>
            <div className="chat-modal__contact-head">
              <Avatar src={user?.avatar} initials={initials} size="lg" online={user?.online} />
              <h3 className="chat-modal__name">{name}</h3>
              {user?.username ? <p className="chat-modal__handle">@{user.username}</p> : null}
              <p className={`chat-modal__online-status${user?.online ? ' chat-modal__online-status--on' : ''}`}>
                {user?.online ? 'Online agora' : 'Offline'}
              </p>
            </div>
            <dl className="chat-modal__fields">
              {user?.bio ? <div><dt>Bio</dt><dd>{user.bio}</dd></div> : null}
              {user?.email ? <div><dt>E-mail</dt><dd>{user.email}</dd></div> : null}
              {user?.phone ? <div><dt>Telefone</dt><dd>{user.phone}</dd></div> : null}
            </dl>
            {allowChat && (
              <div className="chat-modal__actions">
                <button className="chat-modal__btn chat-modal__btn--primary" type="button" onClick={openChat}>
                  <MessageSquare size={15} strokeWidth={2} /> Conversar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
