import { useState } from 'react';
import { Bot } from 'lucide-react';

/**
 * Avatar do Humberto. Usa a imagem em /humberto.png (coloque o arquivo do
 * Humberto em frontend/public/humberto.png). Se a imagem faltar, cai num
 * ícone verde — assim a UI nunca quebra.
 */
interface Props {
  size?: number;
  className?: string;
}

export function HumbertoAvatar({ size = 40, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #5d8d22, #87b047)',
          color: '#fff',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <Bot size={Math.round(size * 0.55)} strokeWidth={2.2} />
      </span>
    );
  }

  return (
    <img
      src="/humberto.png"
      alt="Humberto"
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        background: '#eef2e6',
      }}
    />
  );
}
