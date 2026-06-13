import {
  Camera,
  Check,
  CircleDashed,
  Lightbulb,
  Plus,
  Send,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ImagePreviewModal } from '../../components/image-preview-modal/ImagePreviewModal';
import { CameraCaptureModal } from '../../components/camera-capture-modal/CameraCaptureModal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/use-auth';
import { DictationButton } from '../../components/dictation/DictationButton';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { aiApi, uploadsApi } from '../../lib/api/endpoints';
import { useAiChatMutation, useAiHistoryQuery, useClearAiHistoryMutation } from './ai-hooks';
import type { AiHistoryMessage } from '../../lib/api/contracts';
import './ai-assistant-page.css';

interface ActionCard {
  task_id?: string;
  type: 'schedule' | 'draft' | 'generic' | 'send';
  title?: string;
  recipient?: string;
  scheduledFor?: string | null;
  body?: string;
  commandTag?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  action?: ActionCard | unknown;
  chips?: { label: string; prompt: string }[];
  attachmentUrl?: string;
  attachmentMime?: string;
}

interface PromptChip {
  label: string;
  prompt: string;
  icon: typeof Lightbulb;
}

const PROMPT_CHIPS: PromptChip[] = [
  {
    label: 'Escrever uma mensagem para um amigo',
    prompt: 'Me ajude a escrever uma mensagem para um amigo.',
    icon: Sparkles,
  },
  {
    label: 'Como ser mais produtivo no dia a dia',
    prompt: 'Como posso ser mais produtivo no dia a dia?',
    icon: TrendingUp,
  },
  {
    label: 'Sugerir um assunto para conversar',
    prompt: 'Me sugira um assunto interessante para iniciar uma conversa.',
    icon: Users,
  },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  content:
    'Olá! Sou o Humberto, seu assistente de IA do Leaf. Posso ajudar a escrever mensagens, dar ideias, melhorar sua produtividade e responder perguntas gerais. Como posso ajudar?',
  isUser: false,
  timestamp: new Date(),
};

