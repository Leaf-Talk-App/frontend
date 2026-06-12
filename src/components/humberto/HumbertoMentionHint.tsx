import { Sprout } from 'lucide-react';
import './humberto-mention.css';

/** true se o texto menciona @Humberto (mesma regra do backend). */
export function mentionsHumberto(text: string): boolean {
  return /@humberto\b/i.test(text || '');
}

/**
 * Chip visível acima do composer quando o usuário menciona @Humberto —
 * confirma que a marcação foi reconhecida e que ele vai responder ali.
 */
export function HumbertoMentionHint({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="humberto-hint" role="status">
      <span className="humberto-hint__mark" aria-hidden="true">
        <Sprout size={13} strokeWidth={2.4} />
      </span>
      Você está marcando o <strong>Humberto</strong> — ele responde aqui na conversa.
    </div>
  );
}
