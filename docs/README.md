# Documentacao do Sala Maker CMT

Esta pasta descreve o estado observado no codigo do projeto, atualizado em 29 de setembro de 2026. Ela documenta a aplicacao implementada, suas regras, persistencia, interfaces e limites conhecidos. Evidencias de migration e banco ficam registradas nos documentos especificos e nao substituem validacao humana dos fluxos autenticados.

## Como navegar

1. [Visao geral](./01-visao-geral/README.md) — objetivo, perfis, modulos e mapa funcional.
2. [Arquitetura](./02-arquitetura/README.md) — stack, camadas, autenticacao e organizacao do codigo.
3. [Modelo de dados](./02-arquitetura/modelo-de-dados.md) — entidades Prisma, relacionamentos e historicos.
4. [Area do professor](./03-funcionalidades/professor.md) — gestao da turma, aulas, atividades e moderacao.
5. [Area do aluno e paginas publicas](./03-funcionalidades/aluno-e-publico.md) — jornada do aluno, presenca e ranking.
6. [Regras de negocio](./03-funcionalidades/regras-de-negocio.md) — XP, Dev-Coins, atividades, notificacoes e idempotencia.
7. [Rotas e API](./04-referencia/rotas-e-api.md) — paginas e endpoints existentes.
8. [Configuracao e scripts](./04-referencia/configuracao-e-scripts.md) — ambiente, comandos e utilitarios.
9. [Banco, migracoes e deploy](./05-operacao/banco-migracoes-e-deploy.md) — Prisma/Neon e operacao segura.
10. [Testes e lacunas](./06-qualidade/testes-e-lacunas.md) — cobertura observada, limites e validacoes recomendadas.
11. [Pedidos de implementacao](./07-pedidos-de-implementacao/README.md) — especificacoes funcionais ainda nao implementadas.
12. [Transferencias de Dev-Coins e confirmacao por senha](./03-funcionalidades/transferencias-devcoin-e-confirmacao-por-senha.md) — taxa, teto semanal, ledgers e autorizacao.
13. [Cadastro simplificado de figurinhas](./03-funcionalidades/cadastro-simplificado-de-figurinhas.md) — colecoes selecionaveis e identificadores automaticos.
14. [F0003 — Ludo Maker](./07-pedidos-de-implementacao/F0003-ludo-maker-multiplayer-em-tempo-real-2026-09-30.md) — regras, economia, IA, WebSocket e criterios de ativacao.

## Hierarquia

```text
docs/
├── README.md
├── 01-visao-geral/
│   └── README.md
├── 02-arquitetura/
│   ├── README.md
│   └── modelo-de-dados.md
├── 03-funcionalidades/
│   ├── aluno-e-publico.md
│   ├── cadastro-simplificado-de-figurinhas.md
│   ├── professor.md
│   ├── regras-de-negocio.md
│   └── transferencias-devcoin-e-confirmacao-por-senha.md
├── 04-referencia/
│   ├── configuracao-e-scripts.md
│   └── rotas-e-api.md
├── 05-operacao/
│   └── banco-migracoes-e-deploy.md
├── 06-qualidade/
│   └── testes-e-lacunas.md
└── 07-pedidos-de-implementacao/
    ├── README.md
    ├── F0001-album-de-figurinhas-e-economia-devcoin-2026-09-27.md
    └── F0002-gerenciador-local-de-imagens-2026-09-27.md
```

## Fontes analisadas

- `src/app`, incluindo paginas e Route Handlers;
- `src/components` e `src/lib`;
- `prisma/schema.prisma` e as migracoes versionadas;
- `scripts`, `package.json`, configuracoes do Next.js, TypeScript e Prisma;
- estado Git local da branch `main` no momento da atualizacao documental.

Segredos do arquivo `.env` nao foram lidos nem reproduzidos; somente os nomes das variaveis foram inventariados.
