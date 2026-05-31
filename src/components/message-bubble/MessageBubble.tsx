import './message-bubble.css';
import type { MessageStatus, MessageType } from '../../lib/api/contracts';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  content: string;
  type?: MessageType;
  fileUrl?: string | null;
  isSender: boolean;
  timestamp?: string;
  status?: MessageStatus;
  edited?: boolean;
  deleted?: boolean;
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'read') return <CheckCheck size={13} aria-label="Lida" />;
  if (status === 'delivered') return <CheckCheck size={13} aria-label="Entregue" style={{ opacity: 0.6 }} />;
  return <Check size={13} aria-label="Enviada" />;
}

export function MessageBubble({
  content,
  type = 'text',
  fileUrl,
  isSender,
  timestamp,
  status,
  edited,
  deleted,
}: MessageBubbleProps) {
  const cls = `message-bubble ${isSender ? 'message-bubble--sender' : 'message-bubble--receiver'}`;

  return (
    <div className={cls}>
      <div className="message-bubble__body">
        {deleted ? (
          <em className="message-bubble__deleted">Mensagem apagada</em>
        ) : type === 'image' && fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="message-bubble__image-link">
            <img
              src={fileUrl}
              alt="Imagem"
              className="message-bubble__image"
              loading="lazy"
            />
          </a>
        ) : type === 'audio' && fileUrl ? (
          <audio
            src={fileUrl}
            controls
            className="message-bubble__audio"
            preload="metadata"
          />
        ) : (
          content && <p className="message-bubble__text">{content}</p>
        )}

        {/* Footer sempre dentro da bolha — estilo WhatsApp */}
        <div className={`message-bubble__footer ${(type === 'image' && fileUrl && !deleted) ? 'message-bubble__footer--over-image' : ''}`}>
          {edited && !deleted && <span className="message-bubble__edited">editado</span>}
          {timestamp && <time className="message-bubble__time">{timestamp}</time>}
          {isSender && status && (
            <span className="message-bubble__status">
              <StatusIcon status={status} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
