import {
  Bot,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  Sprout,
  UserRound,
} from 'lucide-react';
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { useWebSocket } from '../../features/chats/useWebSocket';
import { useChatsQuery } from '../../features/chats/chats-hooks';
import './authenticated-shell.css';

// Badge da sidebar = QUANTAS CONVERSAS têm ao menos 1 não lida (não a soma de
// mensagens). O contador por mensagem fica no badge de cada item da lista.
function useUnreadConversationsCount(): number {
  const { data: chats } = useChatsQuery();
  return (chats ?? []).filter((c) => (c.unread_count ?? 0) > 0).length;
}

// Suporte via WhatsApp do Alan (+55 34 9338-8856). Apenas dígitos, com DDI/DDD.
const ALAN_WHATSAPP = '553493388856';

function openHelp() {
  const text = encodeURIComponent('Olá Alan, preciso de ajuda com o Leaf.');
  window.open(`https://wa.me/${ALAN_WHATSAPP}?text=${text}`, '_blank', 'noopener,noreferrer');
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

/**
 * Conexão WebSocket única e global enquanto o usuário está logado.
 * Mantém o status `online` correto no backend (antes só conectava com um chat
 * aberto) e recebe os eventos de presença/novas mensagens em qualquer tela.
 */
function GlobalPresence() {
  const { user } = useAuth();
  useWebSocket({ userId: user?.id, enabled: Boolean(user?.id) });
  return null;
}

// Rotas "imersivas" (tela cheia com composer no rodapé): a barra inferior fixa
// do mobile tampava os botões do composer. Some nessas telas — o botão Voltar
// já cobre a navegação.
const IMMERSIVE_ROUTES = [routePaths.chat, routePaths.group];

function useIsImmersive(): boolean {
  const { pathname } = useLocation();
  return IMMERSIVE_ROUTES.some((p) => matchPath(p, pathname) !== null);
}

export function AuthenticatedShell() {
  const immersive = useIsImmersive();
  return (
    <div className="authenticated-shell">
      <GlobalPresence />
      <DesktopSidebar />
      <main className={`authenticated-shell__main${immersive ? ' authenticated-shell__main--immersive' : ''}`}>
        <Outlet />
      </main>
      {!immersive && <MobileBottomNav />}
    </div>
  );
}

function DesktopSidebar() {
  const navigate = useNavigate();
  const unreadChats = useUnreadConversationsCount();
  return (
    <aside className="desktop-sidebar" aria-label="Navegação principal">
      <div className="desktop-sidebar__brand">
        <span className="desktop-sidebar__brand-mark" aria-hidden="true">
          <Sprout size={22} strokeWidth={2.4} />
        </span>
        <span>
          <strong>Leaf</strong>
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
          <NavItem
            key={item.to}
            {...item}
            badge={item.to === routePaths.chats ? unreadChats : 0}
          />
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
  const unreadChats = useUnreadConversationsCount();
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const showBadge = item.to === routePaths.chats && unreadChats > 0;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-bottom-nav__link${isActive ? ' mobile-bottom-nav__link--active' : ''}`
            }
          >
            <span className="mobile-bottom-nav__icon-wrap">
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
              {showBadge ? (
                <span className="mobile-bottom-nav__badge">{unreadChats > 99 ? '99+' : unreadChats}</span>
              ) : null}
            </span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function NavItem({
  label,
  to,
  icon: Icon,
  badge = 0,
}: (typeof primaryNavItems)[number] & { badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `desktop-sidebar__link${isActive ? ' desktop-sidebar__link--active' : ''}`
      }
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
      {badge > 0 ? (
        <span className="desktop-sidebar__badge">{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </NavLink>
  );
}
