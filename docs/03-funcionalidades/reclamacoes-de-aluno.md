# Reclamações

## Aluno

O início da área do aluno mostra um gráfico com as reclamações ativas **recebidas pelo próprio aluno** em cada dia da semana escolar, de segunda a domingo, no fuso da escola. Ao lado ficam os botões "Reclamar de Aluno" e "Ranking de reclamações". O envio exige aula aberta e presença `PRESENT` do autor nessa aula.

No formulário, a primeira opção é "RECLAMAÇÃO DO PROFESSOR", referente ao professor da aula atual. Ela é gratuita e limitada a uma por aluno em cada aula. Em seguida aparecem os colegas ativos em ordem alfabética. Para cada colega, o mesmo autor pode registrar até três reclamações na aula, pagando, respectivamente, **2, 5 e 10 DevCoins**. O valor da próxima reclamação aparece antes do envio e é conferido novamente pelo servidor. O motivo tem de 10 a 2.000 caracteres. O formulário identifica a aula atual.

O aluno citado não vê o autor nem o motivo. O aluno só vê as contagens recebidas e o ranking; também não vê os relatos sobre professores. Apenas o professor pode ler a identidade do autor e o texto do relato. Repetir a mesma requisição não cria outra reclamação nem cobra outra taxa.

O ranking mensal inclui os alunos ativos, mesmo com zero reclamações. Exibe posição, foto de perfil, turma e quantidade de reclamações ativas recebidas. Para os outros alunos, o rótulo é "Aluno do <turma>"; o nome completo aparece **somente na linha do próprio usuário logado**, destacada com "Você". O ranking não expõe autor ou motivo. Uma reclamação não prova o fato. Relatos sobre professores não entram no ranking nem no gráfico de alunos.

## Professor

`/professor/reclamacoes` mostra totais, inclusive um cartão para abrir as reclamações ativas sobre professores. Há busca por autor, pessoa citada ou aula, filtro por alvo (aluno/professor), filtro por estado e paginação de 50 registros. Cada registro apresenta aula, pessoa citada, autor, horário, ordem e custo da reclamação quando houver, além do motivo. O professor pode revogar com justificativa. A revogação registra professor e horário, remove o relato das contagens públicas e mantém histórico, justificativa e custo para auditoria.

## Regras no servidor

O servidor revalida sessão de aluno ativo, origem, limite de tentativas, aula ainda aberta, identidade da aula, presença, alvo e saldo. Conta **todos** os envios anteriores do mesmo autor sobre o mesmo alvo na aula, inclusive revogados, para aplicar o limite e o próximo preço. A revogação não devolve DevCoins nem libera um novo envio. Relatos sobre professores usam o professor da aula atual como alvo e não geram débito.

O débito, o lançamento no extrato, o crédito na tesouraria, o relato e o log de auditoria de uma reclamação paga são gravados em transação serializável. Reclamações gratuitas também são registradas com log. O servidor impõe ordem máxima 3 para aluno e 1 para professor por autor/aula/alvo. O painel do professor é protegido por autorização de professor.

O reajuste mensal de XP atualiza `ComplaintCycle.resetAt` **na mesma transação** em que aplica o XP. As contagens do gráfico e do ranking usam apenas reclamações posteriores ao último reajuste e dentro da semana ou mês escolar. Registros antigos não são apagados.

A implantação exige as migrações `20261110120000_add_cpp_delivery_activity`, `20261110130000_add_student_complaints` e `20261110140000_expand_student_complaint_targets`, nessa ordem. A geração do cliente Prisma e os testes locais não aplicam migrações ao banco.
