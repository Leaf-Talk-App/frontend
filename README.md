# Leaf Frontend

Frontend application for Leaf / LeafsTalk.

This workspace is intentionally scoped to frontend code. Backend files are treated as integration contracts and should not be modified from this project.

## Requirements

- Node.js 24 LTS or 22 LTS
- npm 10+ or pnpm 9+

## Setup

```powershell
cp .env.example .env
npm install
npm run dev
```

The default API target is `http://localhost:8000`.

## Scripts

- `npm run dev`: start the local Vite server
- `npm run build`: type-check and build production assets
- `npm run lint`: run ESLint
- `npm run format`: format source files with Prettier
- `npm run format:check`: verify formatting
- `npm run test`: run unit tests once
- `npm run test:watch`: run unit tests in watch mode
- `npm run typecheck`: run TypeScript checks
- `npm run verify`: run formatting, type-check, lint, unit tests, and production build checks

## Como testar antes de commitar

Use esta rotina antes de criar um commit:

```powershell
npm.cmd run verify
```

Se alguma etapa falhar, corrija o erro indicado e rode o comando novamente. Para validar manualmente no navegador:

```powershell
npm.cmd run dev
```

Abra `http://127.0.0.1:5173` e teste o fluxo que foi alterado. Quando a tela depender do backend, confirme também que a API está respondendo em `http://localhost:8000`.

No PowerShell, use `npm.cmd` se a execução de scripts `.ps1` estiver bloqueada. O comando `npm run verify` também funciona quando a política de execução do Windows permite scripts.

Para rodar apenas os testes unitários:

```powershell
npm.cmd run test
```

## Design Source

Implementation should follow the connected Figma file as the primary source of truth and the exported PNGs as visual references.

## Backend Integration

The frontend API modules are based on the existing FastAPI routes:

- `/auth/register`
- `/auth/login`
- `/users/me`
- `/users/profile`
- `/users/search`
- `/chats`
- `/messages`
- `/groups`
- `/ai`
- `/uploads/file`

Known backend alignment notes are tracked during implementation instead of being changed from this frontend workspace.

The first integration layer includes auth/session hooks for login, registration, logout, and the current user query. Visual auth screens will be implemented only after the matching Figma frame context is available.
