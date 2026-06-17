import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Crown, Loader, Lock, Settings2, ShieldCheck, X } from 'lucide-react';
import { Avatar } from '../../components/avatar/Avatar';
import { MediaViewer } from '../../components/media-viewer/MediaViewer';
import { useSetAdminMutation, useUpdateGroupMutation } from './groups-hooks';
import { useAuth } from '../../lib/auth/use-auth';
import { uploadsApi } from '../../lib/api/endpoints';
import type { LeafGroup } from '../../lib/api/contracts';
import './groups.css';

interface GroupSettingsModalProps {
  group: LeafGroup;
  nameById: Record<string, string>;
  currentUserId: string;
  onClose: () => void;
}

/** Editar grupo (apenas admin): renomear, descrição, regra de envio e
 *  gestão de administradores (promover/rebaixar membros). */
export function GroupSettingsModal({ group, nameById, currentUserId, onClose }: GroupSettingsModalProps) {
  const update = useUpdateGroupMutation(group._id);
  const setAdmin = useSetAdminMutation(group._id);
  const { accessToken } = useAuth();

  const [name, setName] = useState(group.name ?? '');
  const [description, setDescription] = useState(group.description ?? '');
  const [onlyAdmins, setOnlyAdmins] = useState(Boolean(group.only_admins_can_send));
  const [photo, setPhoto] = useState(group.photo ?? '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const admins = new Set(group.admins ?? []);
  const createdBy = group.created_by;
  const isAdmin = admins.has(currentUserId);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !accessToken) return;
    setError('');
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await uploadsApi.avatar(form, accessToken);
      setPhoto(url);
      // salva já a foto (sem precisar clicar em SALVAR)
      await update.mutateAsync({ photo: url });
    } catch {
      setError('Não foi possível enviar a foto. Tente uma imagem menor (até 5 MB).');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('O nome do grupo é obrigatório.');
      return;
    }
    setError('');
    try {
      await update.mutateAsync({
        name: trimmed,
        description: description.trim(),
        only_admins_can_send: onlyAdmins,
      });
      setSaved(true);
      window.setTimeout(onClose, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setError('');
    try {
      await setAdmin.mutateAsync({ user_id: userId, make_admin: makeAdmin });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar a permissão.');
    }
  };

  return createPortal(
    <div className="chat-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chat-modal__card group-settings" onClick={(e) => e.stopPropagation()}>
        <button className="chat-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2.2} />
        </button>
        <h3 className="chat-modal__name">
          <Settings2 size={18} strokeWidth={2.2} aria-hidden="true" /> Editar grupo
        </h3>

        <div className="group-settings__photo">
          <button
            type="button"
            className="group-settings__photo-btn"
            onClick={() => (photo ? setViewerOpen(true) : isAdmin && photoInputRef.current?.click())}
            aria-label={photo ? 'Ver foto do grupo' : 'Adicionar foto do grupo'}
          >
            <Avatar src={photo || undefined} initials={(name[0] || 'G').toUpperCase()} size="lg" />
          </button>
          {isAdmin ? (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                className="group-settings__photo-edit"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                aria-label="Trocar foto do grupo"
              >
                {photoUploading ? <Loader size={14} className="spin" /> : <Camera size={14} strokeWidth={2.4} />}
              </button>
            </>
          ) : null}
        </div>

        <label className="group-settings__label" htmlFor="grp-name">Nome</label>
        <input
          id="grp-name"
          className="group-settings__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Nome do grupo"
        />

        <label className="group-settings__label" htmlFor="grp-desc">Descrição</label>
        <textarea
          id="grp-desc"
          className="group-settings__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Sobre o que é este grupo?"
        />

        <button
          type="button"
          className={`group-settings__rule${onlyAdmins ? ' group-settings__rule--on' : ''}`}
          aria-pressed={onlyAdmins}
          onClick={() => setOnlyAdmins((v) => !v)}
        >
          <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
          <span className="group-settings__rule-text">
            <strong>Somente administradores enviam mensagens</strong>
            <small>Membros comuns só conseguem ler.</small>
          </span>
          <span className={`group-settings__switch${onlyAdmins ? ' group-settings__switch--on' : ''}`} aria-hidden="true">
            <span className="group-settings__knob" />
          </span>
        </button>

        <div className="group-settings__admins">
          <h4 className="group-settings__subtitle">
            <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" /> Administradores
          </h4>
          <ul className="group-settings__members">
            {(group.members ?? []).map((id) => {
              const isAdmin = admins.has(id);
              const isCreator = id === createdBy;
              const label =
                id === currentUserId ? 'Você' : nameById[id] || (id === 'humberto' ? 'Humberto' : 'Membro');
              return (
                <li key={id} className="group-settings__member">
                  <Avatar initials={(label[0] || '?').toUpperCase()} size="sm" />
                  <span className="group-settings__member-name">
                    {label}
                    {isCreator && <Crown size={13} strokeWidth={2.4} className="group-settings__crown" aria-label="Criador" />}
                  </span>
                  {isCreator ? (
                    <span className="group-settings__tag">Criador</span>
                  ) : isAdmin ? (
                    <button
                      type="button"
                      className="group-settings__demote"
                      disabled={setAdmin.isPending}
                      onClick={() => toggleAdmin(id, false)}
                    >
                      Remover admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="group-settings__promote"
                      disabled={setAdmin.isPending}
                      onClick={() => toggleAdmin(id, true)}
                    >
                      Tornar admin
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p className="group-settings__error">{error}</p>}

        <button
          type="button"
          className="create-group__submit"
          disabled={update.isPending || saved}
          onClick={handleSave}
        >
          {saved ? 'SALVO' : update.isPending ? 'SALVANDO…' : 'SALVAR'}
        </button>
      </div>

      {viewerOpen && photo ? (
        <MediaViewer open onClose={() => setViewerOpen(false)} url={photo} kind="image" name={name} />
      ) : null}
    </div>,
    document.body,
  );
}
