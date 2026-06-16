/**
 * RISCO CONHECIDO: o access token fica em localStorage, que é legível por JS —
 * logo, um XSS conseguiria roubá-lo. Mitigações já aplicadas como compensação:
 *  - todo conteúdo de mensagem/IA passa por renderMarkdown, que escapa HTML
 *    (incl. aspas) antes de qualquer dangerouslySetInnerHTML → fecha o XSS;
 *  - logout invalida o token no backend (token_version), reduzindo a janela.
 * EVOLUÇÃO RECOMENDADA (fora do escopo atual por exigir refactor grande):
 * mover para cookie httpOnly + refresh token com rotação e proteção CSRF.
 */
const TOKEN_STORAGE_KEY = 'leaf.accessToken';

export const tokenStorage = {
  get() {
    if (!canUseStorage()) {
      return null;
    }

    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  set(token: string) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },

  clear() {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}
