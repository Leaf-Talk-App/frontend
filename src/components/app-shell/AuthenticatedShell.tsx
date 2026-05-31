import {
  Bot,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  Sprout,
  UserRound,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { routePaths } from '../../routes/paths';
import './authenticated-shell.css';

// Suporte via WhatsApp (+55 34 99338-8856) com mensagem padrão.
const HELP_WHATSAPP_URL =
  'https://wa.me/5534993388856?text=' +
  encodeURIComponent('Olá, preciso de ajuda com o Leaf.');

function openHelp() {
  window.open(HELP_WHATSAPP_URL, '_blank', 'noopener,noreferrer');
}

const primaryNavItems = [
  {
    label: 'Conversas',
    to: routePaths.chats,
    icon: MessageSquare,
  },
  {
    label: 'Humberto',
    to: routePaths.assistant,
    icon: Bot,
  },
  {
    label: 'Buscar',
    to: routePaths.search,
    icon: Search,
  },
  {
    label: 'Perfil',
    to: routePaths.profile,
    icon: UserRound,
  },
];

const mobileNavItems = [
  {
    label: 'Conversas',
    to: routePaths.chats,
    icon: MessageSquare,
  },
  {
    label: 'Buscar',
    to: routePaths.search,
    icon: Search,
  },
  {
    label: 'Humberto',
    to: routePaths.assistant,
    icon: Bot,
  },
  {
    label: 'Perfil',
    to: routePaths.profile,
    icon: UserRound,
  },
];

export function AuthenticatedShell() {
  return (
    <div className="authenticated-shell">
      <DesktopSidebar />
      <main className="authenticated-shell__main">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

function DesktopSidebar() {
  const navigate = useNavigate();
  return (
    <aside className="desktop-sidebar" aria-label="Navegação principal">
      <div className="desktop-sidebar__brand">
        <span className="desktop-sidebar__brand-mark" aria-hidden="true">
          <Sprout size={22} strokeWidth={2.4} />
        </span>
        <span>
          <strong>Leaf</strong>
          <small>CONNECTED LIVING</small>
        </span>
      </div>

      <button
        className="desktop-sidebar__new-chat"
        type="button"
        onClick={() => navigate(routePaths.search)}
      >
        <Plus size={14} aria-hidden="true" />
        Nova conversa
      </button>

      <nav className="desktop-sidebar__nav" aria-label="Área de trabalho">
        {primaryNavItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <button className="desktop-sidebar__support" type="button" onClick={openHelp}>
        <HelpCircle size={20} aria-hidden="true" />
        Ajuda e suporte
      </button>
    </aside>
  );
}

function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-bottom-nav__link${isActive ? ' mobile-bottom-nav__link--active' : ''}`
            }
          >
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function NavItem({ label, to, icon: Icon }: (typeof primaryNavItems)[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `desktop-sidebar__link${isActive ? ' desktop-sidebar__link--active' : ''}`
      }
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}
