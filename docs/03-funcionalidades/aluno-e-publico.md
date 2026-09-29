# Funcionalidades do aluno e paginas publicas

## Pagina inicial e presenca

A pagina `/` e publica. O check-in pede:

- codigo de acesso do aluno;
- codigo de seis digitos da aula aberta.

A API rejeita aluno inativo, aula/codigo invalido, aluno fora da fotografia de participantes, presenca duplicada e tentativa durante bloqueio da area do aluno. O check-in nao concede XP imediatamente; o fechamento da aula define a situacao final e aplica o delta.

## Login e primeiro acesso

O aluno entra com codigo e senha. Se estiver com `mustChangePassword`, e direcionado exclusivamente a `/aluno/trocar-senha`. A nova senha deve ter entre 8 e 72 caracteres, nao pode ser igual a senha temporaria conhecida e precisa ser confirmada.

De segunda a sabado, o primeiro login do dia escolar concede 10 XP. Domingo nao e elegivel. A chave `daily-login:<studentId>:<data>` impede repeticao.

## Painel do aluno

O painel `/aluno` apresenta:

- XP atual e posicao no ranking;
- frequencia calculada sobre aulas fechadas das quais o aluno participou;
- saldo, compra e historico de Dev-Coins;
- transferencia de Dev-Coins para outro aluno ativo;
- seis movimentacoes recentes de XP;
- oito movimentacoes recentes de Dev-Coins;
- oito avaliacoes recentes de comportamento;
- contador de notificacoes nao lidas;
- acesso as atividades;
- cartao do Tinkercad com link da turma e copia do codigo do aluno;
- edicao da foto de perfil.

## Dev-Coins

O aluno escolhe quanto XP deseja trocar. A quantidade recebida e:

```text
Dev-Coins recebidos = XP gasto × Dev-Coins por XP
```

A compra confirma a taxa vista pela interface e a senha atual, valida saldo dentro de transacao serializavel, debita XP e credita Dev-Coins com dois lancamentos vinculados.

O aluno tambem pode transferir DC para um colega ativo. Cada operacao custa 5 XP e o total enviado pelo remetente e limitado a 300 DC por semana escolar. O destinatario, o saldo, o teto semanal e a senha sao revalidados no servidor.

## Fotos de perfil

Existem a foto gratuita `default` e 40 opcoes locais (`001` a `040`). Cada foto paga custa 20 Dev-Coins.

- A API aceita apenas chaves da lista local.
- A primeira aplicacao de uma foto paga debita o saldo e registra compra/ledger.
- Uma foto ja comprada pode ser reutilizada sem nova cobranca.
- A foto padrao continua gratuita.
- O avatar aparece na area do aluno e no ranking publico, nao nos paineis do professor.

## Atividades do aluno

O aluno so consulta atividades em que possui `ActivityRecipient`.

- Link externo: abre em nova aba e permite sinalizar realizacao, sem conceder XP automaticamente.
- Formulario: aceita um unico envio; questoes objetivas usam correspondencia exata do gabarito; respostas escritas aguardam professor.
- Grupo: mostra equipe e integrantes; a conclusao e pontuada pelo professor.
- O gabarito das alternativas selecionadas so e revelado depois que a atividade esta fechada.

## Notificacoes

Mensagens `INBOX` ficam em `/aluno/notificacoes`; abrir uma mensagem grava `readAt`. Pop-ups aparecem no maximo uma vez por dia escolar, enquanto validos. A opcao “nao mostrar mais” grava `dismissedAt` apenas para o aluno atual.

## Ranking publico

`/ranking` lista somente alunos ativos, ordenados por:

1. XP decrescente;
2. data de criacao crescente;
3. ID crescente.

O ranking mostra nome completo, turma de origem, XP e avatar. Ele e publico e nao exige login.
