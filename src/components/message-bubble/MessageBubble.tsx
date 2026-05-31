import './message-bubble.css';
import type { MessageStatus } from '../../lib/api/contracts';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  content: string;
  isSender: boolean;
  timestamp?: string;
  status?: MessageStatus;
  edited?: boolean;
  deleted?: boolean;
}

export function MessageBubble({
  content,
  isSender,
  timestamp,
  status,
  edited,
  deleted,
}: MessageBubbleProps) {
  return (
    <div
      className={`message-bubble ${isSender ? 'message-bubble--sender' : 'message-bubble--receiver'}`}
    >
      <div className="message-bubble__body">
        {deleted ? (
          <em className="message-bubble__deleted">Mensagem apagada</em>
        ) : (
          <p className="message-bubble__text">{content}</p>
        )}
      </div>

      <div className="message-bubble__footer">
        {timestamp && <time className="message-bubble__time">{timestamp}</time>}
        {edited && <span className="message-bubble__edited">(editado)</span>}
        {isSender && status && (
          <span className="message-bubble__status" aria-label={`Status: ${status}`}>
            {status === 'read' ? <CheckCheck size={13} /> : <Check size={13} />}
          </span>
        )}
      </div>
    </div>
  );
}
