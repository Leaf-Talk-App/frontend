# Alterações aplicadas (Leaf frontend)

Este é o **frontend real** do `Leaf-Talk-App/frontend` (React + Vite + TS),
com as nossas mudanças já integradas **nos arquivos originais** — preservando
estrutura, classes CSS e a camada de API (fala com o seu FastAPI).

## Rodar
```bash
npm install
cp .env.example .env   # ajuste a URL da API
npm run dev
```
Antes de commitar: `npm run verify`.

## O que mudou (somente estes arquivos)

**1. Verificação de e-mail** — `src/features/auth/VerifyEmailPage.tsx` +
`verify-email-page.css`
- Suporte a **colar** o código: distribui os 6 dígitos, move o foco e
  **auto-verifica** quando completa. `autoComplete="one-time-code"` (autofill
  de SMS no mobile).
- **Estado de sucesso**: "E-mail verificado com sucesso" → "Redirecionando
  para o login…" + spinner + barra de progresso, aguarda ~2,2s e então navega
  (antes era instantâneo). Usa `useVerifyEmailMutation` real.

**2. "Leaf AI" → "Humberto"** — `src/features/ai/AiAssistantPage.tsx` +
`src/components/app-shell/AuthenticatedShell.tsx`
- Só textos/labels. Estrutura, classes CSS, rota (`/ai`), hook
  (`useAiChatMutation`) e `ai-assistant-page.css` **inalterados**.

**3. Ajuda → WhatsApp** — `src/components/app-shell/AuthenticatedShell.tsx`
- Botão "Ajuda e suporte" abre `wa.me/5534993388856` com a mensagem
  "Olá, preciso de ajuda com o Leaf." (constante `HELP_WHATSAPP_URL`).

**4. Busca — só usuários, em tempo real** — `src/features/search/SearchPage.tsx`
+ `search-page.css`
- Removidas as categorias (Engineering/Creative/Product) e o estado de
  sugestão. Lista limpa de usuários via `useUserSearch` (debounce 300ms, 2+
  caracteres). Usa os campos reais do `LeafUser` (`display_name`/`name`,
  `email`, `verified`, `bio`, `avatar`, `online`). "Conversar" cria o chat com
  `chatsApi.create({ user_id })` e navega para `/chats/:id`.

Toda a UI dessas telas está em pt-BR.

## Tradução pt-BR (todas as telas)
Além das 4 telas acima, traduzi toda a interface restante: Login, Cadastro,
Esqueci/Redefinir senha, Callback do Google, Conversas, Janela de conversa,
Perfil, e os componentes (ChatItem, MessageBubble, botão do Google). Datas e
horas agora usam `pt-BR`.

## Dark mode (incluído e ativo)
Toggle sol/lua flutuante no canto superior direito, em todas as telas. Persiste
em `localStorage` e segue a preferência do SO na 1ª visita. Arquivos:
`src/styles/dark-theme.css` (importado por último no `global.css`),
`src/hooks/useTheme.ts`, `src/components/theme-toggle/ThemeToggle.tsx` (montado
no `App.tsx`). O `dark-theme.css` é **aditivo** (tudo sob `[data-theme="dark"]`,
não altera o tema claro); para desligar, remova o `@import './dark-theme.css'`
do `global.css`.
