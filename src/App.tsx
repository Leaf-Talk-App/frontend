import { useEffect } from 'react';
import './styles/global.css';
import { AppProviders } from './app/AppProviders';
import { AppRouter } from './routes/AppRouter';
import { ThemeToggle } from './components/theme-toggle/ThemeToggle';

/**
 * Mantém --app-height = altura REAL visível (VisualViewport). No mobile, quando
 * o teclado abre, o visualViewport encolhe → as telas de chat usam essa var e o
 * composer fica colado acima do teclado (sem o vão) e nada estoura a tela.
 */
function useAppHeightVar() {
  useEffect(() => {
    const vv = window.visualViewport;
    const set = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
    };
    set();
    vv?.addEventListener('resize', set);
    vv?.addEventListener('scroll', set);
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      vv?.removeEventListener('resize', set);
      vv?.removeEventListener('scroll', set);
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
}

export function App() {
  useAppHeightVar();
  return (
    <AppProviders>
      <ThemeToggle />
      <AppRouter />
    </AppProviders>
  );
}
