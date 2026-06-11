import { useState } from 'react';
import './message-bubble.css';
import type { MessageStatus, MessageType } from '../../lib/api/contracts';
import { Check, CheckCheck, FileText } from 'lucide-react';
import { AudioPlayer } from '../audio-player/AudioPlayer';
import { MediaViewer } from '../media-viewer/MediaViewer';

interface MessageBubbleProps {
  content: string;
  type?: MessageType;
  fileUrl?: string | null;
  isSender: boolean;
  timestamp?: string;
  status?: MessageStatus;
  edited?: boolean;
  deleted?: boolean;
  /** quando true, nunca exibe o ✓✓ verde (usuário desativou confirmações) */
  suppressReadReceipt?: boolean;
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'read')
    return <CheckCheck size={12} aria-label="Lida" className="message-bubble__tick--read" />;
  if (status === 'delivered')
    return <CheckCheck size={12} aria-label="Entregue" style={{ opacity: 0.55 }} />;
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

function isPdf(url?: string | null): boolean {
  return Boolean(url && /\.pdf(\?|#|$)/i.test(url));
}

function fileNameFromUrl(url?: string | null): string {
  if (!url) return 'arquivo';
  try {
    const u = new URL(url, window.location.origin);
    return decodeURIComponent(u.pathname.split('/').pop() || 'arquivo');
  } catch {
    return url.split('/').pop() || 'arquivo';
  }
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
  suppressReadReceipt,
}: MessageBubbleProps) {
  const senderCls = isSender ? 'message-bubble--sender' : 'message-bubble--receiver';
  const variant = isSender ? 'sender' : 'receiver';
  const [viewerOpen, setViewerOpen] = useState(false);
  // se o usuário desativou confirmações, o próprio "lida" vira "entregue" na UI
  const shownStatus: MessageStatus | undefined =
    suppressReadReceipt && status === 'read' ? 'delivered' : status;

  const isImage = type === 'image' && fileUrl && !deleted;
  const isAudio = type === 'audio' && fileUrl && !deleted;
  const isFile = type === 'file' && fileUrl && !deleted;

  /* ── Imagem ────────────────────────────────────────────────────────────── */
  if (isImage) {
    return (
      <div className={`message-bubble message-bubble--image ${senderCls}`}>
        <div className="message-bubble__body">
          <button
            type="button"
            className="message-bubble__media-btn"
            onClick={() => setViewerOpen(true)}
            aria-label="Abrir imagem"
          >
            <img
              src={fileUrl}
              alt=""
              className="message-bubble__image"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
          {content?.trim() ? <p className="message-bubble__caption">{content}</p> : null}
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} />
        </div>
        <MediaViewer open={viewerOpen} onClose={() => setViewerOpen(false)} url={fileUrl} kind="image" />
      </div>
    );
  }

  /* ── Áudio ─────────────────────────────────────────────────────────────── */
  if (isAudio) {
    return (
      <div className={`message-bubble ${senderCls}`}>
        <div className="message-bubble__body">
          <AudioPlayer src={fileUrl} variant={variant} />
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} />
        </div>
      </div>
    );
  }

  /* ── Arquivo (PDF / documento) ─────────────────────────────────────────── */
  if (isFile) {
    const pdf = isPdf(fileUrl);
    // prefere o nome original enviado em content; cai para o nome derivado da URL
    const name = (content && content.trim()) || fileNameFromUrl(fileUrl);
    return (
      <div className={`message-bubble ${senderCls}`}>
        <div className="message-bubble__body">
          {pdf ? (
            <button
              type="button"
              className="message-bubble__file"
              onClick={() => setViewerOpen(true)}
              aria-label={`Abrir ${name}`}
            >
              <FileText size={20} strokeWidth={2} />
              <span className="message-bubble__file-name">{name}</span>
            </button>
          ) : (
            <a
              className="message-bubble__file"
              href={fileUrl}
              download={name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={20} strokeWidth={2} />
              <span className="message-bubble__file-name">{name}</span>
            </a>
          )}
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} />
        </div>
        {pdf && (
          <MediaViewer open={viewerOpen} onClose={() => setViewerOpen(false)} url={fileUrl} kind="pdf" name={name} />
        )}
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
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} />
        </div>
      </div>
    </div>
  );
}
