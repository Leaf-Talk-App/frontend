import {
  Ban,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../../components/avatar/Avatar';
import { ErrorMessage, LoadingSpinner } from '../../components/feedback/FeedbackComponents';
import { routePaths } from '../../routes/paths';
import { useCurrentUserQuery, useLogout, useUpdateProfileMutation } from '../auth/auth-hooks';
import { useAuth } from '../../lib/auth/use-auth';
import { uploadsApi, usersApi } from '../../lib/api/endpoints';
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

// Máscara BR: (DD) NNNNN-NNNN. Só armazena/exibe — sem verificação por SMS.
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const d = value.replace(/\D/g, '');
  return d.length === 10 || d.length === 11; // fixo (10) ou celular (11)
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate(routePaths.login, { replace: true });
  };

  // Contatos bloqueados — lista + desbloqueio (recuperação de bloqueio acidental)
  const queryClient = useQueryClient();
  const blockedQuery = useQuery({
    queryKey: ['users', 'blocked'],
    queryFn: () => usersApi.blocked({ token: accessToken! }),
    enabled: Boolean(accessToken),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => usersApi.unblock(userId, { token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'blocked'] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [searchableDraft, setSearchableDraft] = useState(true);
  const [readReceiptsDraft, setReadReceiptsDraft] = useState(true);
  const [encryptionDraft, setEncryptionDraft] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const currentDisplayName = user?.display_name || user?.name || '';
  const currentBio = user?.bio || '';
  const currentPhone = user?.phone || '';
  const currentSearchable = user?.searchable ?? true;
  const currentReadReceipts = user?.show_read_receipts ?? true;

  useEffect(() => {
    if (!user || initialized) return;

    setDisplayNameDraft(currentDisplayName);
    setBioDraft(currentBio);
    setPhoneDraft(currentPhone);
    setSearchableDraft(currentSearchable);
    setReadReceiptsDraft(currentReadReceipts);
    setInitialized(true);
  }, [currentBio, currentDisplayName, currentPhone, currentSearchable, currentReadReceipts, initialized, user]);

  // Limpa o preview assim que a query sincronizar com a URL nova —
  // evita o "pisca" de volta para a foto antiga
  useEffect(() => {
    if (avatarPreview && user?.avatar && user.avatar === avatarPreview) {
      setAvatarPreview(null);
    }
  }, [user?.avatar, avatarPreview]);

  const phoneValid = phoneDraft.trim() === '' || isValidPhone(phoneDraft);

  const hasChanges = useMemo(() => {
    return (
      displayNameDraft !== currentDisplayName ||
      bioDraft !== currentBio ||
      phoneDraft !== currentPhone ||
      searchableDraft !== currentSearchable ||
      readReceiptsDraft !== currentReadReceipts
    );
  }, [bioDraft, currentBio, currentDisplayName, currentPhone, currentSearchable, currentReadReceipts, displayNameDraft, phoneDraft, searchableDraft, readReceiptsDraft]);

  const handleDiscardDraft = () => {
    setDisplayNameDraft(currentDisplayName);
    setBioDraft(currentBio);
    setPhoneDraft(currentPhone);
    setSearchableDraft(currentSearchable);
    setReadReceiptsDraft(currentReadReceipts);
    setEncryptionDraft(false);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setAvatarError('');

    // Preview local imediato
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarUploading(true);
    const inputEl = event.target;

    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await uploadsApi.avatar(form, accessToken);
      // Atualiza preview para URL final ANTES de invalidar cache —
      // elimina o "flash" entre preview local → sem foto → URL nova
      setAvatarPreview(url);
      await updateProfileMutation.mutateAsync({ avatar: url });
      // Mantém avatarPreview = url até a query re-renderizar com o novo valor.
      // O useEffect abaixo limpa quando user.avatar sincronizar.
    } catch {
      setAvatarError('Não foi possível enviar a foto. Tente novamente.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      inputEl.value = '';
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleSaveChanges = async () => {
    if (!hasChanges || !phoneValid) return;

    await updateProfileMutation.mutateAsync({
      display_name: displayNameDraft.trim(),
      bio: bioDraft.trim(),
      phone: phoneDraft.trim(),
      searchable: searchableDraft,
      show_read_receipts: readReceiptsDraft,
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
              <Avatar src={avatarPreview ?? user.avatar} initials={initials} size="lg" />
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

            <label className="panel-field" htmlFor="profile-phone">
              <span>Telefone (opcional)</span>
              <input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(maskPhone(event.target.value))}
                placeholder="(11) 99999-9999"
              />
              {!phoneValid ? (
                <small style={{ color: 'var(--leaf-color-danger, #c9171d)', fontSize: 12 }}>
                  Telefone inválido — use DDD + número.
                </small>
              ) : null}
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

          <article className="toggle-card">
            <div>
              <h3>Confirmações de leitura</h3>
              <p>Permite que outros vejam quando você leu as mensagens.</p>
            </div>
            <button
              type="button"
              className={`switch ${readReceiptsDraft ? 'switch--on' : ''}`}
              role="switch"
              aria-checked={readReceiptsDraft}
              onClick={() => setReadReceiptsDraft((current) => !current)}
            >
              <span />
            </button>
          </article>

          <article className="panel-card blocked-card">
            <h3 className="blocked-card__title">
              <Ban size={16} strokeWidth={2.2} />
              Contatos bloqueados
            </h3>
            {blockedQuery.isLoading ? (
              <p className="blocked-card__empty">Carregando…</p>
            ) : !blockedQuery.data || blockedQuery.data.length === 0 ? (
              <p className="blocked-card__empty">Você não bloqueou ninguém.</p>
            ) : (
              <ul className="blocked-card__list">
                {blockedQuery.data.map((blockedUser) => (
                  <li key={blockedUser._id} className="blocked-card__row">
                    <Avatar
                      src={blockedUser.avatar}
                      initials={(blockedUser.display_name || blockedUser.name || '?').charAt(0).toUpperCase()}
                      size="sm"
                    />
                    <div className="blocked-card__info">
                      <strong>{blockedUser.display_name || blockedUser.name}</strong>
                      <small>{blockedUser.email}</small>
                    </div>
                    <button
                      type="button"
                      className="blocked-card__unblock"
                      disabled={unblockMutation.isPending}
                      onClick={() => unblockMutation.mutate(blockedUser._id)}
                    >
                      Desbloquear
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <div className="profile-page__actions-row">
            <button
              type="button"
              className="cta-btn cta-btn--primary"
              onClick={handleSaveChanges}
              disabled={!hasChanges || !phoneValid || updateProfileMutation.isPending}
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