function ActionCardBlock({ action }: { action: ActionCard }) {
  const { accessToken } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: () => aiApi.confirm(action.task_id!, { token: accessToken! }),
    onSuccess: () => setConfirmed(true),
    onError: () => setError('Não consegui confirmar agora. Tente de novo.'),
  });

  if (dismissed) return null;

  const isSchedule = action.type === 'schedule';
  const confirmedLabel = isSchedule ? 'Agendado' : 'Enviado';

  return (
    <div className="ai-action-card">
      {action.commandTag ? (
        <span className="ai-action-card__tag">COMANDO VINCULADO A: {action.commandTag}</span>
      ) : null}
      <h3 className="ai-action-card__title">{action.title ?? 'Confirmar ação'}</h3>
      {action.recipient ? (
        <div className="ai-action-card__row">
          <span className="ai-action-card__label">Destinatário</span>
          <span className="ai-action-card__value">{action.recipient}</span>
        </div>
      ) : null}
      {action.scheduledFor ? (
        <div className="ai-action-card__row">
          <span className="ai-action-card__label">Agendado para</span>
          <span className="ai-action-card__value">{action.scheduledFor}</span>
        </div>
      ) : null}
      {action.body ? <p className="ai-action-card__body">{action.body}</p> : null}
      {confirmed ? (
        <p className="ai-action-card__confirmed">
          <Check size={14} strokeWidth={2.4} /> {confirmedLabel}
        </p>
      ) : (
        <>
          <div className="ai-action-card__actions">
            <button
              type="button"
              className="ai-action-card__confirm"
              disabled={!action.task_id || confirmMutation.isPending}
              onClick={() => (action.task_id ? confirmMutation.mutate() : setConfirmed(true))}
            >
              {confirmMutation.isPending ? 'CONFIRMANDO…' : 'CONFIRMAR'}
            </button>
            <button type="button" className="ai-action-card__cancel" onClick={() => setDismissed(true)}>
              CANCELAR
            </button>
          </div>
          {error ? <p className="ai-action-card__error">{error}</p> : null}
        </>
      )}
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseAiResponse(response: unknown): { content: string; action?: ActionCard } {
  if (typeof response === 'string') return { content: response };
  if (response && typeof response === 'object') {
    const value = response as Record<string, unknown>;
    if (typeof value.reply === 'string') {
      return { content: value.reply, action: value.action as ActionCard | undefined };
    }
    if (typeof value.message === 'string') {
      return { content: value.message, action: value.action as ActionCard | undefined };
    }
    if (typeof value.error === 'string') {
      return { content: `Erro: ${value.error}` };
    }
    return { content: JSON.stringify(value, null, 2) };
  }
  return { content: String(response) };
}

export function AiAssistantPage() {
  const { accessToken } = useAuth();
  const aiChat = useAiChatMutation();
  const { data: history, isLoading: historyLoading, isFetching: historyFetching } = useAiHistoryQuery();
  const clearHistory = useClearAiHistoryMutation();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const tts = useSpeechSynthesis({ lang: 'pt-BR' });
  const composerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hidrata o thread com o histórico persistido no backend (uma única vez).
  // Antes, as mensagens viviam só em estado local e sumiam ao sair da tela.
  useEffect(() => {
    // espera o refetch fresco (refetchOnMount) antes de hidratar, senão
    // hidrataria a partir de cache antigo sem as mensagens recentes.
    if (hydrated || historyLoading || historyFetching) return;
    if (history && history.length > 0) {
      setMessages(
        history.map((m: AiHistoryMessage, i: number) => ({
          id: `h-${i}`,
          content: m.content,
          isUser: m.role === 'user',
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        })),
      );
    }
    setHydrated(true);
  }, [history, historyLoading, historyFetching, hydrated]);

  // Primeira carga: pula direto pro fim sem animar; depois rola suave.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: didInitialScrollRef.current ? 'smooth' : 'auto',
    });
    didInitialScrollRef.current = true;
  }, [messages, aiChat.isPending]);

  const isEmptyConversation = useMemo(
    () => messages.length === 1 && messages[0].id === 'welcome',
    [messages],
  );

  const sendPrompt = async (
    prompt: string,
    attachment?: { url: string; mime: string },
  ) => {
    if ((!prompt.trim() && !attachment) || !accessToken || aiChat.isPending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      content: prompt,
      isUser: true,
      timestamp: new Date(),
      attachmentUrl: attachment?.url,
      attachmentMime: attachment?.mime,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await aiChat.mutateAsync({
        message: prompt,
        attachment_url: attachment?.url,
        attachment_mime: attachment?.mime,
        // fuso real do usuário → agendamento na hora certa dele
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tz_offset: new Date().getTimezoneOffset(),
      });
      const parsed = parseAiResponse(response);
      const aiMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        content: parsed.content,
        isUser: false,
        timestamp: new Date(),
        action: parsed.action,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('[Humberto] Failed to get response:', error);
      const errorMessage: ChatMessage = {
        id: `a-error-${Date.now()}`,
        content:
          'Desculpe, não consegui processar esse pedido. Tente novamente ou reformule sua pergunta.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendPrompt(input);
    // mantém o foco no campo após enviar (input não é mais desabilitado)
    composerRef.current?.focus();
  };

  const handleNewConversation = () => {
    // Limpa o histórico persistido (POST /ai/history/clear) e reinicia o thread.
    tts.cancel(); // para qualquer leitura em andamento
    clearHistory.mutate();
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    composerRef.current?.focus();
  };

  const handleChipClick = (chip: { label: string; prompt: string }) => {
    if (!chip.prompt) return;
    sendPrompt(chip.prompt);
  };

  // Imagem/vídeo → pré-visualização com legenda (W8). PDF/doc → envia direto.
  const handleAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPendingFile(file);
    } else {
      void uploadAndSend(file, '');
    }
  };

  // Faz upload do anexo e envia ao Humberto com a legenda (texto + mídia juntos).
  const uploadAndSend = async (file: File, caption: string) => {
    if (!accessToken || aiChat.isPending || uploading) return;
    const isImage = file.type.startsWith('image/');
    setUploading(true);
    try {
      let url: string;
      if (isImage) {
        const form = new FormData();
        form.append('file', file);
        ({ url } = await uploadsApi.image(form, accessToken));
      } else {
        ({ url } = await uploadsApi.file(file, accessToken));
      }
      await sendPrompt(caption, { url, mime: file.type });
      setPendingFile(null);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-error-${Date.now()}`,
          content: 'Não consegui enviar o anexo. Tente um arquivo menor (imagem até 5 MB, documento até 10 MB).',
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="ai-assistant-page">
      <header className="ai-assistant-page__header">
        <div className="ai-assistant-page__title">
          <span className="ai-assistant-page__title-mark" aria-hidden="true">
            <Sprout size={18} strokeWidth={2.4} />
          </span>
          <div>
            <h1>Humberto</h1>
            <p>Seu assistente de IA pessoal</p>
          </div>
        </div>

        <div className="ai-assistant-page__header-actions">
          <button
            type="button"
            className="ai-assistant-page__new"
            onClick={handleNewConversation}
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            Nova conversa
          </button>
        </div>
      </header>

      <div className="ai-assistant-page__layout">
        <main className="ai-assistant-page__thread" aria-live="polite">
          {messages.map((message) =>
            message.isUser ? (
              <article key={message.id} className="ai-message ai-message--user">
                <div className="ai-message__bubble ai-message__bubble--user">
                  {message.attachmentUrl ? (
                    message.attachmentMime?.startsWith('image/') ? (
                      <img
                        src={message.attachmentUrl}
                        alt=""
                        className="ai-message__attachment-img"
                      />
                    ) : (
                      <span className="ai-message__attachment-file">📎 documento anexado</span>
                    )
                  ) : null}
                  {message.content}
                </div>
                <small className="ai-message__meta">
                  VOCÊ · {formatTime(message.timestamp)}
                </small>
              </article>
            ) : (
              <article key={message.id} className="ai-message ai-message--ai">
                <div className="ai-message__bubble ai-message__bubble--ai">
                  {message.content}
                </div>
                {message.action && typeof message.action === 'object' && 'type' in (message.action as object) ? (
                  <ActionCardBlock action={message.action as ActionCard} />
                ) : message.action ? (
                  <pre className="ai-message__action">
                    {JSON.stringify(message.action, null, 2)}
                  </pre>
                ) : null}
                {message.chips && message.chips.length > 0 ? (
                  <div className="ai-message__chips">
                    {message.chips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className={`ai-message__chip${!chip.prompt ? ' ai-message__chip--muted' : ''}`}
                        onClick={() => handleChipClick(chip)}
                        disabled={aiChat.isPending || !chip.prompt}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <small className="ai-message__meta">
                  HUMBERTO · {formatTime(message.timestamp)}
                  {tts.supported && message.content.trim() ? (
                    <button
                      type="button"
                      className={`ai-message__speak${
                        tts.speakingId === message.id ? ' ai-message__speak--on' : ''
                      }`}
                      aria-label={
                        tts.speakingId === message.id ? 'Parar leitura' : 'Ouvir resposta'
                      }
                      title={tts.speakingId === message.id ? 'Parar leitura' : 'Ouvir resposta'}
                      onClick={() => tts.speak(message.content, message.id)}
                    >
                      {tts.speakingId === message.id ? (
                        <VolumeX size={13} strokeWidth={2.4} />
                      ) : (
                        <Volume2 size={13} strokeWidth={2.4} />
                      )}
                    </button>
                  ) : null}
                </small>
              </article>
            ),
          )}

          {aiChat.isPending ? (
            <article className="ai-message ai-message--ai">
              <div className="ai-message__bubble ai-message__bubble--typing">
                <CircleDashed size={14} strokeWidth={2.4} className="ai-message__spinner" />
                Humberto está digitando…
              </div>
            </article>
          ) : null}

          <div ref={messagesEndRef} />
        </main>

        <aside className="ai-assistant-page__sidekick" aria-label="Sugestões">
          {/* Comandos reais que o Humberto consegue executar */}
          <section className="sidekick-card">
            <header>
              <Lightbulb size={16} strokeWidth={2.2} />
              <h2>Comandos para testar</h2>
            </header>
            <ul>
              {PROMPT_CHIPS.map((chip) => {
                const Icon = chip.icon;
                return (
                  <li key={chip.label}>
                    <button
                      type="button"
                      className="sidekick-card__chip"
                      onClick={() => sendPrompt(chip.prompt)}
                      disabled={aiChat.isPending}
                    >
                      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
                      {chip.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {isEmptyConversation ? (
        <div className="ai-assistant-page__suggestions" role="list">
          {PROMPT_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={`hero-${chip.label}`}
                type="button"
                role="listitem"
                className="ai-assistant-page__suggestion"
                onClick={() => sendPrompt(chip.prompt)}
                disabled={aiChat.isPending}
              >
                <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <footer className="ai-assistant-page__composer-wrap">
        <form className="ai-composer" onSubmit={handleSubmit} noValidate>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            style={{ display: 'none' }}
            onChange={handleAttachment}
          />
          <button
            type="button"
            className="ai-composer__icon"
            aria-label="Anexar imagem ou PDF"
            title="Anexar imagem ou PDF"
            disabled={aiChat.isPending || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={16} strokeWidth={2.4} />
          </button>

          {/* Câmera ao vivo (getUserMedia) — funciona no desktop e no mobile */}
          <button
            type="button"
            className="ai-composer__icon"
            aria-label="Tirar foto"
            title="Tirar foto"
            disabled={aiChat.isPending || uploading}
            onClick={() => setShowCamera(true)}
          >
            <Camera size={16} strokeWidth={2.4} />
          </button>

          <input
            ref={composerRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escreva, ou fale tocando no microfone…"
            className="ai-composer__input"
            aria-label="Mensagem para o Humberto"
          />

          {/* Falar com o Humberto — ditado por voz (transcreve no campo, não envia) */}
          <DictationButton
            currentText={input}
            onTranscript={setInput}
            disabled={aiChat.isPending || uploading}
            size={16}
            className="ai-composer__icon"
            label="Falar com o Humberto"
            icon="mic"
          />

          <button
            type="submit"
            className="ai-composer__send"
            aria-label="Enviar mensagem"
            disabled={aiChat.isPending || !input.trim()}
          >
            <Send size={18} strokeWidth={2.4} />
          </button>
        </form>

        <small className="ai-assistant-page__footnote">
          HUMBERTO · POWERED BY YOUR COMMUNITY DATA
        </small>
      </footer>

      {pendingFile && (
        <ImagePreviewModal
          file={pendingFile}
          sending={uploading}
          recipientLabel="Humberto"
          onCancel={() => setPendingFile(null)}
          onSend={(caption) => uploadAndSend(pendingFile, caption)}
        />
      )}

      {showCamera && (
        <CameraCaptureModal
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setShowCamera(false);
            setPendingFile(file);
          }}
        />
      )}
    </div>
  );
}
