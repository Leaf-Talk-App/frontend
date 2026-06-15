import { ArrowLeft, Camera, ChevronDown, Forward, Image, Mic, MicOff, Paperclip, Plus, Reply, Search, Send, Smile, Sprout, Star, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChatHeaderMenuHandle } from './ChatHeaderMenu';
import { EmojiPicker } from '../../components/emoji-picker/EmojiPicker';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useLongPress } from '../../hooks/useLongPress';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/avatar/Avatar';
import { ErrorMessage, LoadingSpinner } from '../../components/feedback/FeedbackComponents';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import { DictationButton } from '../../components/dictation/DictationButton';
import { HumbertoMentionHint, mentionsHumberto } from '../../components/humberto/HumbertoMentionHint';
import { ImagePreviewModal } from '../../components/image-preview-modal/ImagePreviewModal';
import { CameraCaptureModal } from '../../components/camera-capture-modal/CameraCaptureModal';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ForwardModal } from './ForwardModal';
import type { LeafMessage } from '../../lib/api/contracts';
import { routePaths } from '../../routes/paths';
import {
  useChatQuery,
  useMessagesQuery,
  useParticipantQuery,
  useSendMessageMutation,
} from './chats-hooks';
import { uploadsApi, messagesApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { parseServerDate } from '../../lib/date';
import { useCurrentUserQuery } from '../auth/auth-hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/use-auth';
import './chat-window-page.css';

function formatTime(value?: string) {
  const date = parseServerDate(value);
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(value?: string) {
  const date = parseServerDate(value);
  if (!date) return '';
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `hoje às ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}

function formatDateDivider(value?: string) {
  const date = parseServerDate(value);
  if (!date) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'HOJE';
  if (sameDay(date, yesterday)) return 'ONTEM';

  return date
    .toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

// Texto curto p/ a citação de resposta — usa o conteúdo ou um rótulo de mídia.
function replyPreviewText(m: { content?: string; type?: string }): string {
  const text = (m.content || '').trim();
  if (text) return text;
  switch (m.type) {
    case 'image': return '📷 Foto';
    case 'audio': return '🎤 Áudio';
    case 'file': return '📄 Arquivo';
    default: return 'Mensagem';
  }
}

type FeedItem =
  | { type: 'divider'; key: string; label: string }
  | { type: 'message'; key: string; message: LeafMessage };

function buildFeed(messages: LeafMessage[] | undefined): FeedItem[] {
  if (!messages || messages.length === 0) return [];

  const out: FeedItem[] = [];
  let lastDivider = '';

  for (const msg of messages) {
    const label = formatDateDivider(msg.created_at);
    if (label && label !== lastDivider) {
      out.push({ type: 'divider', key: `divider-${label}-${msg._id}`, label });
      lastDivider = label;
    }
    out.push({ type: 'message', key: msg._id, message: msg });
  }

  return out;
}

export function ChatWindowPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const atBottomRef = useRef(true);
  const { user: currentUser, accessToken } = useAuth();

  // ── Dados da conversa ─────────────────────────────────────────────────────
  // useChatQuery: primeiro tenta o cache da lista, depois GET /chats/{id}
  const { data: currentChat } = useChatQuery(chatId);

  // Participante do outro lado. Conversa consigo mesmo não tem "outro" →
  // fallback para o primeiro participante (o próprio usuário).
  const otherParticipantId = useMemo(
    () =>
      currentChat?.participants?.find((id) => id !== currentUser?.id) ??
      currentChat?.participants?.[0],
    [currentChat, currentUser?.id],
  );
  const { data: otherUser } = useParticipantQuery(otherParticipantId);

  // ── Mensagens ─────────────────────────────────────────────────────────────
  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlder,
  } = useMessagesQuery({ chatId, enabled: Boolean(chatId) });

  const sendMutation = useSendMessageMutation();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUserQuery();

  // Apagar mensagem (para mim / para todos) — invalida histórico e lista
  const invalidateMessages = useCallback(() => {
    if (!chatId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.messages.byChatId(chatId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine });
  }, [chatId, queryClient]);

  const deleteForMeMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.deleteForMe(messageId, { token: accessToken! }),
    onSuccess: invalidateMessages,
  });

  const deleteForAllMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.delete(messageId, { token: accessToken! }),
    onSuccess: invalidateMessages,
  });

  const favoriteMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.favorite(messageId, { token: accessToken! }),
    onSuccess: invalidateMessages,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<LeafMessage | null>(null);
  const [forwarding, setForwarding] = useState<LeafMessage | null>(null);
  const chatMenuRef = useRef<ChatHeaderMenuHandle>(null);

  // O WebSocket agora é único e global (AuthenticatedShell → GlobalPresence),
  // então não abrimos outra conexão aqui — evita 2 sockets para o mesmo user
  // (o segundo sobrescrevia o primeiro e bagunçava o status online).

  // ── Scroll automático ─────────────────────────────────────────────────────
  // Posiciona no FIM antes da pintura (useLayoutEffect → sem o "puxão" do topo
  // pro fim). Rola o próprio container (scrollTop), não a página, e reposiciona
  // quando imagens/áudios carregam depois (mudam a altura). Reset por chatId:
  // o componente é reusado entre conversas, então a 1ª carga de CADA conversa
  // precisa cair no fim de novo.
  const scrolledChatRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!messages?.length) return;
    const el = messagesContainerRef.current;
    if (!el) return;

    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    if (scrolledChatRef.current !== chatId) {
      // primeira carga desta conversa → fim instantâneo (+ reposiciona após o
      // layout assentar: avatares/imagens carregam e empurram o conteúdo)
      toBottom();
      scrolledChatRef.current = chatId;
      atBottomRef.current = true;
      requestAnimationFrame(toBottom);
      const t = window.setTimeout(toBottom, 220);
      // mantém colado no fim enquanto as mídias carregam (1,5s) → sem "puxão"
      const onMediaLoad = () => { if (atBottomRef.current) el.scrollTop = el.scrollHeight; };
      el.addEventListener('load', onMediaLoad, true);
      const stop = window.setTimeout(() => el.removeEventListener('load', onMediaLoad, true), 1500);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(stop);
        el.removeEventListener('load', onMediaLoad, true);
      };
    }

    // mensagens novas: só acompanha o fim se o usuário já estava lá
    if (atBottomRef.current) toBottom();
  }, [messages, chatId]);

  // ── Read receipts: marca recebidas como lidas ao abrir / ao chegar novas ──
  useEffect(() => {
    if (!chatId || !accessToken || !currentUser || !messages?.length) return;
    const hasUnreadIncoming = messages.some(
      (m) => m.sender_id !== currentUser.id && !m.read,
    );
    if (!hasUnreadIncoming) return;
    messagesApi
      .markAsRead(chatId, { token: accessToken })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.chats.mine }))
      .catch(() => undefined);
  }, [chatId, accessToken, currentUser, messages, queryClient]);

  // Pesquisar na conversa (filtra as mensagens já carregadas pelo termo)
  const visibleMessages = useMemo(() => {
    if (!searchOpen || !searchTerm.trim()) return messages;
    const t = searchTerm.trim().toLowerCase();
    return (messages ?? []).filter((m) => (m.content || '').toLowerCase().includes(t));
  }, [messages, searchOpen, searchTerm]);

  const feed = useMemo(() => buildFeed(visibleMessages), [visibleMessages]);

  // Bloqueia só se não tiver chatId ou usuário logado
  if (!chatId || !currentUser) {
    return (
      <div className="chat-window-page chat-window-page--status">
        <LoadingSpinner message="Carregando conversa…" />
      </div>
    );
  }

  // ── Envio de mensagem ─────────────────────────────────────────────────────
  // NÃO bloqueia mais por !currentChat — usa otherParticipantId diretamente
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    // Não envia se o ID do destinatário ainda não foi resolvido (evita receiver_id vazio)
    if (!otherParticipantId) return;

    atBottomRef.current = true; // envio próprio sempre rola para o fim
    const receiverId = otherParticipantId ?? '';
    const reply = replyingTo; // captura antes de limpar

    try {
      await sendMutation.mutateAsync({
        chat_id: chatId,
        content,
        receiver_id: receiverId,
        type: 'text',
        reply_to: reply?._id ?? null,
        reply_preview: reply
          ? {
              _id: reply._id,
              sender_id: reply.sender_id,
              content: (reply.content || '').slice(0, 120),
              type: reply.type,
            }
          : null,
      });
      setReplyingTo(null);
      setSendError(null);
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      // Mostra o motivo real na tela — antes a mensagem sumia em silêncio e
      // parecia que "a conversa travou".
      const raw = error instanceof Error ? error.message.toLowerCase() : '';
      setSendError(
        raw.includes('block') || raw.includes('bloque')
          ? 'Você foi bloqueado por este contato e não pode enviar mensagens.'
          : 'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.',
      );
    }
  };

  // ── Header: nome e avatar do outro participante ───────────────────────────
  // BUG-7: enquanto o participante carrega, mostra skeleton — nunca UUID/"Conversa".
  const headerLoading = !otherUser && Boolean(otherParticipantId);
  const displayName = otherUser?.display_name || otherUser?.name || '';
  const headerInitial = (displayName.charAt(0) || '').toUpperCase();
  const isOtherOnline = otherUser?.online ?? false;

  return (
    <div className="chat-window-page">
      <header className="chat-window-page__header">
        <button
          className="chat-window-page__back"
          type="button"
          aria-label="Voltar para conversas"
          onClick={() => navigate(routePaths.chats)}
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>

        <div
          className="chat-window-page__user-info chat-window-page__user-info--clickable"
          onClick={() => chatMenuRef.current?.openContact()}
          onKeyDown={(e) => e.key === 'Enter' && chatMenuRef.current?.openContact()}
          role="button"
          tabIndex={0}
          aria-label={`Ver perfil de ${displayName}`}
        >
          <Avatar
            src={otherUser?.avatar}
            initials={headerInitial}
            size="sm"
            online={isOtherOnline}
          />
          <div className="chat-window-page__user-meta">
            <h2 className="chat-window-page__name">
              {headerLoading ? <span className="chat-window-page__name-skeleton" /> : displayName}
            </h2>
            <p className="chat-window-page__status">
              {headerLoading
                ? ''
                : isOtherOnline
                ? 'Online agora'
                : otherUser?.last_seen
                ? `visto por último ${formatLastSeen(otherUser.last_seen)}`
                : otherUser
                ? 'Offline'
                : ''}
            </p>
          </div>
        </div>

        <ChatHeaderMenu
          ref={chatMenuRef}
          chatId={chatId}
          otherUser={otherUser}
          otherUserId={otherParticipantId}
          muted={currentChat?.muted ?? false}
          archived={currentChat?.archived ?? false}
          messages={messages}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </header>

      {searchOpen && (
        <div className="chat-window-page__search">
          <Search size={16} strokeWidth={2.2} />
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar nesta conversa…"
            aria-label="Pesquisar na conversa"
          />
          <button
            type="button"
            className="chat-window-page__search-close"
            onClick={() => {
              setSearchOpen(false);
              setSearchTerm('');
            }}
            aria-label="Fechar busca"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <main
        ref={messagesContainerRef}
        className="chat-window-page__messages"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {/* Carregar mensagens mais antigas */}
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
            <LoadingSpinner message="Carregando mensagens…" />
          </div>
        ) : messagesError ? (
          <div className="chat-window-page__status-block">
            <ErrorMessage
              error={`Não foi possível carregar as mensagens: ${
                messagesError instanceof Error ? messagesError.message : 'Erro desconhecido'
              }`}
            />
          </div>
        ) : feed.length === 0 ? (
          <div className="chat-window-page__empty">
            <h3>Nenhuma mensagem ainda</h3>
            <p>Diga olá para {displayName} 👋</p>
          </div>
        ) : (
          feed.map((item) =>
            item.type === 'divider' ? (
              <div key={item.key} className="chat-window-page__divider" role="separator">
                <span>{item.label}</span>
              </div>
            ) : (
              <MessageRow
                key={item.key}
                message={item.message}
                isOwn={item.message.sender_id === currentUser.id}
                currentUserId={currentUser.id}
                otherName={displayName}
                suppressReadReceipt={me?.show_read_receipts === false}
                onReply={() => setReplyingTo(item.message)}
                onForward={() => setForwarding(item.message)}
                onToggleFavorite={() => favoriteMutation.mutate(item.message._id)}
                onDeleteForMe={() => deleteForMeMutation.mutate(item.message._id)}
                onDeleteForEveryone={() => deleteForAllMutation.mutate(item.message._id)}
              />
            ),
          )
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-window-page__composer-wrap">
        {sendError && (
          <div className="chat-window-page__send-error" role="alert">
            <span>{sendError}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setSendError(null)}
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}
        {replyingTo && (
          <div className="chat-window-page__reply-bar">
            <div className="chat-window-page__reply-bar-body">
              <span className="chat-window-page__reply-bar-author">
                {replyingTo.sender_id === currentUser.id
                  ? 'Você'
                  : replyingTo.sender_id === 'humberto'
                  ? 'Humberto'
                  : displayName}
              </span>
              <span className="chat-window-page__reply-bar-text">
                {replyPreviewText(replyingTo)}
              </span>
            </div>
            <button
              type="button"
              aria-label="Cancelar resposta"
              onClick={() => setReplyingTo(null)}
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}
        <MessageComposer
          recipientName={displayName}
          onSend={handleSendMessage}
          onSendAudio={async (blob) => {
            if (!accessToken || !otherParticipantId) return;
            const form = new FormData();
            form.append('file', blob, 'audio.webm');
            const { url } = await uploadsApi.audio(form, accessToken);
            await sendMutation.mutateAsync({
              chat_id: chatId,
              content: '',
              receiver_id: otherParticipantId,
              type: 'audio',
              file_url: url,
            });
            setReplyingTo(null);
          }}
          onPickFile={(file) => setPendingFile(file)}
          onPickDocument={async (file) => {
            if (!accessToken || !otherParticipantId) return;
            try {
              const { url } = await uploadsApi.file(file, accessToken);
              await sendMutation.mutateAsync({
                chat_id: chatId,
                content: file.name,
                receiver_id: otherParticipantId,
                type: 'file',
                file_url: url,
              });
              setReplyingTo(null);
              setSendError(null);
            } catch (error) {
              const raw = error instanceof Error ? error.message.toLowerCase() : '';
              setSendError(
                raw.includes('413') || raw.includes('grande')
                  ? 'Arquivo muito grande (máximo 10 MB).'
                  : 'Não foi possível enviar o arquivo. Tente novamente.',
              );
            }
          }}
          isLoading={sendMutation.isPending}
        />
      </footer>

      {pendingFile && (
        <ImagePreviewModal
          file={pendingFile}
          sending={sendingImage}
          recipientLabel={displayName}
          onCancel={() => setPendingFile(null)}
          onSend={async (caption) => {
            if (!accessToken || !otherParticipantId) return;
            setSendingImage(true);
            const reply = replyingTo;
            try {
              const form = new FormData();
              form.append('file', pendingFile);
              const { url } = await uploadsApi.image(form, accessToken);
              await sendMutation.mutateAsync({
                chat_id: chatId,
                content: caption.trim(),
                receiver_id: otherParticipantId,
                type: 'image',
                file_url: url,
                reply_to: reply?._id ?? null,
                reply_preview: reply
                  ? {
                      _id: reply._id,
                      sender_id: reply.sender_id,
                      content: (reply.content || '').slice(0, 120),
                      type: reply.type,
                    }
                  : null,
              });
              setPendingFile(null);
              setReplyingTo(null);
            } finally {
              setSendingImage(false);
            }
          }}
        />
      )}
      {forwarding && (
        <ForwardModal message={forwarding} onClose={() => setForwarding(null)} />
      )}
    </div>
  );
}

interface MessageRowProps {
  message: LeafMessage;
  isOwn: boolean;
  currentUserId: string;
  otherName: string;
  suppressReadReceipt?: boolean;
  onReply: () => void;
  onForward: () => void;
  onToggleFavorite: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

function MessageRow({
  message,
  isOwn,
  currentUserId,
  otherName,
  suppressReadReceipt,
  onReply,
  onForward,
  onToggleFavorite,
  onDeleteForMe,
  onDeleteForEveryone,
}: MessageRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Resposta do Humberto (IA) dentro da conversa → rótulo identificando o autor.
  const isHumberto = message.sender_id === 'humberto';

  // Toque longo (mobile) / clique-direito (desktop) abre o menu de opções.
  const longPress = useLongPress(() => setMenuOpen(true));

  // Sem menu em mensagem otimista (sem _id real) nem em mensagem já apagada.
  const isOptimistic = message._id.startsWith('optimistic-');
  const canDelete = !isOptimistic && !message.deleted;
  const canDeleteForEveryone = isOwn && !message.deleted;

  // Citação (resposta): autor = "Você" se for minha, senão o nome do contato
  const rp = message.reply_preview;
  const replyAuthor = rp
    ? rp.sender_id === currentUserId
      ? 'Você'
      : rp.sender_id === 'humberto'
      ? 'Humberto'
      : otherName
    : undefined;
  const replyText = rp ? replyPreviewText(rp) : undefined;

  return (
    <div className={`chat-window-page__row${isOwn ? ' chat-window-page__row--own' : ''}`}>
      <div className="message-row__wrap" {...longPress}>
        {isHumberto && (
          <span className="message-row__humberto">
            <Sprout size={12} strokeWidth={2.4} aria-hidden="true" /> Humberto
          </span>
        )}
        <MessageBubble
          content={message.content}
          type={message.type}
          fileUrl={message.file_url}
          isSender={isOwn}
          timestamp={formatTime(message.created_at)}
          status={message.status}
          edited={message.edited}
          deleted={message.deleted}
          suppressReadReceipt={suppressReadReceipt}
          replyAuthor={replyAuthor}
          replyText={replyText}
          favorited={message.favorited}
        />

        {canDelete && (
          <div className="message-row__menu-wrap">
            <button
              type="button"
              className="message-row__menu-btn"
              aria-label="Opções da mensagem"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <ChevronDown size={16} strokeWidth={2.4} />
            </button>

            {menuOpen && (
              <>
                <div className="message-row__backdrop" onClick={() => setMenuOpen(false)} />
                <div className="message-row__menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReply();
                    }}
                  >
                    <Reply size={15} strokeWidth={2} /> Responder
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onForward();
                    }}
                  >
                    <Forward size={15} strokeWidth={2} /> Encaminhar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleFavorite();
                    }}
                  >
                    <Star size={15} strokeWidth={2} /> {message.favorited ? 'Desfavoritar' : 'Favoritar'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteForMe();
                    }}
                  >
                    <Trash2 size={15} strokeWidth={2} /> Apagar para mim
                  </button>
                  {canDeleteForEveryone && (
                    <button
                      type="button"
                      role="menuitem"
                      className="message-row__menu-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm('Apagar esta mensagem para todos?')) {
                          onDeleteForEveryone();
                        }
                      }}
                    >
                      <Trash2 size={15} strokeWidth={2} /> Apagar para todos
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageComposerProps {
  recipientName: string;
  onSend: (content: string) => void;
  onPickFile?: (file: File) => void;
  onPickDocument?: (file: File) => void;
  onSendAudio?: (blob: Blob) => Promise<void>;
  isLoading?: boolean;
}

function MessageComposer({ recipientName, onSend, onPickFile, onPickDocument, onSendAudio, isLoading = false }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTools, setShowTools] = useState(false); // menu "+" no mobile
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const { state: recState, duration, start: startRec, stop: stopRec, cancel: cancelRec } = useAudioRecorder();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setMessage('');
    inputRef.current?.focus(); // mantém o foco no campo após enviar
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra linha (comportamento padrão do textarea)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const trimmed = message.trim();
      if (!trimmed || isLoading) return;
      onSend(trimmed);
      setMessage('');
      inputRef.current?.focus();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onPickFile) onPickFile(file);
    event.target.value = '';
  };

  // Anexo genérico: imagem → fluxo de preview; qualquer outro → documento
  const handleDocChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/') && onPickFile) onPickFile(file);
      else if (onPickDocument) onPickDocument(file);
    }
    event.target.value = '';
  };

  // Colar imagem do clipboard (Ctrl/Cmd+V) → abre o preview, como no WhatsApp Web
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file && onPickFile) {
          event.preventDefault(); // não cola o "[object]" no texto
          onPickFile(file);
          break;
        }
      }
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setMessage((m) => m + emoji);
      return;
    }
    const start = input.selectionStart ?? message.length;
    const end   = input.selectionEnd   ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    // Reposiciona cursor após o emoji inserido
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  }, [message]);

  return (
    <>
    <HumbertoMentionHint active={mentionsHumberto(message)} />
    <form className="message-composer" onSubmit={handleSubmit} noValidate>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {/* Input genérico: aceita qualquer arquivo (pdf, doc, zip, etc.) */}
      <input
        ref={docInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleDocChange}
      />

      {/* Botão "+" (só no mobile) abre o menu de anexos/ferramentas. No desktop
          fica escondido e as ferramentas aparecem inline (CSS display:contents). */}
      <button
        type="button"
        className={`message-composer__icon message-composer__more${showTools ? ' message-composer__icon--active' : ''}`}
        aria-label="Mais opções"
        aria-expanded={showTools}
        disabled={isLoading}
        onClick={() => setShowTools((v) => !v)}
      >
        <Plus size={20} strokeWidth={2.4} />
      </button>

      {/* Ferramentas: inline no desktop, popover do "+" no mobile */}
      <div className={`message-composer__tools${showTools ? ' message-composer__tools--open' : ''}`}>
        {/* Anexar arquivo (qualquer tipo) — estilo clipe */}
        <button
          type="button"
          className="message-composer__icon"
          aria-label="Anexar arquivo"
          disabled={isLoading}
          onClick={() => { setShowTools(false); docInputRef.current?.click(); }}
        >
          <Paperclip size={18} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          className="message-composer__icon"
          aria-label="Anexar imagem"
          disabled={isLoading}
          onClick={() => { setShowTools(false); fileInputRef.current?.click(); }}
        >
          <Image size={18} strokeWidth={2.2} />
        </button>

        {/* Câmera ao vivo (getUserMedia) — funciona no desktop e no mobile */}
        <button
          type="button"
          className="message-composer__icon"
          aria-label="Tirar foto"
          disabled={isLoading}
          onClick={() => { setShowTools(false); setShowCamera(true); }}
        >
          <Camera size={18} strokeWidth={2.2} />
        </button>

        {/* Marcar o Humberto rapidamente (insere @Humberto no texto) */}
        <button
          type="button"
          className={`message-composer__icon${mentionsHumberto(message) ? ' message-composer__icon--active' : ''}`}
          aria-label="Marcar o Humberto"
          title="Marcar o Humberto (ele responde aqui)"
          disabled={isLoading}
          onClick={() => {
            setShowTools(false);
            setMessage((m) => (mentionsHumberto(m) ? m : `@Humberto ${m}`.trimEnd() + ' '));
            inputRef.current?.focus();
          }}
        >
          <Sprout size={18} strokeWidth={2.2} />
        </button>

        {/* Ditado por voz → texto (transcreve no campo, sem enviar) */}
        <DictationButton currentText={message} onTranscript={setMessage} disabled={isLoading} />
      </div>

      {showCamera && (
        <CameraCaptureModal
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setShowCamera(false);
            onPickFile?.(file);
          }}
        />
      )}

      <textarea
        ref={inputRef}
        rows={1}
        className="message-composer__input"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={`Mensagem para ${recipientName}…`}
        aria-label="Escreva uma mensagem"
        autoComplete="off"
        spellCheck
        lang="pt-BR"
      />

      {/* Emoji picker */}
      <div ref={emojiWrapRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`message-composer__icon${showEmoji ? ' message-composer__icon--active' : ''}`}
          aria-label="Inserir emoji"
          aria-expanded={showEmoji}
          disabled={isLoading}
          onClick={() => setShowEmoji((v) => !v)}
        >
          <Smile size={18} strokeWidth={2.2} />
        </button>
        {showEmoji && (
          <EmojiPicker
            onSelect={(emoji) => { handleEmojiSelect(emoji); }}
            onClose={() => setShowEmoji(false)}
          />
        )}
      </div>

      {/* Microfone — mostra quando não há texto digitado */}
      {!message.trim() && recState === 'idle' && (
        <button
          type="button"
          className="message-composer__icon"
          aria-label="Gravar áudio"
          disabled={isLoading}
          onClick={async () => {
            const ok = await startRec();
            if (!ok) alert('Sem permissão para acessar o microfone.');
          }}
        >
          <Mic size={18} strokeWidth={2.2} />
        </button>
      )}

      {/* Gravando */}
      {recState === 'recording' && (
        <>
          <span className="message-composer__rec-badge">
            🔴 {duration}s
          </span>
          <button
            type="button"
            className="message-composer__icon"
            aria-label="Cancelar gravação"
            onClick={cancelRec}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="message-composer__send message-composer__send--recording"
            aria-label="Enviar áudio"
            onClick={async () => {
              const blob = await stopRec();
              if (blob && onSendAudio) await onSendAudio(blob);
            }}
          >
            <Send size={18} strokeWidth={2.4} />
          </button>
        </>
      )}

      {/* Botão enviar texto — só quando há texto */}
      {(message.trim() || recState !== 'recording') && recState === 'idle' && (
        <button
          type="submit"
          className="message-composer__send"
          aria-label="Enviar mensagem"
          disabled={isLoading || !message.trim()}
        >
          <Send size={18} strokeWidth={2.4} />
        </button>
      )}
    </form>
    </>
  );
}
