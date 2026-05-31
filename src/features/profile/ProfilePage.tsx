import {
  Bell,
  Camera,
  Check,
  Fingerprint,
  Info,
  Loader,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/avatar/Avatar';
import { ErrorMessage, LoadingSpinner } from '../../components/feedback/FeedbackComponents';
import { routePaths } from '../../routes/paths';
import { useCurrentUserQuery, useLogout, useUpdateProfileMutation } from '../auth/auth-hooks';
import { useAuth } from '../../lib/auth/use-auth';
import { uploadsApi } from '../../lib/api/endpoints';
import './profile-page.css';

function formatMemberSince(dateValue?: string) {
  if (!dateValue) return '—';

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('pt-BR', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildHandle(name?: string, email?: string) {
  if (name && name.trim()) return `@${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
  if (email && email.includes('@')) return `@${email.split('@')[0].toLowerCase()}`;
  return '@leaf_user';
}

export function ProfilePage() {
  const { data: user, isLoading } = useCurrentUserQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const logout = useLogout();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleLogout = () => {
    logout();
    navigate(routePaths.login, { replace: true });
  };

  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [searchableDraft, setSearchableDraft] = useState(true);
  const [encryptionDraft, setEncryptionDraft] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const currentDisplayName = user?.display_name || user?.name || '';
  const currentBio = user?.bio || '';
  const currentSearchable = user?.searchable ?? true;

  useEffect(() => {
    if (!user || initialized) return;

    setDisplayNameDraft(currentDisplayName);
    setBioDraft(currentBio);
    setSearchableDraft(currentSearchable);
    setInitialized(true);
  }, [currentBio, currentDisplayName, currentSearchable, initialized, user]);

  const hasChanges = useMemo(() => {
    return (
      displayNameDraft !== currentDisplayName ||
      bioDraft !== currentBio ||
      searchableDraft !== currentSearchable
    );
  }, [bioDraft, currentBio, currentDisplayName, currentSearchable, displayNameDraft, searchableDraft]);

  const handleDiscardDraft = () => {
    setDisplayNameDraft(currentDisplayName);
    setBioDraft(currentBio);
    setSearchableDraft(currentSearchable);
    setEncryptionDraft(false);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await uploadsApi.avatar(form, accessToken);
      await updateProfileMutation.mutateAsync({ avatar: url });
    } catch {
      setAvatarError('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveChanges = async () => {
    if (!hasChanges) return;

    await updateProfileMutation.mutateAsync({
      display_name: displayNameDraft.trim(),
      bio: bioDraft.trim(),
      searchable: searchableDraft,
    });
  };

  if (isLoading) {
    return (
      <div className="profile-page profile-page--status">
        <LoadingSpinner message="Carregando perfil…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page profile-page--status">
        <ErrorMessage error="Não foi possível carregar o perfil." />
      </div>
    );
  }

  const initials = (user.name || 'L')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = formatMemberSince(user.created_at);
  const handle = buildHandle(user.display_name || user.name, user.email);

  return (
    <div className="profile-page">
      <header className="profile-page__topbar">
        <h1>Leaf — Perfil</h1>
        <button
          type="button"
          className="profile-page__notif-btn"
          aria-label="Notificações"
          onClick={() => alert('Notificações em breve.')}
        >
          <Bell size={18} strokeWidth={2} />
        </button>
      </header>

      <div className="profile-page__layout">
        <section className="profile-page__left-column" aria-label="Resumo do perfil">
          <article className="profile-card">
            <div className="profile-card__top-accent" />

            <div className="profile-card__avatar-wrap">
              <Avatar src={user.avatar} initials={initials} size="lg" />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                className="profile-card__camera-btn"
                aria-label="Alterar foto de perfil"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? <Loader size={14} className="spin" /> : <Camera size={14} strokeWidth={2.4} />}
              </button>
              {avatarError ? (
                <p className="profile-card__avatar-error">{avatarError}</p>
              ) : null}
            </div>

            <h2>{displayNameDraft || user.display_name || user.name}</h2>
            <p>{handle}</p>
          </article>

          <article className="overview-card">
            <h3>
              <Info size={15} strokeWidth={2.2} />
              Visão geral da conta
            </h3>

            <div className="overview-card__row">
              <span>Membro desde</span>
              <strong>{memberSince}</strong>
            </div>
          </article>

          <button type="button" className="logout-card" onClick={handleLogout}>
            <span className="logout-card__icon" aria-hidden="true">
              <LogOut size={18} strokeWidth={2.2} />
            </span>
            <span className="logout-card__text">
              <strong>Sair</strong>
              <small>Encerrar esta sessão neste dispositivo</small>
            </span>
          </button>
        </section>

        <section className="profile-page__right-column" aria-label="Configurações do perfil">
          <div className="section-title">
            <Fingerprint size={22} strokeWidth={2.2} />
            <h2>Dados de identidade</h2>
          </div>

          <article className="panel-card">
            <label className="panel-field" htmlFor="profile-display-name">
              <span>Nome de exibição</span>
              <input
                id="profile-display-name"
                type="text"
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                maxLength={80}
              />
            </label>

            <label className="panel-field" htmlFor="profile-bio">
              <span>Bio</span>
              <textarea
                id="profile-bio"
                value={bioDraft}
                onChange={(event) => setBioDraft(event.target.value)}
                rows={4}
                maxLength={240}
              />
            </label>
          </article>

          <div className="section-title section-title--spaced">
            <ShieldCheck size={22} strokeWidth={2.2} />
            <h2>Privacidade e segurança</h2>
          </div>

          <article className="toggle-card">
            <div>
              <h3>Visibilidade na busca</h3>
              <p>Permita que outras pessoas encontrem seu perfil por e-mail ou nome de usuário.</p>
            </div>
            <button
              type="button"
              className={`switch ${searchableDraft ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={searchableDraft}
              onClick={() => setSearchableDraft((current) => !current)}
            >
              <span />
            </button>
          </article>

          <article className="toggle-card toggle-card--soon">
            <div>
              <h3>Criptografia E2E <span className="toggle-card__badge">Em breve</span></h3>
              <p>
                Criptografia ponta a ponta entre dispositivos. Disponível em versão futura do Leaf.
              </p>
            </div>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={false}
              disabled
              title="Indisponível nesta versão"
            >
              <span />
            </button>
          </article>

          <div className="profile-page__actions-row">
            <button
              type="button"
              className="cta-btn cta-btn--primary"
              onClick={handleSaveChanges}
              disabled={!hasChanges || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader size={14} className="spin" /> Salvando…
                </>
              ) : (
                <>
                  Salvar alterações <Check size={14} />
                </>
              )}
            </button>

            <button
              type="button"
              className="cta-btn cta-btn--secondary"
              onClick={handleDiscardDraft}
              disabled={!hasChanges || updateProfileMutation.isPending}
            >
              Descartar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}