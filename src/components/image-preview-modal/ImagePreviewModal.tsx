import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import './image-preview-modal.css';

interface ImagePreviewModalProps {
  file: File;
  sending?: boolean;
  recipientLabel?: string;
  onCancel: () => void;
  onSend: (caption: string) => void;
}

/**
 * Pré-visualização estilo WhatsApp: mostra a imagem/vídeo escolhido + um campo
 * de legenda; só envia ao confirmar (imagem + texto juntos). Sem prompt prévio.
 */
export function ImagePreviewModal({
  file,
  sending = false,
  recipientLabel,
  onCancel,
  onSend,
}: ImagePreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const isVideo = file.type.startsWith('video/');

  // Cria e revoga a object URL no MESMO efeito (pareado por execução). Evita o
  // bug do StrictMode (dev), onde um cleanup separado revogava a URL ainda em uso.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="img-preview" role="dialog" aria-modal="true">
      <div className="img-preview__bar">
        <button type="button" className="img-preview__close" onClick={onCancel} aria-label="Cancelar">
          <X size={22} strokeWidth={2.2} />
        </button>
        {recipientLabel ? <span className="img-preview__to">Para: {recipientLabel}</span> : null}
      </div>

      <div className="img-preview__stage">
        {url ? (
          isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video className="img-preview__media" src={url} controls />
          ) : (
            <img className="img-preview__media" src={url} alt="Pré-visualização" />
          )
        ) : null}
      </div>

      <form
        className="img-preview__composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!sending) onSend(caption);
        }}
      >
        <input
          className="img-preview__input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Adicione uma legenda…"
          aria-label="Legenda"
          autoFocus
        />
        <button type="submit" className="img-preview__send" disabled={sending} aria-label="Enviar">
          <Send size={18} strokeWidth={2.4} />
        </button>
      </form>
    </div>,
    document.body,
  );
}
