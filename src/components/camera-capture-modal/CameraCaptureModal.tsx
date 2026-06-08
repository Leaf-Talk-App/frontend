import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, X } from 'lucide-react';
import './camera-capture-modal.css';

interface CameraCaptureModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Câmera ao vivo via getUserMedia — funciona no desktop (onde `<input capture>`
 * é ignorado pelo browser e abre a galeria) e também no mobile (facingMode).
 * Tira o frame do <video> para um <canvas> e devolve um File JPEG.
 */
export function CameraCaptureModal({ onCapture, onClose }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (active) {
          setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        }
      }
    })();

    return () => {
      active = false;
      stop();
    };
  }, [facing, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleShoot = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // espelha a foto da câmera frontal para ficar natural
    if (facing === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stop();
        onCapture(file);
      },
      'image/jpeg',
      0.9,
    );
  };

  return createPortal(
    <div className="camera-modal" role="dialog" aria-modal="true">
      <div className="camera-modal__bar">
        <button type="button" className="camera-modal__icon" onClick={onClose} aria-label="Fechar">
          <X size={22} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="camera-modal__icon"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="Alternar câmera"
        >
          <RefreshCw size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="camera-modal__stage">
        {error ? (
          <p className="camera-modal__error">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className={`camera-modal__video${facing === 'user' ? ' camera-modal__video--mirror' : ''}`}
            autoPlay
            playsInline
            muted
          />
        )}
      </div>

      <div className="camera-modal__controls">
        <button
          type="button"
          className="camera-modal__shutter"
          onClick={handleShoot}
          disabled={!ready || Boolean(error)}
          aria-label="Tirar foto"
        >
          <Camera size={26} strokeWidth={2.2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
