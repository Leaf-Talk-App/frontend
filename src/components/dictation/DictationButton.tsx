import { useEffect, useRef, useState } from 'react';
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
  /** segurar para falar (push-to-talk): grava enquanto pressiona; deslize ↑ trava */
  hold?: boolean;
  /** o pai recebe um `stop()` para parar a gravação (ex.: ao enviar a mensagem) */
  controlRef?: React.MutableRefObject<{ stop: () => void } | null>;
}

/**
 * Ditado por voz → texto no campo (NÃO envia sozinho). O usuário fala, vê a
 * transcrição aparecer no campo e revisa antes de mandar. Reutilizado no
 * composer das conversas, dos grupos e do Humberto. Só Chrome/Edge.
 *
 * Modo `hold` (estilo WhatsApp/Telegram): segura para gravar; deslize para cima
 * para TRAVAR (continua gravando após soltar); travado, toque para parar. O pai
 * pode parar a qualquer momento via `controlRef` (ex.: ao enviar).
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
  controlRef,
}: DictationButtonProps) {
  const baseRef = useRef('');
  const heldRef = useRef(false);
  const lockedRef = useRef(false);
  const startYRef = useRef(0);
  const [hint, setHint] = useState<'idle' | 'hold' | 'locked'>('idle');
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

  // stop atual sempre acessível ao pai (parar ao enviar) sem recriar o efeito
  const stopRef = useRef<() => void>(() => {});
  stopRef.current = () => {
    heldRef.current = false;
    lockedRef.current = false;
    setHint('idle');
    speech.stop();
  };
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { stop: () => stopRef.current() };
    return () => { controlRef.current = null; };
  }, [controlRef]);

  if (!speech.supported) return null;

  const listening = speech.state === 'listening';

  const MicGlyph = ({ on }: { on: boolean }) =>
    icon === 'mic'
      ? (on ? <MicOff size={size} strokeWidth={2.2} /> : <Mic size={size} strokeWidth={2.2} />)
      : (on ? <CaptionsOff size={size} strokeWidth={2.2} /> : <Captions size={size} strokeWidth={2.2} />);

  // ── Segurar para falar (push-to-talk) + deslize ↑ para travar ──────────────
  if (hold) {
    const begin = (e: React.PointerEvent) => {
      if (disabled) return;
      // travado → um toque PARA (não inicia outra gravação)
      if (lockedRef.current) { stopRef.current(); return; }
      if (heldRef.current) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ }
      heldRef.current = true;
      lockedRef.current = false;
      startYRef.current = e.clientY;
      baseRef.current = currentText;
      setError(false);
      setHint('hold');
      speech.start({ hold: true });
    };
    const move = (e: React.PointerEvent) => {
      if (!heldRef.current || lockedRef.current) return;
      if (startYRef.current - e.clientY > 50) {
        lockedRef.current = true;
        setHint('locked');
      }
    };
    const up = () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      if (lockedRef.current) return; // travado → continua gravando até enviar/tocar
      setHint('idle');
      speech.stop();
    };

    const holdLabel = lockedRef.current
      ? 'Gravando travado — toque para parar'
      : listening
        ? 'Gravando… solte para parar (deslize ↑ para travar)'
        : 'Segure para falar';

    return (
      <span className="dictation-hold">
        {hint !== 'idle' ? (
          <span className="dictation-hold__hint">
            {hint === 'locked' ? '🔒 toque para parar' : 'deslize ↑ para travar'}
          </span>
        ) : null}
        <button
          type="button"
          className={`${className}${listening ? ' dictation--on' : ''}${error ? ' dictation--error' : ''}`}
          aria-label={holdLabel}
          aria-pressed={listening}
          title={holdLabel}
          disabled={disabled}
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => { e.preventDefault(); begin(e); }}
          onPointerMove={move}
          onPointerUp={(e) => { e.preventDefault(); up(); }}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MicGlyph on={listening} />
        </button>
      </span>
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
      <MicGlyph on={listening} />
    </button>
  );
}
