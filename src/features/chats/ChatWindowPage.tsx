import { ArrowLeft, Image, MoreVertical, Send, Smile } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/avatar/Avatar';
import { ErrorMessage, LoadingSpinner } from '../../components/feedback/FeedbackComponents';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import type { LeafMessage } from '../../lib/api/contracts';
import { useAuth } from '../../lib/auth/use-auth';
import { routePaths } from '../../routes/paths';
import {
  useChatQuery,
  useMessagesQuery,
  useParticipantQuery,
  useSendMessageMutation,
} from './chats-hooks';
import { uploadsApi } from '../../lib/api/endpoints';
import { useAuth } from '../../lib/auth/use-auth';
import { useWebSocket } from './useWebSocket';
import './chat-window-page.css';

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useWebSocket({
    userId: currentUser?.id,
    chatId,
    enabled: Boolean(chatId && currentUser?.id),
  });

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const feed = useMemo(() => buildFeed(messages), [messages]);

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
              {isOtherOnline ? 'Online agora' : otherUser ? 'Offline' : ''}
            </p>
          </div>
        </div>

        <button
          className="chat-window-page__menu"
          type="button"
          aria-label="Opções da conversa"
        >
          <MoreVertical size={18} strokeWidth={2.2} />
        </button>
      </header>

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
          onSendFile={async (file) => {
            if (!accessToken || !otherParticipantId) return;
            const form = new FormData();
            form.append('file', file);
            const { url } = await uploadsApi.image(form, accessToken);
            await sendMutation.mutateAsync({
              chat_id: chatId,
              content: '',
              receiver_id: otherParticipantId,
              type: 'image',
              file_url: url,
            });
          }}
          isLoading={sendMutation.isPending}
        />
        <small className="chat-window-page__footnote">
          CRIPTOGRAFIA ATIVA · POWERED BY LEAF 1.4
        </small>
      </footer>
    </div>
  );
}

interface MessageComposerProps {
  recipientName: string;
  onSend: (content: string) => void;
  onSendFile?: (file: File) => Promise<void>;
  isLoading?: boolean;
}

function MessageComposer({ recipientName, onSend, onSendFile, isLoading = false }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onSendFile) return;
    await onSendFile(file);
    event.target.value = '';
  };

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

      <input
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

      <button
        type="button"
        className="message-composer__icon"
        aria-label="Inserir emoji"
        disabled={isLoading}
      >
        <Smile size={18} strokeWidth={2.2} />
      </button>

      <button
        type="submit"
        className="message-composer__send"
        aria-label="Enviar mensagem"
        disabled={isLoading || !message.trim()}
      >
        <Send size={18} strokeWidth={2.4} />
      </button>
    </form>
  );
}
