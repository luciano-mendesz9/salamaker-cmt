# Modelo de dados

O schema canonico esta em `prisma/schema.prisma`. Os saldos de XP e Dev-Coins ficam materializados em `User` para leitura rapida, enquanto `XpEntry` e `DevCoinEntry` preservam a historia das movimentacoes.

## Mapa por agregado

### Identidade

| Modelo | Papel |
|---|---|
| `User` | Professor ou aluno, credenciais, status, saldos, avatar e dados de sessao |
| `AccessCodeSequence` | Sequencia anual usada na emissao de codigos de acesso |
| `AppSetting` | Registro singleton de moderacao, tema, fuso e taxa de Dev-Coins |
| `AuditLog` | Eventos administrativos com ator, alvo e detalhes JSON |
| `RateLimitBucket` | Estrutura para contagem por janela; sem uso ativo encontrado |

`User.originSchoolClass` registra a turma regular de origem e nao particiona a turma de Robotica.

### Aulas

| Modelo | Papel |
|---|---|
| `Lesson` | Aula aberta ou fechada, professor e hash do codigo de presenca |
| `LessonParticipant` | Fotografia dos alunos elegiveis na abertura da aula |
| `Attendance` | Estado final `PRESENT`, `ABSENT` ou `EXCUSED` por participante |
| `BehaviorRating` | Nota de comportamento por aluno/aula e lancamento de XP vigente |
| `CleanupAssignment` | Confirmacao de faxina por aula; modelada e lida, sem escrita ativa encontrada |

### Economia e progresso

| Modelo | Papel |
|---|---|
| `XpEntry` | Ledger imutavel de deltas de XP com origem e chave idempotente |
| `DevCoinEntry` | Ledger de Dev-Coins, opcionalmente ligado ao gasto de XP |
| `ProfileAvatarPurchase` | Prova de compra unica de uma foto por aluno |

Origens de XP: presenca, comportamento, manual/em massa, sistema, atividade, avatar legado e compra de Dev-Coins. Origens de Dev-Coin: compra, concessao do professor, concessao inicial e compra de avatar.

### Atividades

| Modelo | Papel |
|---|---|
| `Activity` | Cabecalho, tipo, prazos, XP maximo e autor |
| `ActivityRecipient` | Vinculo individual de cada aluno com a atividade |
| `ActivityQuestion` / `ActivityOption` | Questoes, alternativas, gabarito e peso |
| `ActivitySubmission` | Envio unico do formulario pelo aluno |
| `ActivityAnswer` / `ActivityAnswerOption` | Respostas e resultado da correcao |
| `ActivityTeam` / `ActivityTeamMember` | Equipes e seus participantes |
| `ActivityAward` | Nota vigente do aluno na atividade, revisao e ultimo lancamento de XP |

`ActivityAward.revision` permite corrigir notas aplicando apenas o delta entre o valor anterior e o novo. Cada revisao gera um novo `XpEntry` rastreavel.

### Notificacoes

| Modelo | Papel |
|---|---|
| `Notification` | Conteudo global `INBOX` ou `POPUP`, opcionalmente ligado a atividade |
| `NotificationReceipt` | Estado individual: leitura, dispensa e ultima exibicao do pop-up |

O conteudo e global, mas o estado de leitura/dispensa pertence a cada estudante. Excluir a notificacao remove seus recibos por cascata.

## Relacionamentos essenciais

```text
User (professor) ──< Lesson ──< LessonParticipant >── User (aluno)
                         └────< Attendance >─────────┘
                         └────< BehaviorRating >─────┘

User (professor) ──< Activity ──< ActivityRecipient >── User (aluno)
                          ├─────< ActivityQuestion ──< ActivityOption
                          ├─────< ActivitySubmission ──< ActivityAnswer
                          ├─────< ActivityTeam ──< ActivityTeamMember
                          └─────< ActivityAward >──────── User (aluno)

User (aluno) ──< XpEntry
             └─< DevCoinEntry
             └─< ProfileAvatarPurchase

Notification ──< NotificationReceipt >── User (aluno)
```

## Exclusao e preservacao historica

O fluxo de produto arquiva alunos alterando `status` para `INACTIVE`; nao os apaga. A maior parte das relacoes historicas usa `onDelete: Restrict`, preservando aulas, lancamentos e correcoes. Notificacoes e suas estruturas dependentes usam cascata onde o produto permite exclusao global.
