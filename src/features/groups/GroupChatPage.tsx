import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, LogOut, Mic, Paperclip, Send, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from '../../components/avatar/Avatar';
import { MessageBubble } from '../../components/message-bubble/MessageBubble';
import { ImagePreviewModal } from '../../components/image-preview-modal/ImagePreviewModal';
import { usersApi, uploadsApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/api/query-keys';
import { routePaths } from '../../routes/paths';
import { useAuth } from '../../lib/auth/use-auth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useWebSocket } from '../chats/useWebSocket';
import {
  useGroupMessagesQuery,
  useGroupQuery,
  useLeaveGroupMutation,
  useSendGroupMessageMutation,
} from './groups-hooks';
import { AddMemberModal } from './AddMemberModal';
import type { LeafUser, MessageType } from '../../lib/api/contracts';
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
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  const isAdmin = Boolean(currentUser && group?.admins?.includes(currentUser.id));

  // Resolve nomes dos membros para exibir o autor de cada mensagem recebida.
  const memberIds = group?.members ?? [];
  const memberQueries = useQueries({
    queries: memberIds.map((id) => ({
      queryKey: ['users', 'id', id],
      queryFn: () => usersApi.getById(id, { token: accessToken! }),
      enabled: Boolean(accessToken) && id !== currentUser?.id,
      staleTime: 5 * 60_000,
    })),
  });
  const nameById = useMemo(() => {
    const map: Record<string, string> = { humberto: 'Humberto' };
    memberIds.forEach((id, i) => {
      const u = memberQueries[i]?.data as LeafUser | undefined;
      if (u) map[id] = u.display_name || u.name || '';
    });
    return map;
  }, [memberIds, memberQueries]);

  // WS: novas mensagens do grupo → invalida o histórico (refetch).
  const handleWs = useCallback(
    (data: any) => {
      if (data?.type === 'group_message' && data.group_id === groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine });
      }
    },
    [groupId, queryClient],
  );
  useWebSocket({ userId: currentUser?.id, enabled: Boolean(currentUser?.id), onMessage: handleWs });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMutation.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !groupId || sendMutation.isPending) return;
    sendMutation.mutate({ group_id: groupId, content });
    setInput('');
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
          <Avatar src={group?.photo ?? undefined} initials={initialsOf(groupName || 'G')} size="sm" />
          <div className="chat-window-page__user-meta">
            <h2 className="chat-window-page__name">
              {groupLoading ? <span className="chat-window-page__name-skeleton" /> : groupName}
            </h2>
            <p className="chat-window-page__status">
              {memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'membro' : 'membros'}` : ''}
            </p>
          </div>
        </div>

        <div className="group-menu">
          <button
            type="button"
            className="group-menu__trigger"
            aria-label="Opções do grupo"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Users size={18} strokeWidth={2.2} />
          </button>
          {menuOpen && (
            <>
              <div className="group-menu__backdrop" onClick={() => setMenuOpen(false)} />
              <div className="group-menu__sheet" role="menu">
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

      <main className="chat-window-page__messages" aria-live="polite">
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
          messages.map((m) => {
            const isOwn = m.sender_id === currentUser.id;
            const author = nameById[m.sender_id] || 'Membro';
            return (
              <div key={m._id} className={`group-msg-row${isOwn ? ' group-msg-row--own' : ''}`}>
                {!isOwn && <span className="group-msg-row__author">{author}</span>}
                <MessageBubble
                  content={m.content}
                  type={m.type ?? 'text'}
                  fileUrl={m.file_url}
                  isSender={isOwn}
                  timestamp={formatTime(m.created_at)}
                  status={isOwn ? 'sent' : undefined}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-window-page__composer-wrap">
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mensagem… (chame a IA com @Humberto)"
              className="group-composer__input"
              aria-label="Mensagem para o grupo"
            />
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
        <small className="chat-window-page__footnote">CRIPTOGRAFIA ATIVA · POWERED BY LEAF 1.4</small>
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

      {pendingImage && (
        <ImagePreviewModal
          file={pendingImage}
          sending={uploading}
          recipientLabel={groupName || 'grupo'}
          onCancel={() => setPendingImage(null)}
          onSend={(caption) => uploadAndSend(pendingImage, 'image', caption)}
        />
      )}
    </div>
  );
}
