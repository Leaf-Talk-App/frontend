import {
  CalendarCheck,
  Check,
  CircleDashed,
  Lightbulb,
  Plus,
  Send,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/use-auth';
import { useAiChatMutation } from './ai-hooks';
import './ai-assistant-page.css';

interface ActionCard {
  type: 'schedule' | 'draft' | 'generic';
  title?: string;
  recipient?: string;
  scheduledFor?: string;
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
}

interface PromptChip {
  label: string;
  prompt: string;
  icon: typeof Lightbulb;
}

const PROMPT_CHIPS: PromptChip[] = [
  {
    label: 'Resumir a conversa de Engenharia',
    prompt: 'Resuma a conversa de Engenharia e destaque as principais decisões e tarefas.',
    icon: Sparkles,
  },
  {
    label: 'Priorizar minhas pendências',
    prompt: 'Me ajude a priorizar minhas pendências do workspace por prazo e impacto.',
    icon: TrendingUp,
  },
  {
    label: 'Preparar o Design Sync',
    prompt: 'Me ajude a preparar uma pauta e os pontos de discussão para o próximo Design Sync.',
    icon: Users,
  },
];

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  content:
    'Olá! Sou o Humberto, seu assistente profissional. Analisei sua agenda. Com base nas suas conversas recentes, quer que eu comece a acompanhar o time do Planner-Horizon?',
  isUser: false,
  timestamp: new Date(),
  chips: [
    { label: 'Sim, pode redigir', prompt: 'Sim, redija um follow-up para o time do Planner-Horizon.' },
    { label: 'Agora não', prompt: '' },
  ],
};

function ActionCardBlock({ action }: { action: ActionCard }) {
  const [dismissed, setDismissed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (dismissed) return null;

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
          <Check size={14} strokeWidth={2.4} /> Confirmado
        </p>
      ) : (
        <div className="ai-action-card__actions">
          <button type="button" className="ai-action-card__confirm" onClick={() => setConfirmed(true)}>
            CONFIRMAR
          </button>
          <button type="button" className="ai-action-card__cancel" onClick={() => setDismissed(true)}>
            CANCELAR
          </button>
        </div>
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
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const composerRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiChat.isPending]);

  const isEmptyConversation = useMemo(
    () => messages.length === 1 && messages[0].id === 'welcome',
    [messages],
  );

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim() || !accessToken || aiChat.isPending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      content: prompt,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await aiChat.mutateAsync({ message: prompt });
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
  };

  const handleNewConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
    composerRef.current?.focus();
  };

  const handleChipClick = (chip: { label: string; prompt: string }) => {
    if (!chip.prompt) return;
    sendPrompt(chip.prompt);
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
            <p>Seu assistente que conhece a comunidade</p>
          </div>
        </div>

        <button
          type="button"
          className="ai-assistant-page__new"
          onClick={handleNewConversation}
        >
          <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
          Nova conversa
        </button>
      </header>

      <div className="ai-assistant-page__layout">
        <main className="ai-assistant-page__thread" aria-live="polite">
          {messages.map((message) =>
            message.isUser ? (
              <article key={message.id} className="ai-message ai-message--user">
                <div className="ai-message__bubble ai-message__bubble--user">
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
          {/* Workflow Insights */}
          <section className="sidekick-card sidekick-card--insight">
            <header>
              <CalendarCheck size={16} strokeWidth={2.2} />
              <h2>Insights de fluxo</h2>
            </header>
            <p>
              Você está <strong>32% mais rápido</strong> respondendo às conversas esta semana.
              O Humberto pode redigir os follow-ups enquanto você foca nas tarefas de lançamento.
            </p>
          </section>

          {/* Collaboration */}
          <section className="sidekick-card sidekick-card--collab">
            <header>
              <Users size={16} strokeWidth={2.2} />
              <h2>Colaboração</h2>
            </header>
            <p className="sidekick-card__collab-sub">
              Contatos frequentes: <strong>Julie, Sarah</strong> e o Time Christian
            </p>
            <p className="sidekick-card__collab-note">
              3 mensagens precisam de retorno na conversa <strong>Design Sync</strong>
            </p>
          </section>

          {/* Try Commands */}
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
          <button
            type="button"
            className="ai-composer__icon"
            aria-label="Adicionar contexto"
            disabled={aiChat.isPending}
          >
            <Plus size={16} strokeWidth={2.4} />
          </button>

          <input
            ref={composerRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escreva uma mensagem ou comando…"
            className="ai-composer__input"
            disabled={aiChat.isPending}
            aria-label="Mensagem para o Humberto"
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
    </div>
  );
}
