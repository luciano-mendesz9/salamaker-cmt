# F0003 — Ludo Maker multiplayer em tempo real

Data: 30 de setembro de 2026  
Branch: `codex/ludo-maker`  
Estado: implementado no codigo; migration, Redis, deploy e validacao humana autenticada pendentes

## Objetivo

Adicionar `Mini games` a area do aluno e disponibilizar o Ludo Maker, uma implementacao visual propria, tematica de robotica e inspirada nas regras tradicionais do Ludo. Nomes, artes e interface do Ludo Club nao sao copiados.

## Entrada e salas

- cada sala custa 50 Dev-Coins ao criador no momento da abertura; a taxa e irreversivel e vai para a tesouraria;
- a aposta do criador e bloqueada em custodia na abertura e devolvida se a sala for cancelada antes de iniciar;
- salas entre alunos aceitam apostas inteiras de 10 a 100 DC por participante;
- todos os participantes bloqueiam a mesma aposta ao entrar;
- a sala aceita no maximo quatro jogadores e fecha novas entradas depois do inicio;
- o dono inicia com no minimo duas pessoas e paga 100 XP somente nesse momento;
- o codigo tem seis caracteres e o link compartilhavel apenas preenche esse codigo; autenticacao e saldo continuam obrigatorios;
- cada aluno pode participar de apenas uma sala aguardando, ativa ou pausada por vez.

## Partida contra a IA

- a aposta e sempre 50 DC para o aluno e 50 DC para a IA;
- a tesouraria precisa possuir os 50 DC da IA antes da abertura;
- a contribuicao da IA e transferida para a custodia e retorna pela liquidacao normal;
- a interface informa explicitamente: `Ha mais chances da IA do professor ganhar`;
- no servidor, 80% das salas contra IA recebem o perfil favorecido e 20% recebem o perfil desfavorecido; o perfil nao e exposto durante a partida;
- o perfil favorecido escolhe, em 90% dos turnos, o numero que maximiza captura, chegada, saida e progresso; o desfavorecido escolhe o pior numero nessa mesma proporcao;
- sorteios de alunos e do robo temporario de desconexao permanecem uniformes de 1 a 6.

Essa regra produz a meta de aproximadamente 80% de vitorias da IA em simulacoes do motor. Nao e apresentada como sorteio justo da IA.

## Regras do tabuleiro

- dois a quatro jogadores, quatro pecas por cor;
- cores vermelha, verde, amarela e azul;
- uma peca sai da base somente com 6;
- e necessario chegar ao destino com numero exato;
- 6, captura e chegada concedem jogada extra;
- tres numeros 6 consecutivos encerram a vez sem usar o terceiro;
- casas iniciais e casas com estrela sao seguras;
- duas pecas da mesma cor na mesma casa formam bloqueio para adversarios;
- capturas fora de casas seguras devolvem a peca adversaria a base;
- a partida continua ate definir todas as colocacoes.

## Relogio, desconexao e pausa

- o aluno tem dez segundos para sortear um numero;
- depois do sorteio, tem dez segundos para escolher uma jogada valida;
- ao esgotar o prazo, o servidor sorteia ou escolhe automaticamente;
- quando o aluno desconecta, um robo de sorteios uniformes joga por ele durante ate tres minutos;
- retorno dentro do prazo devolve o controle imediatamente;
- apos tres minutos, o aluno desiste automaticamente, mantem a aposta no pote e perde 100 XP;
- qualquer desistente perde 100 XP adicionais, mesmo que o saldo fique negativo;
- o dono pode pausar unilateralmente e, se desistir, a propriedade passa a outro jogador ativo;
- em partidas com exatamente dois jogadores, tres pedidos de pausa do outro participante pausam a partida;
- partidas pausadas permanecem no historico e podem ser retomadas pelo dono.

## Liquidacao

O pote e a soma das apostas, separado dos saldos pessoais e da tesouraria ate a liquidacao.

| Participantes | 1o lugar | 2o lugar | Tesouraria |
|---|---:|---:|---:|
| 2 | 80% | 0% | restante, normalmente 20% |
| 3 ou 4 | 60% | 20% | restante, normalmente 20% |

Percentuais sao arredondados para baixo. Toda sobra vai para a tesouraria.

| Participantes | Regra de XP por colocacao |
|---|---|
| 2 | ultimo: -100 XP |
| 3 | ultimo: -100 XP |
| 4 | terceiro: +50 XP; ultimo: -100 XP |

A penalidade por colocacao acumula com os -100 XP da desistência. Creditos e debitos usam chaves idempotentes e registros nos ledgers de XP, Dev-Coin, tesouraria e auditoria.

## Convites e presenca

- a presenca em tempo real usa Redis com expiracao de 45 segundos;
- somente o dono convida alunos online;
- o primeiro convite para uma pessoa compra um pacote de cinco tentativas por 10 XP;
- a sexta tentativa compra outro pacote de cinco por mais 10 XP;
- nao ha nova cobranca enquanto um convite ainda esta pendente;
- o convidado pode aceitar, recusar ou recusar e bloquear notificacoes daquela pessoa por dez minutos;
- o bloqueio nao impede entrada por codigo ou link;
- aceitar exige vaga e saldo no momento da transacao.

## Chat

O chat aceita somente mensagens e reacoes predefinidas. Eventos sao publicados pelo Redis/WebSocket e nao sao gravados no PostgreSQL. O servidor valida participacao na sala e limita um envio por segundo em cada conexao.

## Arquitetura em tempo real

- Next.js 16 usa `experimental_upgradeWebSocket` de `@vercel/functions`;
- a Vercel exige Fluid Compute para WebSockets;
- Redis compartilha presenca, convites, chat e invalidacao de sala entre instancias;
- Neon/PostgreSQL e a autoridade para tabuleiro, turnos, custodia, colocacoes e ledgers;
- comandos financeiros e de jogo usam transacoes Serializable, repeticao de `P2034` e chaves idempotentes;
- clientes reconectam, reassinam a sala e recarregam o estado persistente;
- HTTP continua sendo o canal autoritativo das mutacoes; WebSocket distribui eventos.

## Variaveis e ativacao

- `REDIS_URL` ou `KV_URL`: URL de um Redis compativel com TLS;
- Fluid Compute deve estar habilitado no projeto Vercel;
- a migration `20260930150000_add_ludo_maker` deve ser aplicada antes de expor as paginas;
- a tesouraria precisa existir e ter saldo suficiente para partidas contra IA.

## Validacao obrigatoria antes de producao

1. aplicar a migration somente com autorizacao e reconciliar saldos de alunos, tesouraria e custodia;
2. provisionar Redis e confirmar pub/sub em duas instancias distintas;
3. testar dois, tres e quatro navegadores autenticados;
4. testar convite, bloqueio, sala cheia, saldo insuficiente e corrida de entradas;
5. testar todos os rateios, arredondamentos, desistencias e XP negativo;
6. interromper uma conexao por menos e por mais de tres minutos;
7. validar pausa, troca de dono, retomada e deploy durante uma partida;
8. acompanhar os resultados contra IA e recalibrar somente se a taxa observada divergir da meta;
9. executar revisao visual mobile, teclado e leitores de tela.

## Evidencia tecnica local

- schema Prisma validado;
- testes do motor, rateio, casas seguras, bloqueio e XP incluidos em `src/lib/ludo-rules.test.ts`;
- build Next.js, typecheck e lint devem permanecer verdes no checkpoint de publicacao;
- nenhuma migration foi aplicada ao Neon e nenhum deploy foi realizado por este documento.
