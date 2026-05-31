import { Avatar } from '../avatar/Avatar';
import './chat-item.css';
import type { LeafChatSummary, LeafUser } from '../../lib/api/contracts';

interface ChatItemProps {
  chat: LeafChatSummary;
  otherUser?: LeafUser;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatTimestamp(dateString?: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

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
  const displayName = otherUser?.display_name || otherUser?.name || 'Desconhecido';
  const avatar = otherUser?.avatar;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const lastMessage = chat.last_message?.content || 'Nenhuma mensagem ainda';
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
          <h3 className="chat-item__name">{displayName}</h3>
          <time className="chat-item__time">{timestamp}</time>
        </div>

        <p className="chat-item__message">{lastMessage}</p>
      </div>

      {hasUnread ? (
        <span className="chat-item__badge" aria-label={`${chat.unread_count} não lidas`}>
          {chat.unread_count}
        </span>
      ) : null}
    </button>
  );
}
