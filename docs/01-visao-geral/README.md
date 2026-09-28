# Visao geral

## O que e o projeto

O Sala Maker CMT e uma aplicacao web para uma unica turma de Robotica formada por estudantes do 6º e 7º ano. A turma escolar regular (`6º A` a `7º C`) e apenas uma informacao de origem do aluno: aulas e atividades da Sala Maker usam uma coorte unica de estudantes ativos.

A aplicacao combina:

- check-in publico de presenca;
- contas de professor e aluno;
- aulas com fechamento e atribuicao de XP;
- atividades por link, formulario ou equipe;
- avaliacao de comportamento;
- ranking publico;
- economia persistente de XP e Dev-Coins;
- loja de fotos de perfil;
- notificacoes globais com estado individual;
- cadastro, exportacao e arquivamento de estudantes;
- logs de XP e auditoria administrativa.

## Perfis e superficies

| Superficie | Acesso | Responsabilidade |
|---|---|---|
| Pagina inicial `/` | Publico | Apresentacao e check-in de presenca |
| Ranking `/ranking` | Publico | Classificacao por XP dos alunos ativos |
| Login `/login` | Publico | Autenticacao por codigo e senha |
| Area `/aluno` | Aluno ativo | Jornada, saldos, historicos, atividades, avisos e avatar |
| Area `/professor` | Professor ativo | Operacao da turma e administracao |
| API `/api/student/*` | Aluno autenticado | Acoes limitadas ao proprio aluno |
| API `/api/professor/*` | Professor autenticado | Acoes administrativas e pedagogicas |

## Modulos implementados

### Identidade e acesso

- Codigos anuais sequenciais: `AL<ano><3 digitos>` para alunos e `PROF<ano><4 digitos>` para professores.
- Senhas protegidas com bcrypt.
- Primeiro acesso do aluno exige substituicao da senha temporaria.
- Sessao JWT em cookie HTTP-only; 30 minutos para aluno e 30 dias para professor.
- `sessionVersion` invalida sessoes antigas em redefinicao de senha ou arquivamento.

### Turma e aulas

- So pode existir uma aula aberta no slot `ROBOTICS`.
- A abertura captura uma fotografia dos alunos ativos em `LessonParticipant`.
- O check-in exige codigo do aluno e codigo de seis digitos da aula.
- O fechamento classifica cada participante como presente, ausente ou justificado e aplica XP.

### Atividades

- Link externo com confirmacao do aluno e correcao do professor.
- Formulario com questoes objetivas e escritas.
- Trabalho em equipe com divisao aleatoria equilibrada ou manual.
- Agendamento, fechamento manual e reabertura com novo prazo.
- Publicacao automatica de notificacao na caixa de entrada e pop-up.

### Progresso e economia

- Saldo materializado de XP no usuario e livro-razao em `XpEntry`.
- Dev-Coins com saldo em `User.devCoins` e historico em `DevCoinEntry`.
- Conversao configuravel em “quantos Dev-Coins valem 1 XP”.
- Fotos de perfil pagas por 20 Dev-Coins, com compra unica e reutilizacao sem nova cobranca.

### Comunicacao e auditoria

- Avisos `INBOX` persistem na caixa de entrada.
- Avisos `POPUP` possuem validade, exibicao diaria e dispensa individual.
- Operacoes relevantes produzem `AuditLog`; movimentacoes financeiras possuem seus proprios ledgers.

## Limites do escopo atual

- O produto assume uma unica turma de Robotica; nao ha separacao de operacao por turma escolar de origem.
- Nao existe recuperacao automatica de senha; o aluno deve procurar o professor.
- O modelo `CleanupAssignment` e exibido nos detalhes de aula, mas nao foi encontrado um fluxo de criacao/confirmacao na interface ou API atual.
- `RateLimitBucket` esta no schema, mas nao foi encontrada integracao ativa de rate limiting.
- `lastSeenAt` e atualizado no login, nao por atividade continua; portanto o indicador “online” do painel e apenas uma aproximacao baseada no ultimo login.
- A documentacao foi derivada do codigo local; estado e dados atuais do Neon/Vercel nao foram consultados nesta analise.
