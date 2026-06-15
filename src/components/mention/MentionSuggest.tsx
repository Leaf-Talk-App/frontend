import './mention-suggest.css';

// token "@palavra" sendo digitado no fim do texto (início ou após espaço)
const AT_RE = /(^|\s)@([\p{L}\p{N}_]*)$/u;

export function getMentionQuery(text: string): string | null {
  const m = AT_RE.exec(text || '');
  return m ? m[2] : null;
}

export function applyMention(text: string, name: string): string {
  return text.replace(AT_RE, (_full, pre) => `${pre}@${name} `);
}

interface Props {
  text: string;
  names: string[];
  onPick: (name: string) => void;
}

/**
 * Card de menção acima da caixa de texto: ao digitar "@" mostra os nomes
 * (Humberto + membros). Clicar insere "@Nome ". Estilo WhatsApp/Telegram.
 */
export function MentionSuggest({ text, names, onPick }: Props) {
  const q = getMentionQuery(text);
  if (q === null) return null;
  const ql = q.toLowerCase();
  const matches = names.filter((n) => n && n.toLowerCase().includes(ql)).slice(0, 6);
  if (matches.length === 0) return null;

  return (
    <div className="mention-suggest" role="listbox">
      {matches.map((n) => (
        <button
          type="button"
          key={n}
          className="mention-suggest__item"
          // onMouseDown (não onClick) p/ não tirar o foco do campo antes de inserir
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(n);
          }}
        >
          <span className="mention-suggest__at">@</span>
          <span className="mention-suggest__name">{n}</span>
        </button>
      ))}
    </div>
  );
}
