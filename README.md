# Roomix Platform Console

Sistema interno **independente** da equipe Roomix — torre de controle
para acompanhar todas as propriedades, planos, Channel Manager, FNRH,
agentes Roomix e logs.

> **Este app NÃO é o SaaS do cliente.** Clientes/proprietários continuam
> usando o Roomix SaaS normal. O Platform Console só pode ser acessado
> por superadmins da equipe Roomix.

## Arquitetura

```
┌────────────────────────────┐     proxy /api      ┌─────────────────────────┐
│ Roomix Platform Console    │  ─────────────────▶ │ Roomix SaaS API         │
│ (este projeto, port 5174)  │                     │ (server.ts, port 3000)  │
└────────────────────────────┘                     └─────────────────────────┘
                                                           │
                                                           ▼
                                                   ┌─────────────────────────┐
                                                   │ Roomix Channel Manager  │
                                                   │ (futuro bridge)         │
                                                   └─────────────────────────┘
```

- **Login próprio** — formulário interno, dark theme, fora do SaaS do cliente.
- **Vite proxy** — `/api/*` é encaminhado para o SaaS, garantindo que o cookie
  HttpOnly permaneça first-party em `localhost:5174`. Nada de tokens em URL ou
  localStorage.
- **Guard duplo** — frontend bloqueia quem não for superadmin; o backend
  (`requirePlatformSuperadmin`) também rejeita com 403 mesmo se o frontend for
  burlado.

## Como rodar localmente

Precisa de **Node ≥22** (o projeto usa o mesmo engine do SaaS).

### Terminal 1 — backend (Roomix SaaS)

```bash
cd ../remix_-roomix-v6.7.1-github-v1.0
npm run dev
```

Sobe em `http://localhost:3000`. Esse server expõe a API
`/api/platform/console/overview` (superadmin only) que o Console consome.

### Terminal 2 — Platform Console

```bash
cd roomix-platform-console
npm install
npm run dev
```

Sobe em `http://localhost:5174`. Abra esta URL, faça login com sua
credencial de superadmin Roomix e acesse o dashboard.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se precisar trocar o backend
default:

```
VITE_ROOMIX_API_BASE=http://localhost:3000
```

## Build de produção

```bash
npm run build       # tsc --noEmit + vite build
npm run preview     # serve dist/ em :5174 para inspeção
```

A URL de produção deste app vai viver em domínio separado
(ex.: `console.roomix.com.br`), nunca em subdomínio compartilhado com o
SaaS do cliente.

## O que ainda NÃO está conectado

Veja o ADR
[`../remix_-roomix-v6.7.1-github-v1.0/docs/adr/platform-console-independent-app.md`](../remix_-roomix-v6.7.1-github-v1.0/docs/adr/platform-console-independent-app.md)
para a lista completa de seções "não conectado" e os próximos passos
de wire (Channel Manager bridge, billing, FNRH, agentes runtime, etc.).
