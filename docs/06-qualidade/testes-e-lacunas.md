# Testes, validacao e lacunas

## Testes automatizados existentes

O comando `npm test` executa tres arquivos com 14 casos:

### Atividades

- estado efetivo por prazo/fechamento;
- gabarito objetivo por conjunto exato;
- regras de nota escrita;
- equipes equilibradas e sem duplicacao;
- isolamento entre destinatarios;
- rejeicao de envio duplicado;
- delta em revisao de nota;
- premio individual de equipe;
- conversao de horario escolar para UTC;
- inclusao de alunos ativos de qualquer turma regular.

### Avatar e Dev-Coins

- preco de 20 Dev-Coins para todos os avatares pagos;
- valores padrao e custo de compra.

### Dia escolar

- bonus diario de segunda a sabado em Fortaleza;
- encerramento de pop-up na virada do dia seguinte.

## Comandos de qualidade disponiveis

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Build e typecheck devem ser executados sequencialmente, pois ambos dependem dos artefatos de tipos do Next.js. Alteracoes no schema exigem `npm run db:generate` antes da validacao.

## Lacunas observadas

| Area | Estado observado | Risco ou proximo teste |
|---|---|---|
| APIs | Sem testes de integracao no repositorio | Validar autorizacao, codigos HTTP e transacoes em banco isolado |
| Autenticacao | Sem E2E automatizado | Testar expiracao, papeis, troca de senha e invalidacao por versao |
| Concorrencia | Retry implementado em compras | Simular compras simultaneas e confirmar saldo/ledger |
| Interface | Sem teste de navegador | Validar teclado, foco, modal, mobile e leitor de tela |
| Banco remoto | Nao consultado nesta analise | Conferir status real das dez migracoes no destino autorizado |
| Deploy | Nao verificado nesta analise | Executar smoke test no runtime publicado |
| Faxina | Modelo e leitura, sem escrita encontrada | Decidir se o fluxo sera implementado ou removido da interface/schema |
| Rate limiting | Modelo sem uso encontrado | Implementar middleware/servico ou remover estrutura morta |
| Presenca online | `lastSeenAt` muda apenas no login | Renomear indicador ou criar heartbeat autorizado |
| Logs do professor | DevCoin ledger fora da tela geral | Avaliar se o professor precisa de visibilidade consolidada |

## Roteiro manual minimo

1. Criar um aluno e confirmar codigo/senha temporaria.
2. Fazer primeiro login, trocar senha e validar sessao de 30 minutos.
3. Abrir aula, marcar presenca publica, fechar e conferir `User.xp` + `XpEntry`.
4. Criar cada tipo de atividade, concluir como aluno e corrigir como professor.
5. Revisar uma nota e confirmar que somente o delta alterou o saldo.
6. Publicar `INBOX` e `POPUP`; testar leitura, exibicao diaria e dispensa individual.
7. Trocar XP por Dev-Coins e confirmar os dois ledgers.
8. Comprar avatar, reutiliza-lo sem nova cobranca e conferir o ranking.
9. Conceder Dev-Coins em massa com motivo e senha administrativa.
10. Arquivar aluno e confirmar remocao do ranking, bloqueio de login e preservacao historica.

## Criterio de evidencia

Os testes puros comprovam regras isoladas. Typecheck e build comprovam compilacao. Nenhum deles, sozinho, comprova persistencia no Neon, configuracao da Vercel, comportamento do navegador, acessibilidade ou integridade dos dados reais. Registre cada camada de validacao separadamente.
