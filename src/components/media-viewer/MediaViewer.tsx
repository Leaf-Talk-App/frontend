import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import './media-viewer.css';

export type MediaKind = 'image' | 'video' | 'pdf' | 'audio';

interface MediaViewerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  kind: MediaKind;
  name?: string;
}

/**
 * Visualizador de mídia in-app (lightbox). Abre imagens, vídeos, PDFs e áudios
 * dentro do Leaf, sem nova aba/popup externo. Fecha com Esc ou clique no fundo.
 */
export function MediaViewer({ open, onClose, url, kind, name }: MediaViewerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Cloudinary é cross-origin → o atributo `download` é ignorado (abre em aba).
  // Baixa via fetch + blob + clique programático; fallback abre em nova aba.
  const handleDownload = async () => {
    const fallbackName = name || url.split('/').pop()?.split('?')[0] || 'arquivo';
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return createPortal(
    <div className="media-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="media-viewer__bar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="media-viewer__action"
          onClick={handleDownload}
          aria-label="Baixar arquivo"
          title="Baixar"
        >
          <Download size={18} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="media-viewer__action"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar (Esc)"
        >
          <X size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="media-viewer__stage" onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && <img className="media-viewer__img" src={url} alt={name ?? ''} />}
        {kind === 'video' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="media-viewer__video" src={url} controls autoPlay />
        )}
        {kind === 'audio' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio className="media-viewer__audio" src={url} controls autoPlay />
        )}
        {kind === 'pdf' && (
          <iframe className="media-viewer__pdf" src={url} title={name ?? 'Documento PDF'} />
        )}
      </div>
    </div>,
    document.body,
  );
}
