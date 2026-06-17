import { useEffect, useState } from 'react';

/** Confete simples (sem libs): gera N pedacinhos com posição/cor/atraso
 *  aleatórios e some sozinho após ~4s. Renderiza só quando `fire` é true. */
export function Confetti({ fire, pieces = 80 }: { fire: boolean; pieces?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!fire) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 4200);
    return () => window.clearTimeout(t);
  }, [fire]);

  if (!show) return null;

  const colors = ['#79C52B', '#8EDC38', '#F5F1E6', '#4b760f', '#c5e08a'];

  return (
    <div className="quiz-confetti" aria-hidden="true">
      {Array.from({ length: pieces }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.6 + Math.random() * 1.4;
        const size = 6 + Math.random() * 8;
        const color = colors[i % colors.length];
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            className="quiz-confetti__piece"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 0.5}px`,
              background: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotate}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}
