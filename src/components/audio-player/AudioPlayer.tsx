import { useCallback, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import './audio-player.css';

interface AudioPlayerProps {
  src: string;
  variant?: 'sender' | 'receiver';
}

const BAR_COUNT = 36;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Alturas de barra determinísticas a partir do src (hash djb2 + LCG).
 * Mesma URL → mesmo waveform, sem precisar decodificar o áudio (Web Audio).
 */
function seededBars(seed: string, n: number): number[] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  let x = h || 1;
  const bars: number[] = [];
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    bars.push(0.28 + (x % 1000) / 1000 * 0.72); // 0.28..1.0
  }
  return bars;
}

/**
 * Player de áudio com identidade Leaf (verde): play/pause, waveform simulado
 * (barras que ficam verdes conforme o áudio toca) e tempo. Clique no waveform
 * faz seek. Substitui o <audio controls> nativo.
 */
export function AudioPlayer({ src, variant = 'receiver' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const fixingRef = useRef(false); // durante o hack de duração, ignora timeupdate
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useMemo(() => seededBars(src, BAR_COUNT), [src]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  // webm do MediaRecorder reporta duration=Infinity (ou um valor-lixo enorme)
  // até ser percorrido. Forçamos um seek pro fim p/ o browser recalcular. O
  // flag fixingRef impede que o tempo gigante do seek apareça no visual
  // (era o bug do "331:15"). Duração absurda (>24h) é tratada como desconhecida.
  const SANE_MAX = 86400; // 24h
  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const d = el.duration;
    if (d === Infinity || Number.isNaN(d) || d > SANE_MAX) {
      fixingRef.current = true;
      const fix = () => {
        el.removeEventListener('timeupdate', fix);
        const real = el.duration;
        el.currentTime = 0;
        fixingRef.current = false;
        setCurrent(0);
        setDuration(Number.isFinite(real) && real <= SANE_MAX ? real : 0);
      };
      el.addEventListener('timeupdate', fix);
      el.currentTime = 1e7;
    } else {
      setDuration(d);
    }
  }, []);

  const seekToClientX = (clientX: number) => {
    const el = waveRef.current;
    const a = audioRef.current;
    if (!el || !a || !duration) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = frac * duration;
    setCurrent(frac * duration);
  };

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className={`leaf-audio leaf-audio--${variant}`}>
      <button
        type="button"
        className="leaf-audio__btn"
        onClick={toggle}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? <Pause size={16} strokeWidth={2.4} /> : <Play size={16} strokeWidth={2.4} />}
      </button>

      <div className="leaf-audio__track">
        <div
          ref={waveRef}
          className="leaf-audio__wave"
          onClick={(e) => seekToClientX(e.clientX)}
          role="slider"
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={`leaf-audio__bar${(i + 0.5) / BAR_COUNT <= progress ? ' is-played' : ''}`}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <span className="leaf-audio__time">{formatTime(current || duration)}</span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          if (fixingRef.current) return; // ignora o seek-hack de duração
          setCurrent(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
    </div>
  );
}
