import { FileText, Image as ImageIcon, Mic, Video } from 'lucide-react';
import { Avatar } from '../avatar/Avatar';
import './chat-item.css';
import { parseServerDate } from '../../lib/date';
import type { LeafChatSummary, LeafUser } from '../../lib/api/contracts';

// Indicador de mídia (ícone outline + texto) quando a última mensagem não tem texto.
const MEDIA_PREVIEW: Record<string, { icon: typeof ImageIcon; label: string }> = {
  image: { icon: ImageIcon, label: 'Foto' },
  audio: { icon: Mic, label: 'Áudio' },
  video: { icon: Video, label: 'Vídeo' },
  file: { icon: FileText, label: 'Arquivo' },
};

function LastMessagePreview({ message }: { message?: LeafChatSummary['last_message'] }) {
  if (!message) return <>Nenhuma mensagem ainda</>;

  const text = message.content?.trim();
  if (text) return <>{text}</>;

  const media = message.type ? MEDIA_PREVIEW[message.type] : undefined;
  if (media) {
    const MediaIcon = media.icon;
    return (
      <span className="chat-item__media-preview">
        <MediaIcon size={14} strokeWidth={2} aria-hidden="true" />
        {media.label}
      </span>
    );
  }

  return <>Nenhuma mensagem ainda</>;
}

interface ChatItemProps {
  chat: LeafChatSummary;
  otherUser?: LeafUser;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatTimestamp(dateString?: string): string {
  const date = parseServerDate(dateString);
  if (!date) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'AGORA';
  if (diffMins < 60) return `HÁ ${diffMins}MIN`;
  if (diffHours < 24) return `HÁ ${diffHours}H`;
  if (diffDays === 1) return 'ONTEM';
  if (diffDays < 7) return `HÁ ${diffDays}D`;

  return date
    .toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

export function ChatItem({
  chat,
  otherUser,
  isSelected = false,
  onClick,
}: ChatItemProps) {
  const loading = !otherUser; // dados do participante ainda carregando
  const displayName = otherUser?.display_name || otherUser?.name || '';
  const avatar = otherUser?.avatar;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timestamp = formatTimestamp(chat.updated_at);
  const hasUnread = Boolean(chat.unread_count);

  return (
    <button
      className={`chat-item${isSelected ? ' chat-item--selected' : ''}${hasUnread ? ' chat-item--unread' : ''}`}
      onClick={onClick}
      type="button"
      aria-current={isSelected ? 'page' : undefined}
    >
      <Avatar src={avatar} initials={initials} size="md" online={otherUser?.online} />

      <div className="chat-item__content">
        <div className="chat-item__header">
          <h3 className="chat-item__name">
            {loading ? <span className="chat-item__skeleton-bar" /> : displayName}
          </h3>
          <time className="chat-item__time">{timestamp}</time>
        </div>

        <p className="chat-item__message">
          <LastMessagePreview message={chat.last_message} />
        </p>
      </div>

      {hasUnread ? (
        <span className="chat-item__badge" aria-label={`${chat.unread_count} não lidas`}>
          {chat.unread_count}
        </span>
      ) : null}
    </button>
  );
}
