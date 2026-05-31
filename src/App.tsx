import './styles/global.css';
import { AppProviders } from './app/AppProviders';
import { AppRouter } from './routes/AppRouter';
import { ThemeToggle } from './components/theme-toggle/ThemeToggle';

export function App() {
  return (
    <AppProviders>
      <ThemeToggle />
      <AppRouter />
    </AppProviders>
  );
}
