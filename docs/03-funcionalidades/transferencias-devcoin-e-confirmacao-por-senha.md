# Transferencias de Dev-Coins e confirmacao por senha

Estado: implementado no codigo da `main` em 29 de setembro de 2026. A disponibilidade em producao depende da migration `20260929210000_add_student_dev_coin_transfers` e do deploy correspondente.

## Transferencia entre alunos

Um aluno autenticado pode escolher outro aluno ativo e transferir uma quantidade inteira positiva de Dev-Coins. A operacao exige a senha atual do remetente.

Regras:

- remetente e destinatario devem ser alunos ativos e diferentes;
- o remetente precisa ter as Dev-Coins enviadas e pelo menos 5 XP;
- cada transferencia debita 5 XP do remetente;
- cada remetente pode enviar no maximo 300 DC por semana escolar;
- a semana vai de segunda a domingo no fuso `America/Fortaleza`;
- recebimentos nao consomem o limite do destinatario;
- a transferencia nao movimenta a tesouraria e nao altera a oferta total de DC;
- uma chave de requisicao gerada pelo navegador torna repeticoes seguras;
- conflitos concorrentes sao repetidos dentro de transacao serializavel.

## Persistencia e auditoria

`DevCoinTransfer` liga o remetente, destinatario, valor, semana, taxa de XP e os tres lancamentos que comprovam a operacao:

1. `DevCoinEntry` negativo do remetente (`TRANSFER_SENT`);
2. `DevCoinEntry` positivo do destinatario (`TRANSFER_RECEIVED`);
3. `XpEntry` de `-5` (`DEV_COIN_TRANSFER`).

O evento `DEV_COIN_TRANSFERRED` registra IDs, valor, taxa e semana no `AuditLog`. O saldo materializado e os ledgers sao alterados na mesma transacao.

## Confirmacao de compras

A senha atual do aluno tambem e obrigatoria antes de:

- converter XP em Dev-Coins;
- abrir um Pacote Maker;
- comprar uma figurinha anunciada por outro aluno.

A senha e comparada ao hash no servidor e nunca e armazenada em ledger, auditoria ou resposta. Tentativas passam pelo rate limit existente.

## Limites e mensagens

O servidor e a autoridade para saldo, teto semanal, identidade do destinatario e senha. A interface antecipa os limites para orientar o aluno, mas uma mudanca concorrente retorna conflito sem movimentacao parcial.
