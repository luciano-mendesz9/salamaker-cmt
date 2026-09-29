# Banco, migracoes e deploy

## Fonte de verdade

- Modelo atual: `prisma/schema.prisma`.
- Historico versionado: `prisma/migrations/*/migration.sql`.
- Configuracao Prisma: `prisma.config.ts`, que le `DATABASE_URL`.
- Client gerado: `src/generated/prisma`.

## Historico de migracoes

| Migracao | Alteracao principal |
|---|---|
| `20260922233949_init` | Usuarios, aulas, presenca, XP, comportamento, faxina, configuracao, auditoria |
| `20260922235750_add_password_change_requirement` | Troca obrigatoria de senha |
| `20260923000100_enforce_single_open_lesson` | Slot unico de aula aberta |
| `20260923090000_add_activities` | Atividades, formularios, equipes, envios e premios |
| `20260923110000_single_robotics_cohort` | Coorte unica e fotografia de participantes |
| `20260924010000_add_notifications_and_daily_login_xp` | Notificacoes e recibos individuais |
| `20260924030000_add_student_profile_avatar` | Avatar no usuario |
| `20260924040000_add_profile_avatar_purchases` | Historico de compra de avatar |
| `20260924210000_add_dev_coins` | Saldo/ledger de Dev-Coins e migracao de compras |
| `20260924230000_invert_dev_coin_rate` | Semantica `devCoinsPerXp` |
| `20260928120000_add_sticker_album_and_treasury` | Album, mercado, estoque, patentes e tesouraria |
| `20260928150000_add_sticker_market_switch` | Chave administrativa de compra e venda |
| `20260929210000_add_student_dev_coin_transfers` | Transferencias entre alunos, taxa de XP e trilha auditavel |

## Procedimento seguro de alteracao

1. Confirme branch, worktree e alteracoes locais.
2. Confirme qual `DATABASE_URL` esta ativa sem imprimir seu valor.
3. Altere `schema.prisma` e gere uma migracao revisavel em ambiente de desenvolvimento.
4. Leia o SQL gerado, especialmente `DROP`, renomes, defaults e backfills.
5. Execute `npm run db:generate` apos mudancas no schema.
6. Rode testes, typecheck e build sequencialmente.
7. Antes de `db:deploy`, consulte o status das migracoes no destino correto.
8. Aplique somente com autorizacao para escrita e confirme o status novamente.
9. Para mudancas de saldo ou historico, faca verificacao independente dos totais e ledgers.

## Consistencia operacional

- Nao altere diretamente `User.xp` ou `User.devCoins` sem o ledger correspondente.
- Nao apague historicos para corrigir saldo; registre reversao ou revisao conforme o fluxo existente.
- Nao reutilize uma chave idempotente para eventos distintos.
- Nao transforme `originSchoolClass` em filtro de coorte sem uma decisao de produto explicita.
- Nao execute reset, importacao ou limpeza no Neon sem autorizacao e identificacao inequivoca do destino.

## Deploy da aplicacao

A configuracao e adequada a um runtime Node/serverless com Neon:

- `ws` permanece externo ao bundle do servidor;
- Prisma usa o adaptador Neon;
- `postinstall` gera o client;
- `npm run build` usa `next build --webpack`.

Um build verde nao comprova que a URL do banco, segredos, migracoes e fluxos autenticados estejam corretos no ambiente publicado. Depois do deploy, valide separadamente login de professor/aluno, check-in, leitura e escrita no banco, e ao menos uma operacao reversivel de cada fluxo critico.

## Evidencia de 29 de setembro de 2026

A migration `20260929210000_add_student_dev_coin_transfers` foi aplicada ao Neon configurado no checkout. A verificacao posterior informou `Database schema is up to date!`; a reconciliacao encontrou `19.998 DC` tanto nos saldos dos 25 alunos quanto no ledger. Dois ensaios transacionais de transferencia foram obrigatoriamente revertidos e confirmaram zero registros residuais. Essas evidencias sao pontuais e nao substituem monitoramento nem teste humano autenticado no deploy.
