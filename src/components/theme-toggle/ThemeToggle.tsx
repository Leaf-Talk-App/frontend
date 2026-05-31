import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import './theme-toggle.css';

/**
 * Botão flutuante de alternância de tema (sol/lua).
 * Fica fixo no canto superior direito, visível em todas as telas.
 */
export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

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
