/**
 * Markdown leve e SEGURO para as respostas do Humberto (negrito, itálico,
 * código, ~~tachado~~, links e quebras de linha). Escapa o HTML primeiro, então
 * nenhuma tag do texto é interpretada — só a formatação que aplicamos. Sem libs.
 */
export function renderMarkdown(src: string): string {
  if (!src) return '';

  // 1) escapa HTML
  let s = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2) títulos markdown (# / ## ...) → vira negrito, sem mostrar os "#"
  s = s.replace(/^\s*#{1,6}\s*(.*)$/gm, (_m, t) => (t ? `<strong>${t}</strong>` : ''));

  // 3) blocos de código ```...```
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) =>
    `<pre class="md-pre"><code>${String(code).replace(/^\n/, '').replace(/\n$/, '')}</code></pre>`,
  );

  // 3) código inline `...`
  s = s.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');

  // 4) negrito **...** / __...__
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 5) itálico *...* / _..._
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  // 6) tachado ~~...~~
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 7) links [texto](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );

  // 8) quebras de linha
  s = s.replace(/\n/g, '<br>');

  return s;
}
