<div align="center">

# 🌿 Leaf Talk

### Mensageria moderna com IA, tempo real e segurança de verdade.

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TS-3178C6?logo=react&logoColor=white)](#)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](#)
[![Banco](https://img.shields.io/badge/Banco-MongoDB-47A248?logo=mongodb&logoColor=white)](#)
[![IA](https://img.shields.io/badge/IA-Claude%20(Anthropic)-D97757?logo=anthropic&logoColor=white)](#)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-000000?logo=vercel&logoColor=white)](#)

**🔗 App:** [leaftalkapp.vercel.app](https://leaftalkapp.vercel.app) · **🧠 Assistente:** Humberto · **🎯 Quiz ao vivo:** `/quiz`

</div>

---

## ✨ O que é

O **Leaf Talk** é uma plataforma de mensagens completa — conversas 1:1 e em grupo em **tempo real**, envio de **arquivos, imagens e áudio**, um **assistente de IA** integrado (o **Humberto**) que conversa, ajuda e **agenda mensagens**, tudo com **segurança** levada a sério (JWT, criptografia em trânsito, rate limiting, autorização por recurso).

> Este repositório é o **frontend** (React/Vite). O backend (FastAPI) vive em um repositório separado.

---

## 🚀 Funcionalidades

| Área | Destaques |
|------|-----------|
| 💬 **Conversas** | 1:1 e grupos, tempo real (WebSocket + polling de fallback), responder, editar, apagar (para mim / para todos), favoritar, encaminhar |
| 📎 **Mídia** | Imagens, áudio (gravação), documentos (PDF/DOCX/ZIP) com pré-visualização e download |
| 🧠 **Humberto (IA)** | Chat com Claude, responde qualquer assunto, analisa imagem/PDF, **envia e agenda** mensagens com card de confirmação |
| ⏰ **Agendamento** | Programe mensagens; cancele/edite antes do disparo |
| 👥 **Grupos** | Admins, foto do grupo, "só admins enviam", entrar por código, gestão de membros |
| 🔔 **Presença & avisos** | Online/visto por último, ✓✓ de leitura, sino de notificações |
| 🛡️ **Privacidade** | Visibilidade na busca, confirmações de leitura, bloquear/desbloquear |
| 🌗 **Tema** | Claro/escuro, layout compacto, 100% responsivo (mobile-web) |
| 🎯 **Leaf Quiz** | Experiência ao vivo: 10 perguntas sorteadas, ranking em tempo real, Top 3, QR Code |

---

## 🧱 Stack

- **React 18 + Vite + TypeScript**
- **TanStack Query** (dados/cache) · **React Router**
- **lucide-react** (ícones) · CSS variables + dark mode (`[data-theme]`)
- **WebSocket** nativo + polling de fallback
- Web Speech API (ditado por voz) · VisualViewport (teclado no mobile)

---

## ⚙️ Rodando localmente

> Requer **Node.js 22+** e o backend rodando (veja o repositório do backend).

```bash
cp .env.example .env      # aponte para o backend
npm install
npm run dev               # http://localhost:5173
npm run build             # build de produção (tsc -b + vite build)
```

### Variáveis de ambiente (`.env`)
| Variável | Descrição |
|----------|-----------|
| `VITE_API_BASE_URL` | URL do backend (ex.: `http://localhost:8000`) |
| `VITE_WS_BASE_URL`  | URL do WebSocket (ex.: `ws://localhost:8000`) |

Em produção (`.env.production`) apontam para o Render (`https://…onrender.com` / `wss://…`).

---

## 📜 Scripts

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Type-check + build de produção |
| `npm run lint` | ESLint |
| `npm run test` | Testes unitários |
| `npm run verify` | Formatação + types + lint + testes + build |

> No PowerShell, use `npm.cmd` se a execução de scripts `.ps1` estiver bloqueada.

---

## 🗂️ Estrutura

```
src/
├── features/        # telas por domínio
│   ├── auth/        # login, registro, verificação, recuperação, Google
│   ├── chats/       # lista + janela de conversa 1:1
│   ├── groups/      # grupos + configurações
│   ├── ai/          # Humberto (assistente de IA)
│   ├── search/      # busca de usuários
│   ├── profile/     # perfil + privacidade
│   └── quiz/        # Leaf Quiz (jogo + ranking ao vivo)
├── components/      # UI reutilizável (avatar, bolha, viewer, etc.)
├── lib/             # api (contratos/endpoints), auth, utilidades
├── hooks/           # áudio, voz, tema, long-press
├── routes/          # rotas e caminhos
└── styles/          # tokens, design system, tema escuro
```

---

## 🎯 Leaf Quiz

Rotas públicas (sem login), pensadas para apresentações:

- **`/quiz`** — o participante digita o nome e responde **10 perguntas sorteadas** (de um banco maior), em ordem aleatória, com cronômetro e barra de progresso. No fim vê acertos, tempo e posição.
- **`/quiz/ranking`** — ranking **ao vivo** (atualiza sozinho): Top 3 em pódio, contador de participantes, **QR Code** do quiz e confete quando o líder muda.

Correção e ranking são feitos no servidor (anti-cola). Ordenação: **mais acertos → menor tempo → quem terminou antes**.

---

## 🛡️ Segurança (resumo)

JWT com invalidação no logout, senhas com **bcrypt**, **rate limiting**, headers de segurança, autorização por recurso (sem IDOR), WebSocket autenticado, uploads com whitelist de tipo e nomes em UUID. Conteúdo de mensagem é **escapado** antes de renderizar (anti-XSS).

---

<div align="center">

Feito com 🌿 pela equipe **Leaf**. Suporte: fale com o Alan pelo app.

</div>
