import { useState } from 'react';
import './message-bubble.css';
import type { MessageStatus, MessageType } from '../../lib/api/contracts';
import { Check, CheckCheck, FileText, Star } from 'lucide-react';
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
  /** citação (resposta): autor e texto da mensagem original */
  replyAuthor?: string;
  replyText?: string;
  /** favoritada pelo usuário atual → mostra ★ no rodapé */
  favorited?: boolean;
}

/** Bloco de citação exibido no topo do balão quando a mensagem é uma resposta. */
function ReplyQuote({ author, text }: { author?: string; text?: string }) {
  if (!author && !text) return null;
  return (
    <div className="message-bubble__reply">
      {author ? <span className="message-bubble__reply-author">{author}</span> : null}
      <span className="message-bubble__reply-text">{text}</span>
    </div>
  );
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
  favorited,
}: Pick<MessageBubbleProps, 'timestamp' | 'status' | 'edited' | 'isSender' | 'favorited'>) {
  return (
    <div className="message-bubble__footer">
      {favorited && (
        <Star size={11} strokeWidth={2.2} className="message-bubble__star" aria-label="Favoritada" />
      )}
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

/**
 * Baixa o arquivo preservando o nome/extensão originais. O atributo `download`
 * de um <a> é ignorado em links cross-origin (Cloudinary), então buscamos os
 * bytes e geramos um blob local — assim o arquivo volta no formato certo.
 */
async function downloadFile(url: string, name: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = name || 'arquivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    // fallback: abre em nova aba se o fetch falhar (CORS / offline)
    window.open(url, '_blank', 'noopener,noreferrer');
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
  replyAuthor,
  replyText,
  favorited,
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
          <ReplyQuote author={replyAuthor} text={replyText} />
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
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} favorited={favorited} />
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
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} favorited={favorited} />
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
            <button
              type="button"
              className="message-bubble__file"
              onClick={() => fileUrl && downloadFile(fileUrl, name)}
              aria-label={`Baixar ${name}`}
            >
              <FileText size={20} strokeWidth={2} />
              <span className="message-bubble__file-name">{name}</span>
            </button>
          )}
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} favorited={favorited} />
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
          {!deleted && <ReplyQuote author={replyAuthor} text={replyText} />}
          {deleted ? (
            <p className="message-bubble__deleted">Mensagem apagada</p>
          ) : (
            <p className="message-bubble__text">{content}</p>
          )}
          <Footer timestamp={timestamp} status={shownStatus} edited={edited} isSender={isSender} favorited={favorited} />
        </div>
      </div>
    </div>
  );
}
