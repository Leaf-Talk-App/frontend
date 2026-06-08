import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  Bell,
  BellOff,
  ChevronRight,
  Images,
  Info,
  MoreHorizontal,
  MoreVertical,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, messagesApi, usersApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { useAuth } from '../../lib/auth/use-auth';
import { routePaths } from '../../routes/paths';
import { Avatar } from '../../components/avatar/Avatar';
import type { LeafMessage, LeafUser } from '../../lib/api/contracts';
import './chat-header-menu.css';

interface ChatHeaderMenuProps {
  chatId: string;
  otherUser?: LeafUser;
  otherUserId?: string;
  muted: boolean;
  messages?: LeafMessage[];
  onOpenSearch: () => void;
}

const URL_RE = /(https?:\/\/[^\s]+)/i;

type ModalKind = 'contact' | 'media' | null;

export function ChatHeaderMenu({
  chatId,
  otherUser,
  otherUserId,
  muted,
  messages,
  onOpenSearch,
}: ChatHeaderMenuProps) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // recolhe o submenu "Mais" sempre que o dropdown fecha
  useEffect(() => {
    if (!open) setShowMore(false);
  }, [open]);

  // Fecha o dropdown ao clicar fora / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const muteMutation = useMutation({
    mutationFn: () => chatsApi.mute({ chat_id: chatId }, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.byId(chatId) });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (otherUserId) await usersApi.block({ user_id: otherUserId }, { token: accessToken! });
      await chatsApi.hide({ chat_id: chatId }, { token: accessToken! });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      navigate(routePaths.chats);
    },
  });

  const name = otherUser?.display_name || otherUser?.name || 'Contato';
  const initials = name.charAt(0).toUpperCase();

  // Mídia / links / docs a partir das mensagens já carregadas
  const { images, docs, links } = useMemo(() => {
    const list = (messages ?? []).filter((m) => !m.deleted);
    return {
      images: list.filter((m) => m.file_url && m.type === 'image'),
      docs: list.filter((m) => m.file_url && m.type !== 'image'),
      links: list.filter((m) => URL_RE.test(m.content || '')),
    };
  }, [messages]);

  const clearMutation = useMutation({
    mutationFn: () => messagesApi.clearChat(chatId, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.byChatId(chatId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
    },
  });

  const handleBlock = () => {
    setOpen(false);
    if (window.confirm(`Bloquear ${name}? A conversa será removida da sua lista.`)) {
      blockMutation.mutate();
    }
  };

  const handleClear = () => {
    setOpen(false);
    if (window.confirm('Limpar esta conversa? As mensagens somem só para você.')) {
      clearMutation.mutate();
    }
  };

  return (
    <div className="chat-menu" ref={wrapRef}>
      <button
        className="chat-window-page__menu"
        type="button"
        aria-label="Opções da conversa"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="chat-menu__dropdown" role="menu">
          <button className="chat-menu__item" role="menuitem" onClick={() => { setOpen(false); setModal('contact'); }}>
            <Info size={17} strokeWidth={2} /> Mostrar contato
          </button>
          <button className="chat-menu__item" role="menuitem" onClick={() => { setOpen(false); onOpenSearch(); }}>
            <Search size={17} strokeWidth={2} /> Pesquisar na conversa
          </button>
          <button className="chat-menu__item" role="menuitem" onClick={() => { setOpen(false); setModal('media'); }}>
            <Images size={17} strokeWidth={2} /> Mídia, links e docs
          </button>
          <button
            className="chat-menu__item"
            role="menuitem"
            disabled={muteMutation.isPending}
            onClick={() => { setOpen(false); muteMutation.mutate(); }}
          >
            {muted ? <Bell size={17} strokeWidth={2} /> : <BellOff size={17} strokeWidth={2} />}
            {muted ? 'Reativar notificações' : 'Silenciar'}
          </button>
          {!showMore ? (
            <button className="chat-menu__item" role="menuitem" onClick={() => setShowMore(true)}>
              <MoreHorizontal size={17} strokeWidth={2} /> Mais
              <ChevronRight size={15} strokeWidth={2} style={{ marginLeft: 'auto' }} />
            </button>
          ) : (
            <>
              <div className="chat-menu__sep" />
              <button
                className="chat-menu__item chat-menu__item--danger"
                role="menuitem"
                onClick={handleBlock}
              >
                <Ban size={17} strokeWidth={2} /> Bloquear
              </button>
              <button
                className="chat-menu__item chat-menu__item--danger"
                role="menuitem"
                disabled={clearMutation.isPending}
                onClick={handleClear}
              >
                <Trash2 size={17} strokeWidth={2} /> Limpar conversa
              </button>
            </>
          )}
        </div>
      )}

      {modal === 'contact' &&
        createPortal(
          <div className="chat-modal" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
            <div className="chat-modal__card" onClick={(e) => e.stopPropagation()}>
              <button className="chat-modal__close" onClick={() => setModal(null)} aria-label="Fechar">
                <X size={20} strokeWidth={2.2} />
              </button>
              <div className="chat-modal__contact-head">
                <Avatar src={otherUser?.avatar} initials={initials} size="lg" />
                <h3 className="chat-modal__name">{name}</h3>
                {otherUser?.username ? <p className="chat-modal__handle">@{otherUser.username}</p> : null}
              </div>
              <dl className="chat-modal__fields">
                {otherUser?.email ? (
                  <div><dt>E-mail</dt><dd>{otherUser.email}</dd></div>
                ) : null}
                {otherUser?.phone ? (
                  <div>
                    <dt>Telefone</dt>
                    <dd>{otherUser.phone}{otherUser.phone_verified ? ' ✓' : ''}</dd>
                  </div>
                ) : null}
                {otherUser?.bio ? (
                  <div><dt>Bio</dt><dd>{otherUser.bio}</dd></div>
                ) : null}
              </dl>
            </div>
          </div>,
          document.body,
        )}

      {modal === 'media' &&
        createPortal(
          <div className="chat-modal" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
            <div className="chat-modal__card chat-modal__card--wide" onClick={(e) => e.stopPropagation()}>
              <button className="chat-modal__close" onClick={() => setModal(null)} aria-label="Fechar">
                <X size={20} strokeWidth={2.2} />
              </button>
              <h3 className="chat-modal__name">Mídia, links e docs</h3>
              <p className="chat-modal__hint">Do histórico já carregado nesta conversa.</p>

              <h4 className="chat-modal__section">Mídia ({images.length})</h4>
              {images.length ? (
                <div className="chat-modal__grid">
                  {images.map((m) => (
                    <a key={m._id} href={m.file_url ?? '#'} target="_blank" rel="noreferrer">
                      <img src={m.file_url ?? ''} alt="mídia" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="chat-modal__empty">Nenhuma mídia.</p>
              )}

              <h4 className="chat-modal__section">Links ({links.length})</h4>
              {links.length ? (
                <ul className="chat-modal__list">
                  {links.map((m) => {
                    const url = (m.content || '').match(URL_RE)?.[0] ?? '';
                    return (
                      <li key={m._id}>
                        <a href={url} target="_blank" rel="noreferrer">{url}</a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="chat-modal__empty">Nenhum link.</p>
              )}

              <h4 className="chat-modal__section">Documentos ({docs.length})</h4>
              {docs.length ? (
                <ul className="chat-modal__list">
                  {docs.map((m) => (
                    <li key={m._id}>
                      <a href={m.file_url ?? '#'} target="_blank" rel="noreferrer">
                        {m.content || m.file_url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="chat-modal__empty">Nenhum documento.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
