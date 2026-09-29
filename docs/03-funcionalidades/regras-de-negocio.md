# Regras de negocio

## Coorte unica de Robotica

Todos os alunos com `role=STUDENT` e `status=ACTIVE` compoem a coorte. `originSchoolClass` e informativo. Ao abrir uma aula ou criar uma atividade, a aplicacao materializa os destinatarios atuais; alunos cadastrados depois nao entram retroativamente.

## XP

| Evento | Regra |
|---|---|
| Presenca ao fechar aula | +30 XP |
| Ausencia justificada | +10 XP |
| Ausencia sem justificativa | -50 XP |
| Comportamento | -30, -25, -5, +20 ou +30 conforme nota 1–5 |
| Primeiro login do dia | +10 XP, segunda a sabado |
| Atividade | 0 ate o maximo configurado |
| Concessao em massa | Inteiro positivo definido pelo professor |
| Compra de Dev-Coins | Debita a quantidade de XP escolhida |
| Transferencia de Dev-Coins | Debita 5 XP do remetente por transferencia concluida |

O saldo pode ficar negativo em regras como ausencia e comportamento; nao ha limite inferior no schema. Compras, entretanto, exigem saldo suficiente.

## Ledgers e idempotencia

Toda alteracao de XP funcionalmente integrada acompanha um `XpEntry`; Dev-Coins usam `DevCoinEntry`. Chaves idempotentes protegem eventos repetiveis, por exemplo:

- `lesson-close:<lessonId>:<studentId>`;
- `daily-login:<studentId>:<data>`;
- `activity:<activityId>:<studentId>:revision:<n>`;
- `profile-avatar:<studentId>:<avatar>`;
- identificadores de operacao para compras e concessoes em massa.

Correcao de comportamento preserva reversao e substituicao como dois lancamentos. Revisao de atividade registra somente o delta entre a nota antiga e a nova.

## Dev-Coins e avatares

- `AppSetting.devCoinsPerXp` significa quantos Dev-Coins valem 1 XP.
- A taxa deve ser inteira entre 1 e 10.000.
- A interface envia `expectedRate`; mudanca concorrente retorna conflito antes da compra.
- Cada avatar pago custa 20 Dev-Coins.
- `ProfileAvatarPurchase` e unica por aluno e chave do avatar.
- Comprar Dev-Coins, pacotes ou figurinhas do mercado exige a senha atual do aluno.
- Transferencias entre alunos preservam a oferta total e usam dois lancamentos espelhados.
- Cada aluno pode enviar ate 300 DC por semana, de segunda a domingo no fuso escolar.

## Estado de atividades

O estado efetivo nao e armazenado diretamente:

- `SCHEDULED`: instante atual anterior a `opensAt`;
- `OPEN`: dentro do prazo e sem fechamento manual;
- `CLOSED`: `manuallyClosedAt` preenchido ou prazo encerrado.

Formularios sao de envio unico. Questoes de multipla escolha so pontuam quando o conjunto selecionado e exatamente igual ao conjunto correto. Respostas escritas aceitam `CORRECT` com XP integral, `INCORRECT` com zero ou `PARTIAL` estritamente entre zero e o maximo.

## Notificacoes

- `INBOX`: persistente, leitura individual, sem expiracao automatica.
- `POPUP`: exige data futura, expira no fim do dia escolar informado e e limpo oportunisticamente em login/consultas.
- Pop-up exibido grava `lastPopupShownAt`; dispensa permanente individual grava `dismissedAt`.
- Criar atividade cria os dois tipos de notificacao dentro da mesma transacao.

## Datas e fuso

O fuso padrao e `America/Fortaleza`. Datas locais de atividades e validade de pop-up sao convertidas para instantes UTC antes da persistencia. O bonus diario e agrupado por dia escolar nesse fuso.

## Arquivamento

Arquivar muda o status para `INACTIVE`, registra `deactivatedAt` e incrementa `sessionVersion`. O aluno sai da coorte futura e do ranking, mas seus registros historicos permanecem.
