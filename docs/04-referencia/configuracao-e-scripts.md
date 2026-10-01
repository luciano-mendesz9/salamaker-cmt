# Configuracao e scripts

## Pre-requisitos

- Node.js compativel com Next.js 16 e Prisma 7;
- banco PostgreSQL acessivel pelo adaptador Neon;
- dependencias instaladas com o lockfile do projeto.

## Variaveis de ambiente

| Variavel | Uso | Requisito observado |
|---|---|---|
| `DATABASE_URL` | Prisma CLI, aplicacao e scripts | Obrigatoria; URL PostgreSQL/Neon |
| `AUTH_SECRET` | Assinatura HS256 das sessoes | Obrigatoria; minimo de 32 caracteres |
| `ADMIN_ACTION_PASSWORD` | Acoes destrutivas ou monetarias do professor | Obrigatoria nesses fluxos; minimo de 8 caracteres |
| `NODE_ENV` | Cookie seguro e comportamento do framework | Definida pelo ambiente |
| `REDIS_URL` ou `KV_URL` | Presenca, pub/sub, convites e chat do Ludo Maker entre instancias | Obrigatoria para multiplayer confiavel no deploy |

O Ludo Maker usa WebSockets da Vercel e requer Fluid Compute habilitado. WebSocket e Redis nao substituem o Neon: o banco PostgreSQL continua sendo a autoridade de turnos, apostas, colocacoes e ledgers.

Nunca publique o arquivo `.env`, URLs de banco, senhas ou tokens. O repositorio ja ignora arquivos de ambiente locais.

## Comandos npm

| Comando | Funcao |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build Next.js usando Webpack |
| `npm run start` | Servidor da build de producao |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emissao |
| `npm test` | Testes `src/lib/*.test.ts` via Node + tsx |
| `npm run db:generate` | Regenera o Prisma Client |
| `npm run db:migrate` | Cria/aplica migracao de desenvolvimento |
| `npm run db:deploy` | Aplica migracoes pendentes no destino configurado |
| `npm run create-teacher` | Cria professor interativamente ou por argumentos |
| `npm run db:check` | Testa conexao e lista contas; cuidado com a saida |
| `npm run db:check-account -- CODIGO` | Verifica papel/status de uma conta |
| `npm run db:check-ludo` | Le saldos, ledgers, tesouraria e custodia do Ludo sem escrever |

O `postinstall` executa `npx prisma generate`.

## Criacao de professor

O script aceita perguntas interativas ou os argumentos `--firstName`, `--lastName` e `--password`. Evite senha na linha de comando porque ela pode aparecer no historico do shell e na lista de processos; prefira a entrada interativa oculta.

O script valida nome, senha de 8 a 72 caracteres, gera o hash bcrypt e cria o codigo anual `PROF...` dentro de uma transacao.

## Diagnosticos

`db:check` imprime codigo, nome, papel e status de todas as contas. Use apenas em ambiente administrativo, pois essa saida contem identificadores de acesso, embora nao revele senhas.

`db:check-account` retorna somente papel, status e pendencia de troca de senha para um codigo informado.

## Instalacao local sugerida

```bash
npm ci
npm run db:generate
npm run dev
```

Antes de apontar o projeto para um banco compartilhado, confira se as migracoes esperadas ja foram aplicadas. Nao execute `db:migrate` ou `db:deploy` contra um destino real sem confirmar o ambiente e ter autorizacao para escrita.
