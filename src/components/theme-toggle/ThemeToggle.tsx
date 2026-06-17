import { Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import './theme-toggle.css';

/**
 * Botão flutuante de alternância de tema (sol/lua).
 * Fica fixo no canto superior direito, visível em todas as telas — EXCETO o
 * Quiz, que tem identidade visual própria (verde sobre fundo escuro) e não
 * acompanha o tema do app (o botão só confundia, parecendo não funcionar).
 */
export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  const { pathname } = useLocation();

  if (pathname.startsWith('/quiz')) return null;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? <Sun size={18} strokeWidth={2.2} /> : <Moon size={18} strokeWidth={2.2} />}
    </button>
  );
}
