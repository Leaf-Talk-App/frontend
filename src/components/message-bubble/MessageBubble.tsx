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
  if (status === 'read') return <CheckCheck size={12} aria-label="Lida" />;
  if (status === 'delivered') return <CheckCheck size={12} aria-label="Entregue" style={{ opacity: 0.55 }} />;
  return <Check size={12} aria-label="Enviada" />;
}

function Footer({
  timestamp,
  status,
  edited,
  isSender,
}: Pick<MessageBubbleProps, 'timestamp' | 'status' | 'edited' | 'isSender'>) {
  return (
    <div className="message-bubble__footer">
      {edited && <span className="message-bubble__edited">editado</span>}
      {timestamp && <time className="message-bubble__time">{timestamp}</time>}
      {isSender && status && (
        <span className="message-bubble__status">
          <StatusIcon status={status} />
        </span>
      )}
    </div>
  );
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
  const senderCls = isSender ? 'message-bubble--sender' : 'message-bubble--receiver';
  const isImage = type === 'image' && fileUrl && !deleted;
  const isAudio = type === 'audio' && fileUrl && !deleted;

  /* ── Imagem ────────────────────────────────────────────────────────────── */
  if (isImage) {
    return (
      <div className={`message-bubble message-bubble--image ${senderCls}`}>
        <div className="message-bubble__body">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={fileUrl}
              alt=""
              className="message-bubble__image"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </a>
          <Footer timestamp={timestamp} status={status} edited={edited} isSender={isSender} />
        </div>
      </div>
    );
  }

  /* ── Áudio ─────────────────────────────────────────────────────────────── */
  if (isAudio) {
    return (
      <div className={`message-bubble ${senderCls}`}>
        <div className="message-bubble__body">
          <audio src={fileUrl} controls className="message-bubble__audio" preload="metadata" />
          <Footer timestamp={timestamp} status={status} edited={edited} isSender={isSender} />
        </div>
      </div>
    );
  }

  /* ── Texto (padrão) ─────────────────────────────────────────────────────── */
  return (
    <div className={`message-bubble ${senderCls}`}>
      <div className="message-bubble__body">
        <div className="message-bubble__inner">
          {deleted ? (
            <p className="message-bubble__deleted">Mensagem apagada</p>
          ) : (
            <p className="message-bubble__text">{content}</p>
          )}
          <Footer timestamp={timestamp} status={status} edited={edited} isSender={isSender} />
        </div>
      </div>
    </div>
  );
}
