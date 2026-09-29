# Funcionalidades do professor

Todas as paginas em `/professor` exigem um professor ativo e uma sessao cuja versao ainda corresponda ao banco.

## Visao geral e alunos

O painel mostra quantidade de alunos ativos, aulas fechadas e soma dos saldos de XP. Nele o professor pode:

- cadastrar aluno com nome, sobrenome e turma regular de origem;
- receber um codigo `AL<ano><sequencia>` e senha temporaria padrao;
- editar nome, sobrenome e turma de origem;
- redefinir a senha e forcar nova troca no proximo acesso;
- arquivar um aluno individualmente;
- selecionar alunos ativos e conceder XP ou Dev-Coins em massa;
- arquivar uma selecao em massa;
- exportar todos os alunos para XLSX;
- consultar saldo, status, datas e estado aproximado de acesso.

Acoes em massa, arquivamento e concessoes exigem `ADMIN_ACTION_PASSWORD`. A API valida a senha no servidor e registra historico aplicavel.

## Aulas e presenca

O professor abre uma aula para todos os alunos ativos. A aplicacao:

1. impede uma segunda aula simultanea;
2. gera um codigo numerico de seis digitos e armazena somente seu hash;
3. registra os participantes elegiveis naquele instante;
4. aceita check-ins publicos apenas desses participantes;
5. permite revisar ausencias justificadas antes do fechamento;
6. fecha a aula uma unica vez e aplica XP a todos os participantes.

O historico em `/professor/aulas` mostra presencas por aula e a pagina de detalhe separa presentes, ausentes, justificados e faxina confirmada. O ultimo grupo e somente leitura no estado atual do codigo.

## Atividades

O professor pode criar tres tipos:

- `EXTERNAL_LINK`: URL HTTPS, XP maximo e confirmacao do aluno; o professor atribui a nota.
- `FORM`: questoes de escolha unica, multipla ou resposta escrita; objetivas sao corrigidas automaticamente e escritas aguardam revisao.
- `GROUP`: equipes manuais ou aleatorias equilibradas; a nota e aplicada a cada integrante.

Toda atividade e destinada a todos os alunos ativos da coorte de Robotica. O professor pode buscar e filtrar por tipo/estado, fechar manualmente, reabrir com novo prazo e revisar pontuacoes. Uma revisao de nota movimenta somente a diferenca de XP.

## Comportamento

A avaliacao so pode ser lancada para participante de aula fechada:

| Nota | Delta de XP |
|---:|---:|
| 1 | -30 |
| 2 | -25 |
| 3 | -5 |
| 4 | +20 |
| 5 | +30 |

Uma correcao cria um lancamento que reverte o valor anterior e outro com o novo valor, mantendo o historico auditavel.

## Notificacoes

O professor publica:

- mensagens de caixa de entrada, sem expiracao automatica;
- pop-ups com data final obrigatoria.

Atividades criam automaticamente uma notificacao de cada tipo na mesma transacao. O professor pode excluir a mensagem global para todos os alunos. A criacao e auditada.

## Moderacao e tema

Em `/professor/moderacao`, o professor pode:

- escolher uma das seis cores de destaque permitidas;
- ativar ou desativar a area autenticada dos alunos, confirmando sua propria senha;
- definir quantos Dev-Coins correspondem a 1 XP, entre 1 e 10.000.

Desativar a area do aluno bloqueia as paginas autenticadas e o check-in publico, mas nao desativa contas nem altera historicos.

## Midias locais

O cadastro local de figurinhas usa um seletor de colecao. O professor escolhe uma pasta existente ou cria uma nova pelo nome; slug, pasta, numero e caminhos sao gerados no servidor. Nome, descricao, texto alternativo, quantidade e direitos de uso continuam obrigatorios. Preparar arquivos nao ativa estoque no banco.

## Logs

O painel exibe ate 200 lancamentos recentes de XP e 200 eventos administrativos recentes. Senhas, hashes e tokens nao sao gravados nesses logs. O ledger de Dev-Coins existe no banco e aparece ao aluno, mas a tela geral de logs do professor consulta apenas `XpEntry` e `AuditLog`.
