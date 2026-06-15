import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  ChevronRight,
  Eraser,
  Images,
  Info,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  archived: boolean;
  messages?: LeafMessage[];
  onOpenSearch: () => void;
}

export interface ChatHeaderMenuHandle {
  openContact: () => void;
}

const URL_RE = /(https?:\/\/[^\s]+)/i;

// Durações de silenciamento (minutos). null = para sempre.
const MUTE_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: '1 hora', minutes: 60 },
  { label: '8 horas', minutes: 480 },
  { label: '1 dia', minutes: 1440 },
  { label: '1 semana', minutes: 10080 },
  { label: '1 mês', minutes: 43200 },
  { label: 'Para sempre', minutes: null },
];

type ModalKind = 'contact' | 'media' | 'favorites' | null;

function formatLastSeenLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `hoje às ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}

export const ChatHeaderMenu = forwardRef<ChatHeaderMenuHandle, ChatHeaderMenuProps>(
  function ChatHeaderMenu({
  chatId,
  otherUser,
  otherUserId,
  muted,
  archived,
  messages,
  onOpenSearch,
}: ChatHeaderMenuProps, ref) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showMute, setShowMute] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    openContact: () => setModal('contact'),
  }));

  // recolhe os submenus sempre que o dropdown fecha
  useEffect(() => {
    if (!open) {
      setShowMore(false);
      setShowMute(false);
    }
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
    mutationFn: (vars: { mute_minutes?: number | null; unmute?: boolean }) =>
      chatsApi.mute({ chat_id: chatId, ...vars }, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.byId(chatId) });
    },
  });

  const blockMutation = useMutation({
    // Bloquear apenas impede a entrega de mensagens — NÃO remove/esconde a
    // conversa nem o perfil (o usuário pediu para deixar a conversa na lista).
    mutationFn: async () => {
      if (otherUserId) await usersApi.block({ user_id: otherUserId }, { token: accessToken! });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      queryClient.invalidateQueries({ queryKey: ['users', 'blocked'] });
    },
  });

  // Estado de bloqueio do contato → alterna entre "Bloquear" e "Desbloquear"
  // (WhatsApp-like: desbloqueio acessível direto do menu da conversa).
  const blockedQuery = useQuery({
    queryKey: ['users', 'blocked'],
    queryFn: () => usersApi.blocked({ token: accessToken! }),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });
  const isBlocked = Boolean(
    otherUserId && (blockedQuery.data ?? []).some((u) => u._id === otherUserId),
  );

  const unblockMutation = useMutation({
    mutationFn: () => usersApi.unblock(otherUserId!, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'blocked'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
    },
  });

  const handleUnblock = () => {
    setOpen(false);
    setModal(null);
    if (otherUserId) unblockMutation.mutate();
  };

  const name = otherUser?.display_name || otherUser?.name || 'Contato';
  const initials = name.charAt(0).toUpperCase();

  // Mídia / links / docs / favoritas a partir das mensagens já carregadas
  const { images, docs, links, favorites } = useMemo(() => {
    const list = (messages ?? []).filter((m) => !m.deleted);
    return {
      images: list.filter((m) => m.file_url && m.type === 'image'),
      docs: list.filter((m) => m.file_url && m.type !== 'image'),
      links: list.filter((m) => URL_RE.test(m.content || '')),
      favorites: list.filter((m) => m.favorited),
    };
  }, [messages]);

  const clearMutation = useMutation({
    mutationFn: () => messagesApi.clearChat(chatId, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.byChatId(chatId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => chatsApi.delete(chatId, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      navigate(routePaths.chats);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => chatsApi.archive({ chat_id: chatId }, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.byId(chatId) });
      navigate(routePaths.chats);
    },
  });

  const handleBlock = () => {
    setOpen(false);
    setModal(null);
    if (window.confirm(`Bloquear ${name}? Ele não receberá mais suas mensagens. A conversa continua na sua lista.`)) {
      blockMutation.mutate();
    }
  };

  const handleClear = () => {
    setOpen(false);
    if (window.confirm('Limpar esta conversa? As mensagens somem só para você.')) {
      clearMutation.mutate();
    }
  };

  const handleDelete = () => {
    setOpen(false);
    if (window.confirm('Tem certeza? Esta ação não pode ser desfeita para você.')) {
      deleteMutation.mutate();
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

      {open && showMute ? (
        <div className="chat-menu__dropdown" role="menu">
          <button className="chat-menu__item" role="menuitem" onClick={() => setShowMute(false)}>
            <ChevronRight size={15} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} /> Silenciar por…
          </button>
          <div className="chat-menu__sep" />
          {MUTE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className="chat-menu__item"
              role="menuitem"
              disabled={muteMutation.isPending}
              onClick={() => { setOpen(false); muteMutation.mutate({ mute_minutes: opt.minutes }); }}
            >
              <BellOff size={17} strokeWidth={2} /> {opt.label}
            </button>
          ))}
        </div>
      ) : open && (
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
          <button className="chat-menu__item" role="menuitem" onClick={() => { setOpen(false); setModal('favorites'); }}>
            <Star size={17} strokeWidth={2} /> Mensagens favoritas
          </button>
          {muted ? (
            <button
              className="chat-menu__item"
              role="menuitem"
              disabled={muteMutation.isPending}
              onClick={() => { setOpen(false); muteMutation.mutate({ unmute: true }); }}
            >
              <Bell size={17} strokeWidth={2} /> Reativar notificações
            </button>
          ) : (
            <button
              className="chat-menu__item"
              role="menuitem"
              onClick={() => setShowMute(true)}
            >
              <BellOff size={17} strokeWidth={2} /> Silenciar
              <ChevronRight size={15} strokeWidth={2} style={{ marginLeft: 'auto' }} />
            </button>
          )}
          <button
            className="chat-menu__item"
            role="menuitem"
            disabled={archiveMutation.isPending}
            onClick={() => { setOpen(false); archiveMutation.mutate(); }}
          >
            {archived ? <ArchiveRestore size={17} strokeWidth={2} /> : <Archive size={17} strokeWidth={2} />}
            {archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
          </button>
          <div className="chat-menu__sep" />
          {/* Apagar fica SEMPRE visível no menu — não escondido no "Mais" */}
          <button
            className="chat-menu__item chat-menu__item--danger"
            role="menuitem"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            <Trash2 size={17} strokeWidth={2} /> Apagar conversa
          </button>
          {!showMore ? (
            <button className="chat-menu__item" role="menuitem" onClick={() => setShowMore(true)}>
              <MoreHorizontal size={17} strokeWidth={2} /> Mais
              <ChevronRight size={15} strokeWidth={2} style={{ marginLeft: 'auto' }} />
            </button>
          ) : (
            <>
              {isBlocked ? (
                <button
                  className="chat-menu__item"
                  role="menuitem"
                  disabled={unblockMutation.isPending}
                  onClick={handleUnblock}
                >
                  <Ban size={17} strokeWidth={2} /> Desbloquear
                </button>
              ) : (
                <button
                  className="chat-menu__item chat-menu__item--danger"
                  role="menuitem"
                  onClick={handleBlock}
                >
                  <Ban size={17} strokeWidth={2} /> Bloquear
                </button>
              )}
              <button
                className="chat-menu__item chat-menu__item--danger"
                role="menuitem"
                disabled={clearMutation.isPending}
                onClick={handleClear}
              >
                <Eraser size={17} strokeWidth={2} /> Limpar conversa
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
                <Avatar src={otherUser?.avatar} initials={initials} size="lg" online={otherUser?.online} />
                <h3 className="chat-modal__name">{name}</h3>
                {otherUser?.username ? <p className="chat-modal__handle">@{otherUser.username}</p> : null}
                <p className={`chat-modal__online-status${otherUser?.online ? ' chat-modal__online-status--on' : ''}`}>
                  {otherUser?.online
                    ? 'Online agora'
                    : otherUser?.last_seen
                    ? `Visto por último ${formatLastSeenLocal(otherUser.last_seen)}`
                    : 'Offline'}
                </p>
              </div>
              <dl className="chat-modal__fields">
                {otherUser?.bio ? (
                  <div><dt>Bio</dt><dd>{otherUser.bio}</dd></div>
                ) : null}
                {otherUser?.email ? (
                  <div><dt>E-mail</dt><dd>{otherUser.email}</dd></div>
                ) : null}
                {otherUser?.phone ? (
                  <div>
                    <dt>Telefone</dt>
                    <dd>{otherUser.phone}{otherUser.phone_verified ? ' ✓' : ''}</dd>
                  </div>
                ) : null}
              </dl>
              <button
                className="chat-modal__media-link"
                onClick={() => setModal('media')}
                type="button"
              >
                <span><Images size={16} strokeWidth={2} /> Mídia, links e docs</span>
                <span className="chat-modal__media-counts">
                  {images.length + docs.length + links.length}
                  <ChevronRight size={15} strokeWidth={2} />
                </span>
              </button>

              <div className="chat-modal__actions">
                <button
                  className="chat-modal__btn chat-modal__btn--primary"
                  onClick={() => setModal(null)}
                  type="button"
                >
                  <MessageSquare size={15} strokeWidth={2} />
                  Enviar mensagem
                </button>
                {otherUserId && (
                  <button
                    className="chat-modal__btn chat-modal__btn--danger"
                    onClick={() => { setModal(null); handleBlock(); }}
                    disabled={blockMutation.isPending}
                    type="button"
                  >
                    <Ban size={15} strokeWidth={2} />
                    Bloquear
                  </button>
                )}
              </div>
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

      {modal === 'favorites' &&
        createPortal(
          <div className="chat-modal" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
            <div className="chat-modal__card" onClick={(e) => e.stopPropagation()}>
              <button className="chat-modal__close" onClick={() => setModal(null)} aria-label="Fechar">
                <X size={20} strokeWidth={2.2} />
              </button>
              <h3 className="chat-modal__name">Mensagens favoritas</h3>
              <p className="chat-modal__hint">Do histórico já carregado nesta conversa.</p>
              {favorites.length ? (
                <ul className="chat-modal__fav-list">
                  {favorites.map((m) => (
                    <li key={m._id} className="chat-modal__fav-item">
                      <Star size={14} strokeWidth={2.2} />
                      <span>{(m.content || '').trim() || (m.type === 'image' ? '📷 Foto' : m.type === 'audio' ? '🎤 Áudio' : '📄 Arquivo')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="chat-modal__empty">Nenhuma mensagem favoritada ainda. Toque na seta de uma mensagem → Favoritar.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
