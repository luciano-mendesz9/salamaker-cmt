# Rotas e API

## Paginas

### Publicas

| Rota | Conteudo |
|---|---|
| `/` | Apresentacao e formulario de presenca |
| `/login` | Login por codigo e senha |
| `/ranking` | Ranking publico de alunos ativos |

### Aluno

| Rota | Conteudo |
|---|---|
| `/aluno` | Dashboard, saldos, avatar, historicos e Tinkercad |
| `/aluno/trocar-senha` | Troca obrigatoria da senha temporaria |
| `/aluno/atividades` | Lista de atividades recebidas |
| `/aluno/atividades/[id]` | Execucao e resultado de uma atividade |
| `/aluno/notificacoes` | Caixa de entrada individual |

### Professor

| Rota | Conteudo |
|---|---|
| `/professor` | Visao geral, aula aberta e gestao de alunos |
| `/professor/aulas` | Historico de aulas |
| `/professor/aulas/[id]` | Detalhes de presenca e faxina registrada |
| `/professor/atividades` | Busca, filtros e lista de atividades |
| `/professor/atividades/nova` | Criacao de atividade |
| `/professor/atividades/[id]` | Acompanhamento, estado e correcao |
| `/professor/atividades/[id]/corrigir/[submissionId]` | Correcao de respostas escritas |
| `/professor/comportamento` | Avaliacao por aula fechada |
| `/professor/notificacoes` | Publicacao e exclusao de mensagens |
| `/professor/logs` | Historico de XP e auditoria |
| `/professor/moderacao` | Area do aluno, tema e taxa de Dev-Coins |

## Endpoints de autenticacao e presenca

| Metodo e rota | Entrada principal | Resultado |
|---|---|---|
| `POST /api/auth/login` | `accessCode`, `password` | Cookie, destino e bonus diario opcional |
| `POST /api/auth/logout` | — | Remove cookie e redireciona |
| `POST /api/auth/change-password` | `password`, `confirmation` | Troca senha, invalida sessao e volta ao login |
| `POST /api/presence` | `accessCode`, `lessonCode` | Registra presenca unica em aula aberta |

## Endpoints do aluno

| Metodo e rota | Funcao |
|---|---|
| `POST /api/student/activities/[id]/signal` | Marca link externo como realizado |
| `POST /api/student/activities/[id]/submit` | Envia formulario unico e corrige objetivas |
| `POST /api/student/dev-coins` | Converte XP em Dev-Coins |
| `POST /api/student/dev-coins/transfer` | Transfere DC para outro aluno, cobra 5 XP e aplica teto semanal |
| `POST /api/student/stickers/packs` | Compra pacote mediante senha atual |
| `POST /api/student/stickers/listings/[id]/purchase` | Compra figurinha anunciada mediante senha atual |
| `PATCH /api/student/profile-avatar` | Compra ou seleciona avatar permitido |
| `GET /api/student/notifications/popup` | Retorna pop-ups elegiveis e registra exibicao |
| `PATCH /api/student/notifications/popup` | Dispensa pop-up individualmente |
| `POST /api/student/notifications/[id]/read` | Marca mensagem `INBOX` como lida |

## Endpoints do professor

| Metodo e rota | Funcao |
|---|---|
| `GET/POST /api/professor/students` | Lista ou cria aluno |
| `PATCH/DELETE /api/professor/students/[id]` | Edita ou arquiva aluno |
| `POST /api/professor/students/[id]/reset-password` | Redefine senha temporaria |
| `POST /api/professor/students/bulk` | XP, Dev-Coins ou arquivamento em massa |
| `GET /api/professor/students/export` | Baixa XLSX dos alunos |
| `GET/POST /api/professor/lessons` | Consulta aula aberta ou abre nova aula |
| `POST /api/professor/lessons/[id]/close` | Fecha aula e aplica presenca/XP |
| `POST /api/professor/behavior` | Cria ou corrige avaliacao de comportamento |
| `GET/POST /api/professor/activities` | Lista ou cria atividade |
| `POST /api/professor/activities/[id]/state` | Fecha ou reabre atividade |
| `POST /api/professor/activities/[id]/grade-link` | Pontua atividade por link |
| `POST /api/professor/activities/[id]/submissions/[submissionId]/grade` | Corrige respostas escritas |
| `POST /api/professor/activities/[id]/teams/[teamId]/grade` | Pontua todos os integrantes da equipe |
| `GET/POST /api/professor/notifications` | Lista ou publica notificacao |
| `DELETE /api/professor/notifications/[id]` | Exclui notificacao global |
| `GET/PATCH /api/professor/settings` | Consulta ou altera configuracoes |
| `POST /api/professor/local-assets/stickers` | Prepara WebP e manifesto com colecao/identificadores automaticos no ambiente local |

## Convencoes de resposta

- Entradas invalidas retornam normalmente `400`.
- Ausencia ou expiracao de sessao retorna `401`.
- Papel ou acao proibida retorna `403`.
- Recurso inexistente retorna `404`.
- Duplicidade, saldo/taxa concorrente ou estado invalido retornam `409`.
- A maioria dos erros usa `{ "message": "..." }`; nao existe um envelope unico tipado para toda a API.
