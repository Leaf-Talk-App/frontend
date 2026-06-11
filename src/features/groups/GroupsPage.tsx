import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Avatar } from '../../components/avatar/Avatar';
import { Button } from '../../components/button/Button';
import { parseServerDate } from '../../lib/date';
import { useGroupsQuery } from './groups-hooks';
import { CreateGroupModal } from './CreateGroupModal';
import type { LeafGroup } from '../../lib/api/contracts';
import './groups.css';

function initialsOf(name: string): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(dateString?: string | null): string {
  const date = parseServerDate(dateString ?? undefined);
  if (!date) return '';
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'AGORA';
  if (diffMins < 60) return `HÁ ${diffMins}MIN`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `HÁ ${diffHours}H`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ONTEM';
  if (diffDays < 7) return `HÁ ${diffDays}D`;
  return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).toUpperCase();
}

function GroupItem({ group, onClick }: { group: LeafGroup; onClick: () => void }) {
  const preview = group.last_message?.content?.trim() || 'Nenhuma mensagem ainda';
  const count = group.member_count ?? group.members.length;
  return (
    <button type="button" className="group-item" onClick={onClick}>
      <Avatar src={group.photo ?? undefined} initials={initialsOf(group.name)} size="md" />
      <div className="group-item__content">
        <div className="group-item__header">
          <h3 className="group-item__name">{group.name}</h3>
          <time className="group-item__time">{formatTimestamp(group.last_message?.created_at)}</time>
        </div>
        <p className="group-item__message">{preview}</p>
      </div>
      <span className="group-item__count" aria-label={`${count} membros`}>
        <Users size={12} strokeWidth={2.4} aria-hidden="true" />
        {count}
      </span>
    </button>
  );
}

export function GroupsPage() {
  const navigate = useNavigate();
  const { data: groups, isLoading, error } = useGroupsQuery();
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(
    () => [...(groups ?? [])].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')),
    [groups],
  );

  return (
    <div className="groups-page">
      <aside className="groups-page__list-pane" aria-label="Grupos">
        <header className="groups-page__heading">
          <h1>Grupos</h1>
          <button type="button" className="groups-page__new" onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            Novo grupo
          </button>
        </header>

        {isLoading ? (
          <div className="groups-page__status">
            <p>Carregando grupos…</p>
          </div>
        ) : error ? (
          <div className="groups-page__status groups-page__status--error">
            <p>Não foi possível carregar os grupos.</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Tentar novamente
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="groups-page__status">
            <p className="groups-page__status-title">Nenhum grupo ainda</p>
            <p className="groups-page__status-hint">Crie um grupo para conversar com várias pessoas.</p>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              Criar grupo
            </Button>
          </div>
        ) : (
          <ul className="groups-page__list">
            {sorted.map((g) => (
              <li key={g._id}>
                <GroupItem group={g} onClick={() => navigate(`/groups/${g._id}`)} />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="groups-page__welcome" aria-label="Grupo ativo">
        <div className="groups-page__welcome-card">
          <span className="groups-page__welcome-mark" aria-hidden="true">
            <Users size={28} strokeWidth={2.2} />
          </span>
          <h2>Selecione um grupo</h2>
          <p>Escolha um grupo na lista para ver e enviar mensagens com a comunidade.</p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Novo grupo
          </Button>
        </div>
      </section>

      {creating && (
        <CreateGroupModal
          onClose={() => setCreating(false)}
          onCreated={(groupId) => {
            setCreating(false);
            navigate(`/groups/${groupId}`);
          }}
        />
      )}
    </div>
  );
}
