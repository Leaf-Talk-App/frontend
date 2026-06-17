import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Copy, Forward, Lock, LogOut, Mic, MoreVertical, Paperclip, Reply, Send, Settings2, Sprout, Star, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from '../../components/avatar/Avatar';
import { MediaViewer } from '../../components/media-viewer/MediaViewer';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import { DictationButton } from '../../components/dictation/DictationButton';
import { HumbertoMentionHint, mentionsHumberto } from '../../components/humberto/HumbertoMentionHint';
import { MentionSuggest, applyMention } from '../../components/mention/MentionSuggest';
import { ImagePreviewModal } from '../../components/image-preview-modal/ImagePreviewModal';
import { usersApi, uploadsApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useLongPress } from '../../hooks/useLongPress';
import { useWebSocket } from '../chats/useWebSocket';
import { ForwardModal } from '../chats/ForwardModal';
import {
  useGroupMessagesQuery,
  useGroupQuery,
  useGroupMessageActions,
  useLeaveGroupMutation,
  useRemoveMemberMutation,
  useSendGroupMessageMutation,
} from './groups-hooks';
import { AddMemberModal } from './AddMemberModal';
import { GroupSettingsModal } from './GroupSettingsModal';
import { UserProfileModal } from '../../components/user-profile/UserProfileModal';
import type { GroupMessage, LeafMessage, LeafUser, MessageType } from '../../lib/api/contracts';
import '../chats/chat-window-page.css';
import './groups.css';

