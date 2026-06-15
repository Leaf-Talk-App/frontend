/**
 * Logo oficial do Leaf — a folha (mesma do favicon). Dois formatos:
 *  - <LeafMark/>  : só a folha em contorno, herda a cor via currentColor
 *                   (serve no claro e no escuro sem perder a identidade).
 *  - <LeafBadge/> : o "ícone do app" — quadrado verde arredondado + folha
 *                   branca (igual ao print de marca).
 * A estrutura da folha é preservada do arquivo de marca (não é redesenhada).
 */

interface MarkProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function LeafMark({ size = 24, className, strokeWidth = 2 }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 7C24 16 18.5 21 11 20.5 11 20.5 9.5 8.5 24 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M9 24C11 17.5 14.5 14 20 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface BadgeProps {
  size?: number;
  className?: string;
  /** raio do quadrado (px no espaço do ícone) */
  radius?: number;
}

export function LeafBadge({ size = 40, className, radius = 9 }: BadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx={radius} fill="#5d8d22" />
      <path
        d="M24 7C24 16 18.5 21 11 20.5 11 20.5 9.5 8.5 24 7Z"
        fill="#ffffff"
      />
      <path
        d="M9 24C11 17.5 14.5 14 20 12.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
