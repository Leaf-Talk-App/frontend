import { useCallback, useRef } from 'react';

interface Options {
  delay?: number;
  /** chamado no toque curto (clique normal), se fornecido */
  onClick?: () => void;
}

/**
 * Detecta toque longo (long-press) no mobile e clique-direito no desktop para
 * abrir menus de contexto — estilo WhatsApp/Instagram. Retorna handlers para
 * espalhar no elemento. Quando o long-press dispara, o clique normal seguinte
 * é suprimido para não navegar/abrir a conversa por engano.
 */
export function useLongPress(onLongPress: () => void, { delay = 450, onClick }: Options = {}) {
  const timer = useRef<number | undefined>(undefined);
  const firedRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const start = useCallback(
    (x: number, y: number) => {
      firedRef.current = false;
      startPos.current = { x, y };
      timer.current = window.setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      // cancela se o dedo deslizou (rolagem) > 10px
      const t = e.touches[0];
      const p = startPos.current;
      if (p && (Math.abs(t.clientX - p.x) > 10 || Math.abs(t.clientY - p.y) > 10)) clear();
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      // clique-direito no desktop abre o mesmo menu
      e.preventDefault();
      firedRef.current = true;
      onLongPress();
    },
    onClick: () => {
      if (firedRef.current) {
        firedRef.current = false;
        return; // long-press já tratou → ignora o clique
      }
      onClick?.();
    },
  };
}