function initialsOf(name: string): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, accessToken } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroupQuery(groupId);
  const {
    data: messages,
    isLoading: messagesLoading,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlder,
  } = useGroupMessagesQuery(groupId);
  const sendMutation = useSendGroupMessageMutation(groupId);
  const leaveMutation = useLeaveGroupMutation();

  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const removeMemberMutation = useRemoveMemberMutation(groupId);
  const [copied, setCopied] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [forwarding, setForwarding] = useState<LeafMessage | null>(null);
  const msgActions = useGroupMessageActions(groupId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const atBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  const isAdmin = Boolean(currentUser && group?.admins?.includes(currentUser.id));

  // Resolve nomes de TODOS os autores (membros atuais + quem já saiu) para o
  // nome nunca virar "Membro". Ex-membros são sinalizados (cinza) via memberSet.
  const memberIds = group?.members ?? [];
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
  const authorIds = useMemo(() => {
    const s = new Set<string>(memberIds);
    (messages ?? []).forEach((m) => {
      if (m.sender_id && m.sender_id !== 'system' && m.sender_id !== 'humberto') {
        s.add(m.sender_id);
      }
    });
    return Array.from(s);
  }, [memberIds, messages]);
  const memberQueries = useQueries({
    queries: authorIds.map((id) => ({
      queryKey: ['users', 'id', id],
      queryFn: () => usersApi.getById(id, { token: accessToken! }),
      enabled: Boolean(accessToken) && id !== currentUser?.id,
      staleTime: 5 * 60_000,
    })),
  });
  const nameById = useMemo(() => {
    const map: Record<string, string> = { humberto: 'Humberto' };
    authorIds.forEach((id, i) => {
      const u = memberQueries[i]?.data as LeafUser | undefined;
      if (u) map[id] = u.display_name || u.name || '';
    });
    return map;
  }, [authorIds, memberQueries]);

  // Nomes para o autocomplete de @menção (Humberto + membros, menos você).
  const mentionNames = useMemo(() => {
    const names = ['Humberto'];
    memberIds.forEach((id) => {
      if (id === currentUser?.id || id === 'humberto') return;
      const n = nameById[id];
      if (n) names.push(n);
    });
    return names;
  }, [memberIds, nameById, currentUser?.id]);

  // WS: novas mensagens do grupo → invalida o histórico (refetch).
  const handleWs = useCallback(
    (data: any) => {
      if (!groupId || data?.group_id !== groupId) return;
      if (data?.type === 'group_message' || data?.type === 'group_message_deleted') {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
      } else if (data?.type === 'group_updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.byId(groupId) });
      }
    },
    [groupId, queryClient],
  );
  useWebSocket({ userId: currentUser?.id, enabled: Boolean(currentUser?.id), onMessage: handleWs });

  // Removido/saiu do grupo → o detalhe vem null (não é mais membro) → sai da
  // tela e volta às conversas (o grupo some da lista no próximo refetch).
  useEffect(() => {
    if (groupId && !groupLoading && group === null) {
      navigate(routePaths.chats);
    }
  }, [group, groupLoading, groupId, navigate]);

  // Posiciona no FIM antes da pintura (sem "puxão" do topo). Rola o container,
  // reposiciona após imagens carregarem, e reseta por groupId (componente
  // reusado entre grupos). Igual à conversa 1:1.
  const scrolledGroupRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!messages?.length) return;
    const el = messagesContainerRef.current;
    if (!el) return;

    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    if (scrolledGroupRef.current !== groupId) {
      toBottom();
      scrolledGroupRef.current = groupId;
      atBottomRef.current = true;
      requestAnimationFrame(toBottom);
      const t = window.setTimeout(toBottom, 220);
      const onMediaLoad = () => { if (atBottomRef.current) el.scrollTop = el.scrollHeight; };
      el.addEventListener('load', onMediaLoad, true);
      const stop = window.setTimeout(() => el.removeEventListener('load', onMediaLoad, true), 1500);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(stop);
        el.removeEventListener('load', onMediaLoad, true);
      };
    }

    if (atBottomRef.current) toBottom();
  }, [messages, groupId, sendMutation.isPending]);

  // Teclado: o fim da conversa acompanha o teclado (visualViewport encolhe).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (!atBottomRef.current) return;
      const el = messagesContainerRef.current;
      if (!el) return;
      const toBottom = () => { el.scrollTop = el.scrollHeight; };
      toBottom();
      requestAnimationFrame(toBottom);
      window.setTimeout(toBottom, 120);
      window.setTimeout(toBottom, 320);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !groupId || sendMutation.isPending || !canSend) return;
    sendMutation.mutate({ group_id: groupId, content, reply_to: replyingTo?._id ?? null });
    setInput('');
    setReplyingTo(null);
  };

  // Anexo: imagem → pré-visualização com legenda; outros → envia direto.
  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type.startsWith('image/')) setPendingImage(file);
    else void uploadAndSend(file, 'file');
  };

  const uploadAndSend = async (file: File, kind: 'image' | 'file', caption = '') => {
    if (!accessToken || !groupId || uploading) return;
    setUploading(true);
    try {
      let url: string;
      if (kind === 'image') {
        const form = new FormData();
        form.append('file', file);
        ({ url } = await uploadsApi.image(form, accessToken));
      } else {
        ({ url } = await uploadsApi.file(file, accessToken));
      }
      sendMutation.mutate({
        group_id: groupId,
        content: kind === 'image' ? caption : file.name,
        type: kind as MessageType,
        file_url: url,
      });
      setPendingImage(null);
    } catch {
      /* falha de upload — ignora (usuário pode tentar de novo) */
    } finally {
      setUploading(false);
    }
  };

  const handleRecordToggle = async () => {
    if (recorder.state === 'recording') {
      const blob = await recorder.stop();
      if (!blob || !accessToken || !groupId) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', blob, 'audio.webm');
        const { url } = await uploadsApi.audio(form, accessToken);
        sendMutation.mutate({ group_id: groupId, content: '', type: 'audio', file_url: url });
      } catch {
        /* ignora */
      } finally {
        setUploading(false);
      }
    } else {
      await recorder.start();
    }
  };

  const handleCopyInvite = async () => {
    if (!group?.invite_code) return;
    try {
      await navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  const handleLeave = () => {
    if (!groupId) return;
    leaveMutation.mutate(groupId, {
      onSuccess: () => navigate(routePaths.groups),
    });
  };

  if (!currentUser) return null;

  const groupName = group?.name ?? (groupLoading ? '' : 'Grupo');
  const memberCount = group?.member_count ?? memberIds.length;
  // ex-membro (removido/saiu mas ainda vê o histórico): só-leitura
  const isMember = Boolean(group && currentUser && group.members?.includes(currentUser.id));
  const removed = Boolean(group) && !isMember;
  const canSend = isMember && (isAdmin || !group?.only_admins_can_send);

  return (
    <div className="chat-window-page">
      <header className="chat-window-page__header">
        <button
          className="chat-window-page__back"
          type="button"
          aria-label="Voltar para grupos"
          onClick={() => navigate(routePaths.groups)}
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>

        <div className="chat-window-page__user-info">
          <button
            type="button"
            className="chat-modal__avatar-btn"
            onClick={() => group?.photo && setPhotoViewer(true)}
            aria-label={group?.photo ? 'Ver foto do grupo' : 'Grupo sem foto'}
            disabled={!group?.photo}
          >
            <Avatar src={group?.photo ?? undefined} initials={initialsOf(groupName || 'G')} size="sm" />
          </button>
          <div className="chat-window-page__user-meta">
            <h2 className="chat-window-page__name">
              {groupLoading ? <span className="chat-window-page__name-skeleton" /> : groupName}
            </h2>
            <p className="chat-window-page__status">
              {memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}` : ''}
              {group?.only_admins_can_send ? ' · só admins enviam' : ''}
            </p>
            {group?.description ? (
              <p className="group-header__desc" title={group.description}>{group.description}</p>
            ) : null}
          </div>
        </div>

        <div className="group-menu">
          <button
            type="button"
            className="group-menu__trigger"
            aria-label="Opções do grupo"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={18} strokeWidth={2.2} />
          </button>
          {menuOpen && (
            <>
              <div className="group-menu__backdrop" onClick={() => setMenuOpen(false)} />
              <div className="group-menu__sheet" role="menu">
                <button
                  type="button"
                  className="group-menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowMembers(true);
                  }}
                >
                  <Users size={15} strokeWidth={2.2} /> Membros ({memberCount})
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="group-menu__item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowSettings(true);
                    }}
                  >
                    <Settings2 size={15} strokeWidth={2.2} /> Editar grupo
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="group-menu__item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowAddMember(true);
                    }}
                  >
                    <UserPlus size={15} strokeWidth={2.2} /> Adicionar membro
                  </button>
                )}
                {group?.invite_code && (
                  <button
                    type="button"
                    className="group-menu__item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowInvite(true);
                    }}
                  >
                    <Copy size={15} strokeWidth={2.2} /> Código de convite
                  </button>
                )}
                <button
                  type="button"
                  className="group-menu__item group-menu__item--danger"
                  onClick={handleLeave}
                  disabled={leaveMutation.isPending}
                >
                  <LogOut size={15} strokeWidth={2.2} />
                  {leaveMutation.isPending ? 'Saindo…' : 'Sair do grupo'}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main
        ref={messagesContainerRef}
        className="chat-window-page__messages"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasOlderMessages && !messagesLoading && (
          <div className="chat-window-page__load-more">
            <button
              type="button"
              className="chat-window-page__load-more-btn"
              onClick={() => fetchOlderMessages()}
              disabled={isFetchingOlder}
            >
              {isFetchingOlder ? 'Carregando…' : '↑ Carregar mensagens antigas'}
            </button>
          </div>
        )}

        {messagesLoading ? (
          <div className="chat-window-page__status-block">
            <p>Carregando mensagens…</p>
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="chat-window-page__empty">
            <h3>Nenhuma mensagem ainda</h3>
            <p>Seja o primeiro a falar no grupo 👋</p>
          </div>
        ) : (
          messages.map((m) =>
            m.type === 'system' ? (
              <div key={m._id} className="chat-window-page__divider" role="separator">
                <span className="group-system-msg">{m.content}</span>
              </div>
            ) : (
              <GroupMessageRow
                key={m._id}
                message={m}
                isOwn={m.sender_id === currentUser.id}
                authorName={
                  nameById[m.sender_id] ||
                  (m.sender_id === 'humberto' ? 'Humberto' : 'Membro')
                }
                authorLeft={m.sender_id !== 'humberto' && !memberSet.has(m.sender_id)}
                onOpenProfile={
                  m.sender_id !== 'humberto' && m.sender_id !== currentUser.id
                    ? () => setProfileId(m.sender_id)
                    : undefined
                }
                nameById={nameById}
                currentUserId={currentUser.id}
                canDeleteForEveryone={m.sender_id === currentUser.id || isAdmin}
                onReply={() => setReplyingTo(m)}
                onForward={() => setForwarding(toLeafMessage(m))}
                onToggleFavorite={() => msgActions.favorite.mutate(m._id)}
                onDeleteForMe={() => msgActions.deleteForMe.mutate(m._id)}
                onDeleteForEveryone={() => msgActions.deleteForEveryone.mutate(m._id)}
              />
            ),
          )
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-window-page__composer-wrap">
        {removed ? (
          <div className="group-readonly">
            <Lock size={15} strokeWidth={2.2} aria-hidden="true" />
            Você não está mais neste grupo. Apague a conversa quando quiser (menu ⋮ → Sair do grupo).
          </div>
        ) : !canSend ? (
          <div className="group-readonly">
            <Lock size={15} strokeWidth={2.2} aria-hidden="true" />
            Somente administradores podem enviar mensagens neste grupo.
          </div>
        ) : (
        <>
        {replyingTo && (
          <div className="chat-window-page__reply-bar">
            <div className="chat-window-page__reply-bar-body">
              <span className="chat-window-page__reply-bar-author">
                {replyingTo.sender_id === currentUser.id
                  ? 'Você'
                  : nameById[replyingTo.sender_id] ||
                    (replyingTo.sender_id === 'humberto' ? 'Humberto' : 'Membro')}
              </span>
              <span className="chat-window-page__reply-bar-text">
                {(replyingTo.content || '').trim() ||
                  (replyingTo.type === 'image'
                    ? '📷 Foto'
                    : replyingTo.type === 'audio'
                    ? '🎤 Áudio'
                    : '📄 Arquivo')}
              </span>
            </div>
            <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyingTo(null)}>
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}
        <MentionSuggest
          text={input}
          names={mentionNames}
          onPick={(name) => setInput((m) => applyMention(m, name))}
        />
        <HumbertoMentionHint active={mentionsHumberto(input)} />
        <form className="group-composer" onSubmit={handleSend}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            style={{ display: 'none' }}
            onChange={handleAttach}
          />
          <button
            type="button"
            className="group-composer__icon"
            aria-label="Anexar arquivo"
            title="Anexar arquivo"
            disabled={uploading || recorder.state === 'recording'}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} strokeWidth={2.2} />
          </button>

          {recorder.state === 'recording' ? (
            <span className="group-composer__rec">● {recorder.duration}s</span>
          ) : (
            <>
              <button
                type="button"
                className={`group-composer__icon${mentionsHumberto(input) ? ' group-composer__icon--active' : ''}`}
                aria-label="Marcar o Humberto"
                title="Marcar o Humberto (ele responde aqui)"
                disabled={uploading}
                onClick={() =>
                  setInput((m) => (mentionsHumberto(m) ? m : `@Humberto ${m}`.trimEnd() + ' '))
                }
              >
                <Sprout size={18} strokeWidth={2.2} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Mensagem…"
                className="group-composer__input"
                aria-label="Mensagem para o grupo"
              />
              <DictationButton
                currentText={input}
                onTranscript={setInput}
                disabled={uploading}
                className="group-composer__icon"
              />
            </>
          )}

          {input.trim() ? (
            <button
              type="submit"
              className="group-composer__send"
              aria-label="Enviar"
              disabled={sendMutation.isPending}
            >
              <Send size={18} strokeWidth={2.4} />
            </button>
          ) : (
            <button
              type="button"
              className={`group-composer__send${recorder.state === 'recording' ? ' group-composer__send--rec' : ''}`}
              aria-label={recorder.state === 'recording' ? 'Parar e enviar áudio' : 'Gravar áudio'}
              title={recorder.state === 'recording' ? 'Parar e enviar áudio' : 'Gravar áudio'}
              disabled={uploading}
              onClick={handleRecordToggle}
            >
              {recorder.state === 'recording' ? (
                <Send size={18} strokeWidth={2.4} />
              ) : (
                <Mic size={18} strokeWidth={2.4} />
              )}
            </button>
          )}
        </form>
        </>
        )}
      </footer>

      {showInvite && group?.invite_code && (
        <div className="chat-modal" role="dialog" aria-modal="true" onClick={() => setShowInvite(false)}>
          <div className="chat-modal__card create-group" onClick={(e) => e.stopPropagation()}>
            <button className="chat-modal__close" onClick={() => setShowInvite(false)} aria-label="Fechar">
              <X size={20} strokeWidth={2.2} />
            </button>
            <h3 className="chat-modal__name">Código de convite</h3>
            <p className="group-invite__hint">
              Compartilhe este código para alguém entrar no grupo:
            </p>
            <div className="group-invite__code">
              <code>{group.invite_code}</code>
              <button type="button" onClick={handleCopyInvite} aria-label="Copiar código">
                <Copy size={16} strokeWidth={2.2} /> {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && groupId && (
        <AddMemberModal
          groupId={groupId}
          currentMembers={memberIds}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {showSettings && group && (
        <GroupSettingsModal
          group={group}
          nameById={nameById}
          currentUserId={currentUser.id}
          onClose={() => setShowSettings(false)}
        />
      )}

      {photoViewer && group?.photo ? (
        <MediaViewer open onClose={() => setPhotoViewer(false)} url={group.photo} kind="image" name={groupName} />
      ) : null}

      {showMembers && group && (
        <div className="chat-modal" role="dialog" aria-modal="true" onClick={() => setShowMembers(false)}>
          <div className="chat-modal__card" onClick={(e) => e.stopPropagation()}>
            <button className="chat-modal__close" onClick={() => setShowMembers(false)} aria-label="Fechar">
              <X size={20} strokeWidth={2.2} />
            </button>
            <h3 className="chat-modal__name">
              <Users size={18} strokeWidth={2.2} aria-hidden="true" /> Membros ({memberCount})
            </h3>
            <ul className="group-members__list">
              {memberIds.map((id) => {
                const isMe = id === currentUser.id;
                const isCreator = id === group.created_by;
                const isMemberAdmin = group.admins?.includes(id);
                const label = isMe ? 'Você' : nameById[id] || 'Membro';
                return (
                  <li key={id} className="group-members__item">
                    <button
                      type="button"
                      className="group-members__open"
                      disabled={isMe || id === 'humberto'}
                      onClick={() => { setShowMembers(false); setProfileId(id); }}
                    >
                      <Avatar initials={(label[0] || '?').toUpperCase()} size="sm" />
                      <span className="group-members__name">
                        {label}
                        {isCreator ? ' · criador' : isMemberAdmin ? ' · admin' : ''}
                      </span>
                    </button>
                    {isAdmin && !isMe && !isCreator && (
                      <button
                        type="button"
                        className="group-members__remove"
                        disabled={removeMemberMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Remover ${label} do grupo?`)) {
                            removeMemberMutation.mutate(id);
                          }
                        }}
                      >
                        <UserMinus size={14} strokeWidth={2.2} /> Remover
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {isAdmin && (
              <button
                type="button"
                className="create-group__submit"
                onClick={() => { setShowMembers(false); setShowAddMember(true); }}
              >
                <UserPlus size={15} strokeWidth={2.2} /> Adicionar membro
              </button>
            )}
          </div>
        </div>
      )}

      {pendingImage && (
        <ImagePreviewModal
          file={pendingImage}
          sending={uploading}
          recipientLabel={groupName || 'grupo'}
          onCancel={() => setPendingImage(null)}
          onSend={(caption) => uploadAndSend(pendingImage, 'image', caption)}
        />
      )}

      {forwarding && (
        <ForwardModal message={forwarding} onClose={() => setForwarding(null)} />
      )}

      {profileId && (
        <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  );
}

