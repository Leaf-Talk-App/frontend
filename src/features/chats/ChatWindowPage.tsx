import { ArrowLeft, Camera, Image, Mic, MicOff, Search, Send, Smile, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmojiPicker } from '../../components/emoji-picker/EmojiPicker';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/avatar/Avatar';
import { ErrorMessage, LoadingSpinner } from '../../components/feedback/FeedbackComponents';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import { ImagePreviewModal } from '../../components/image-preview-modal/ImagePreviewModal';
import { CameraCaptureModal } from '../../components/camera-capture-modal/CameraCaptureModal';
import { ChatHeaderMenu } from './ChatHeaderMenu';
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
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/use-auth';
import './chat-window-page.css';

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `hoje às ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}

function formatDateDivider(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

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
  const { user: currentUser, accessToken } = useAuth();

  // ── Dados da conversa ─────────────────────────────────────────────────────
  // useChatQuery: primeiro tenta o cache da lista, depois GET /chats/{id}
  const { data: currentChat } = useChatQuery(chatId);

  // Participante do outro lado
  const otherParticipantId = useMemo(
    () => currentChat?.participants?.find((id) => id !== currentUser?.id),
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // O WebSocket agora é único e global (AuthenticatedShell → GlobalPresence),
  // então não abrimos outra conexão aqui — evita 2 sockets para o mesmo user
  // (o segundo sobrescrevia o primeiro e bagunçava o status online).

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const receiverId = otherParticipantId ?? '';

    try {
      await sendMutation.mutateAsync({
        chat_id: chatId,
        content,
        receiver_id: receiverId,
        type: 'text',
      });
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
    }
  };

  // ── Header: nome e avatar do outro participante ───────────────────────────
  const displayName =
    otherUser?.display_name || otherUser?.name || otherParticipantId?.slice(0, 8) || 'Conversa';
  const headerInitial = (displayName.charAt(0) || 'C').toUpperCase();
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

        <div className="chat-window-page__user-info">
          <Avatar
            src={otherUser?.avatar}
            initials={headerInitial}
            size="sm"
            online={isOtherOnline}
          />
          <div className="chat-window-page__user-meta">
            <h2 className="chat-window-page__name">{displayName}</h2>
            <p className="chat-window-page__status">
              {isOtherOnline
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
          chatId={chatId}
          otherUser={otherUser}
          otherUserId={otherParticipantId}
          muted={currentChat?.muted ?? false}
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

      <main className="chat-window-page__messages" aria-live="polite">
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
              <div
                key={item.key}
                className={`chat-window-page__row${
                  item.message.sender_id === currentUser.id
                    ? ' chat-window-page__row--own'
                    : ''
                }`}
              >
                <MessageBubble
                  content={item.message.content}
                  type={item.message.type}
                  fileUrl={item.message.file_url}
                  isSender={item.message.sender_id === currentUser.id}
                  timestamp={formatTime(item.message.created_at)}
                  status={item.message.status}
                  edited={item.message.edited}
                  deleted={item.message.deleted}
                />
              </div>
            ),
          )
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-window-page__composer-wrap">
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
          }}
          onPickFile={(file) => setPendingFile(file)}
          isLoading={sendMutation.isPending}
        />
        <small className="chat-window-page__footnote">
          CRIPTOGRAFIA ATIVA · POWERED BY LEAF 1.4
        </small>
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
              });
              setPendingFile(null);
            } finally {
              setSendingImage(false);
            }
          }}
        />
      )}
    </div>
  );
}

interface MessageComposerProps {
  recipientName: string;
  onSend: (content: string) => void;
  onPickFile?: (file: File) => void;
  onSendAudio?: (blob: Blob) => Promise<void>;
  isLoading?: boolean;
}

function MessageComposer({ recipientName, onSend, onPickFile, onSendAudio, isLoading = false }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const { state: recState, duration, start: startRec, stop: stopRec, cancel: cancelRec } = useAudioRecorder();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setMessage('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const trimmed = message.trim();
      if (!trimmed || isLoading) return;
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onPickFile) onPickFile(file);
    event.target.value = '';
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
    <form className="message-composer" onSubmit={handleSubmit} noValidate>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button
        type="button"
        className="message-composer__icon"
        aria-label="Anexar imagem"
        disabled={isLoading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Image size={18} strokeWidth={2.2} />
      </button>

      {/* Câmera ao vivo (getUserMedia) — funciona no desktop e no mobile */}
      <button
        type="button"
        className="message-composer__icon"
        aria-label="Tirar foto"
        disabled={isLoading}
        onClick={() => setShowCamera(true)}
      >
        <Camera size={18} strokeWidth={2.2} />
      </button>
      {showCamera && (
        <CameraCaptureModal
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setShowCamera(false);
            onPickFile?.(file);
          }}
        />
      )}

      <input
        ref={inputRef}
        type="text"
        className="message-composer__input"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Escreva uma mensagem para ${recipientName}…`}
        aria-label="Escreva uma mensagem"
        disabled={isLoading}
        autoComplete="off"
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
  );
}
