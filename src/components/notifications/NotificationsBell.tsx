import { useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatsQuery } from '../../features/chats/chats-hooks';
import type { LeafChatSummary } from '../../lib/api/contracts';
import './notifications-bell.css';

function titleOf(c: LeafChatSummary): string {
  if (c.kind === 'group') return c.name || 'Grupo';
  return c.other_user?.display_name || c.other_user?.name || 'Conversa';
}

function previewOf(c: LeafChatSummary): string {
  const m = c.last_message;
  if (!m) return 'Nova mensagem';
  if (m.content?.trim()) return m.content;
  return m.type === 'image' ? '📷 Foto' : m.type === 'audio' ? '🎤 Áudio' : m.type === 'file' ? '📄 Arquivo' : 'Mensagem';
}

/** Sino de notificações: lista as conversas com mensagens não lidas e suas
 *  prévias; clicar abre a conversa. Usa os dados que já temos (sem push). */
export function NotificationsBell() {
  const navigate = useNavigate();
  const { data: chats } = useChatsQuery();
  const [open, setOpen] = useState(false);

  const unread = useMemo(
    () => (chats ?? []).filter((c) => (c.unread_count ?? 0) > 0),
    [chats],
  );
  const total = unread.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  const go = (c: LeafChatSummary) => {
    setOpen(false);
    navigate(c.kind === 'group' ? `/groups/${c._id}` : `/chats/${c._id}`);
  };

  return (
    <div className="notif">
      <button
        type="button"
        className="profile-page__notif-btn"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={2} />
        {total > 0 && <span className="notif__dot">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <>
          <div className="notif__backdrop" onClick={() => setOpen(false)} />
          <div className="notif__panel" role="menu">
            <div className="notif__head">
              <strong>Notificações</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>
            {unread.length === 0 ? (
              <p className="notif__empty">Nenhuma mensagem nova.</p>
            ) : (
              <ul className="notif__list">
                {unread.map((c) => (
                  <li key={c._id}>
                    <button type="button" className="notif__item" onClick={() => go(c)}>
                      <span className="notif__item-title">{titleOf(c)}</span>
                      <span className="notif__item-preview">{previewOf(c)}</span>
                      <span className="notif__item-badge">{c.unread_count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