/** Converte uma mensagem de grupo no formato esperado pelo ForwardModal. */
function toLeafMessage(m: GroupMessage): LeafMessage {
  return {
    _id: m._id,
    chat_id: '',
    sender_id: m.sender_id,
    receiver_id: '',
    content: m.content,
    type: (m.type === 'system' ? 'text' : m.type) ?? 'text',
    file_url: m.file_url ?? null,
    read: false,
  } as LeafMessage;
}

interface GroupMessageRowProps {
  message: GroupMessage;
  isOwn: boolean;
  authorName: string;
  authorLeft?: boolean;
  onOpenProfile?: () => void;
  nameById: Record<string, string>;
  currentUserId: string;
  canDeleteForEveryone: boolean;
  onReply: () => void;
  onForward: () => void;
  onToggleFavorite: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

function GroupMessageRow({
  message,
  isOwn,
  authorName,
  authorLeft,
  onOpenProfile,
  nameById,
  currentUserId,
  canDeleteForEveryone,
  onReply,
  onForward,
  onToggleFavorite,
  onDeleteForMe,
  onDeleteForEveryone,
}: GroupMessageRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPress = useLongPress(() => setMenuOpen(true));

  const isOptimistic = message._id.startsWith('optimistic-');
  const canOpenMenu = !isOptimistic && !message.deleted;

  const rp = message.reply_preview;
  const replyAuthor = rp
    ? rp.sender_id === currentUserId
      ? 'Você'
      : nameById[rp.sender_id] || (rp.sender_id === 'humberto' ? 'Humberto' : 'Membro')
    : undefined;
  const replyText = rp
    ? (rp.content || '').trim() ||
      (rp.type === 'image' ? '📷 Foto' : rp.type === 'audio' ? '🎤 Áudio' : '📄 Arquivo')
    : undefined;

  return (
    <div className={`group-msg-row${isOwn ? ' group-msg-row--own' : ''}`}>
      {!isOwn && (
        onOpenProfile ? (
          <button
            type="button"
            className={`group-msg-row__author group-msg-row__author--btn${authorLeft ? ' group-msg-row__author--left' : ''}`}
            onClick={onOpenProfile}
          >
            {authorName}{authorLeft ? ' · saiu' : ''}
          </button>
        ) : (
          <span className={`group-msg-row__author${authorLeft ? ' group-msg-row__author--left' : ''}`}>
            {authorName}{authorLeft ? ' · saiu' : ''}
          </span>
        )
      )}
      <div className="message-row__wrap" {...(canOpenMenu ? longPress : {})}>
        <MessageBubble
          content={message.content}
          type={message.type === 'system' ? 'text' : message.type ?? 'text'}
          fileUrl={message.file_url}
          isSender={isOwn}
          timestamp={formatTime(message.created_at)}
          status={isOwn ? 'sent' : undefined}
          deleted={message.deleted}
          favorited={message.favorited}
          replyAuthor={replyAuthor}
          replyText={replyText}
          markdown={message.sender_id === 'humberto'}
        />

        {canOpenMenu && (
          <div className="message-row__menu-wrap">
            <button
              type="button"
              className="message-row__menu-btn"
              aria-label="Opções da mensagem"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <ChevronDown size={16} strokeWidth={2.4} />
            </button>
            {menuOpen && (
              <>
                <div className="message-row__backdrop" onClick={() => setMenuOpen(false)} />
                <div className="message-row__menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReply(); }}>
                    <Reply size={15} strokeWidth={2} /> Responder
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onForward(); }}>
                    <Forward size={15} strokeWidth={2} /> Encaminhar
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onToggleFavorite(); }}>
                    <Star size={15} strokeWidth={2} /> {message.favorited ? 'Desfavoritar' : 'Favoritar'}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDeleteForMe(); }}>
                    <Trash2 size={15} strokeWidth={2} /> Apagar para mim
                  </button>
                  {canDeleteForEveryone && (
                    <button
                      type="button"
                      role="menuitem"
                      className="message-row__menu-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm('Apagar esta mensagem para todos?')) onDeleteForEveryone();
                      }}
                    >
                      <Trash2 size={15} strokeWidth={2} /> Apagar para todos
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
