# Arquitetura

## Stack

| Camada | Tecnologia observada |
|---|---|
| Framework | Next.js 16.3.3, App Router |
| Interface | React 19.2.8, TypeScript 5, Tailwind CSS 4 |
| Icones e feedback | `lucide-react`, `sonner` |
| Banco | PostgreSQL no Neon |
| ORM | Prisma 7.10, client gerado em `src/generated/prisma` |
| Adaptador | `@prisma/adapter-neon` com fallback WebSocket `ws` |
| Validacao | Zod 4 |
| Autenticacao | JWT HS256 com `jose`, cookie HTTP-only, bcrypt |
| Exportacao | XLSX gerado com `fflate` e utilitario proprio |
| Testes | Node test runner carregado por `tsx` |

## Organizacao do codigo

```text
src/
├── app/                 # paginas, layouts e Route Handlers
│   ├── aluno/           # superficie autenticada do estudante
│   ├── professor/       # superficie autenticada do professor
│   └── api/             # endpoints de autenticacao, aluno e professor
├── assets/              # Dev-Coin e 41 imagens de avatar locais
├── components/          # componentes de dominio e interface
├── generated/prisma/    # client Prisma gerado; nao editar manualmente
├── lib/                 # regras puras, autorizacao, sessao e acesso ao banco
└── proxy.ts             # redirecionamento por sessao/papel
prisma/
├── schema.prisma
└── migrations/
scripts/                 # provisionamento e diagnostico de contas/banco
```

## Fluxo de uma requisicao protegida

1. `src/proxy.ts` protege as paginas `/aluno/*` e `/professor/*` e direciona o usuario conforme papel e troca obrigatoria de senha.
2. Paginas e APIs nao confiam apenas no proxy: chamam `requireStudent()` ou `requireTeacher()`.
3. A funcao de autorizacao verifica assinatura do token, papel, usuario ativo e versao atual da sessao no banco.
4. O Route Handler valida a entrada com Zod e executa consultas contextuais ao usuario autenticado.
5. Escritas relacionadas sao agrupadas em transacao quando saldo, ledger, auditoria ou varias entidades precisam mudar juntas.

## Sessao e autorizacao

O cookie se chama `sala-maker-session`. Seu payload contem `userId`, `role`, `version` e `mustChangePassword`.

- Professor: token com validade de 30 dias.
- Aluno: token com validade de 30 minutos.
- Cookie: `httpOnly`, `sameSite=lax`, caminho `/` e `secure` em producao.
- Um aluno com senha temporaria so pode acessar `/aluno/trocar-senha`.
- A troca de senha incrementa `sessionVersion`, remove o cookie e exige novo login.
- O arquivamento tambem incrementa `sessionVersion`, encerrando a autoridade de tokens anteriores.

## Acesso ao banco

`src/lib/db.ts` cria um `PrismaClient` com `PrismaNeon`. Em Node sem WebSocket nativo, o pacote `ws` e registrado como fallback. Em desenvolvimento, a instancia e reutilizada em `globalThis` para evitar conexoes extras durante hot reload.

O `next.config.ts` mantem `ws` como pacote externo do servidor para evitar uma quebra de empacotamento em runtime serverless. O build usa Webpack explicitamente.

## Server Components e Client Components

As paginas consultam o banco diretamente como Server Components. Interacoes como formularios, modais, toasts e chamadas `fetch` ficam nos componentes client-side. Nao ha uma camada separada de servicos: regras de dominio puras vivem em `src/lib`, enquanto varias orquestracoes transacionais residem nos Route Handlers.

## Protecoes de consistencia observadas

- chaves unicas de idempotencia em ledgers de XP e Dev-Coins;
- restricao unica de uma aula aberta por `Lesson.openSlot`;
- um destinatario, envio e premio por aluno/atividade;
- uma compra por aluno/avatar;
- transacoes `Serializable` com ate tres tentativas nas compras concorrentes;
- comparacao de taxa esperada antes da conversao de XP em Dev-Coins;
- verificacao de senha administrativa para acoes em massa e arquivamento;
- verificacao da senha do professor para ligar/desligar a area do aluno.
