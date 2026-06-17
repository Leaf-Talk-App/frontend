import { useRef, useState } from 'react';
import { Captions, CaptionsOff, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import './dictation-button.css';

interface DictationButtonProps {
  /** texto atual no campo — a transcrição é anexada a ele */
  currentText: string;
  /** recebe o texto completo (base + transcrição) para escrever no campo */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: number;
  className?: string;
  /** rótulo acessível (varia: "Ditar mensagem" / "Falar com o Humberto") */
  label?: string;
  /** "captions" (texto, padrão) ou "mic" (fala — mais claro p/ o Humberto) */
  icon?: 'captions' | 'mic';
  /** segurar para falar (push-to-talk): grava enquanto pressiona, para ao soltar */
  hold?: boolean;
}

/**
 * Ditado por voz → texto no campo (NÃO envia sozinho). O usuário fala, vê a
 * transcrição aparecer no campo e revisa antes de mandar. Reutilizado no
 * composer das conversas, dos grupos e do Humberto. Só Chrome/Edge.
 */
export function DictationButton({
  currentText,
  onTranscript,
  disabled,
  size = 18,
  className = 'message-composer__icon',
  label = 'Ditar mensagem por voz',
  icon = 'captions',
  hold = false,
}: DictationButtonProps) {
  const baseRef = useRef('');
  const heldRef = useRef(false);
  const [error, setError] = useState(false);

  const merge = (transcript: string) => {
    const base = baseRef.current.trimEnd();
    return (base ? base + ' ' : '') + transcript;
  };

  const speech = useSpeechRecognition({
    lang: 'pt-BR',
    onInterim: (t) => onTranscript(merge(t)),
    onFinal: (t) => onTranscript(merge(t)), // fica no campo; NÃO envia
    onError: () => setError(true),
  });

  if (!speech.supported) return null;

  const listening = speech.state === 'listening';

  // ── Segurar para falar (push-to-talk) ──────────────────────────────────────
  if (hold) {
    const begin = () => {
      if (heldRef.current || disabled) return;
      heldRef.current = true;
      baseRef.current = currentText;
      setError(false);
      speech.start({ hold: true });
    };
    const end = () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      speech.stop();
    };
    const holdLabel = listening ? 'Gravando… solte para enviar' : 'Segure para falar';
    return (
      <button
        type="button"
        className={`${className}${listening ? ' dictation--on' : ''}${error ? ' dictation--error' : ''}`}
        aria-label={holdLabel}
        aria-pressed={listening}
        title={holdLabel}
        disabled={disabled}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); begin(); }}
        onPointerUp={(e) => { e.preventDefault(); end(); }}
        onPointerLeave={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
      >
        {icon === 'mic' ? (
          listening ? <MicOff size={size} strokeWidth={2.2} /> : <Mic size={size} strokeWidth={2.2} />
        ) : listening ? (
          <CaptionsOff size={size} strokeWidth={2.2} />
        ) : (
          <Captions size={size} strokeWidth={2.2} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${className}${listening ? ' dictation--on' : ''}${error ? ' dictation--error' : ''}`}
      aria-label={listening ? 'Parar ditado' : label}
      aria-pressed={listening}
      title={listening ? 'Parar ditado' : label}
      disabled={disabled}
      onClick={() => {
        if (listening) {
          speech.stop();
        } else {
          baseRef.current = currentText; // preserva o que já foi digitado
          setError(false);
          speech.start();
        }
      }}
    >
      {icon === 'mic' ? (
        listening ? (
          <MicOff size={size} strokeWidth={2.2} />
        ) : (
          <Mic size={size} strokeWidth={2.2} />
        )
      ) : listening ? (
        <CaptionsOff size={size} strokeWidth={2.2} />
      ) : (
        <Captions size={size} strokeWidth={2.2} />
      )}
    </button>
  );
}
