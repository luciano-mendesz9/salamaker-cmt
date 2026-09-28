# F0001 — Album de figurinhas e economia Dev-Coin

## Identificacao

| Campo | Valor |
|---|---|
| ID | F0001 |
| Data | 2026-09-27 |
| Estado | Implementado no codigo em `codex/f001-f002-sticker-album`; migration de producao nao aplicada |
| Publico | Alunos e professores da Sala Maker |
| Dependencias | Autenticacao, XP, Dev-Coins, notificacoes e auditoria existentes |

## Objetivo

Criar um album de figurinhas colecionaveis que transforme XP em escolhas de longo prazo. O aluno converte XP em Dev-Coins, compra pacotes, completa o album e conquista uma patente visual. Duplicatas alimentam um mercado controlado e doacoes entre alunos.

O recurso deve retirar XP de circulacao sem vender vantagem academica. A recompensa principal e status visual, colecao e reconhecimento, nao nota, presenca ou poder sobre outros alunos.

## Decisoes consolidadas

1. Todo aluno comeca em `Bronze I` e score zero.
2. Figurinhas nao adquiridas aparecem em preto e branco; adquiridas aparecem coloridas.
3. A quantidade possuida aparece em uma bolha no canto inferior direito.
4. O score considera apenas a primeira unidade de cada figurinha.
5. Somente duplicatas podem ser vendidas ou doadas.
6. A patente nunca regride e cada recompensa de nivel e concedida uma unica vez.
7. A oferta de Dev-Coins comeca em 1.000 unidades, mas e administrada porque o professor pode altera-la explicitamente.
8. Comprar Dev-Coins transfere unidades do caixa do sistema para o aluno e debita XP.
9. Compras feitas diretamente na plataforma devolvem os Dev-Coins ao caixa.
10. No mercado entre alunos, o vendedor recebe o valor liquido e o caixa recebe uma taxa.
11. Dev-Coin nao representa dinheiro, nao pode ser comprado com moeda real e nao possui saque ou conversao externa.
12. Compras e vendas entre alunos comecam desativadas e dependem de ativacao explicita do professor.

## Terminologia

- **Figurinha:** tipo colecionavel com imagem, nome, serie, total de copias, raridade e score.
- **Copia:** unidade individual em estoque, inventario ou reserva.
- **Album:** conjunto de todas as figurinhas publicadas e visiveis ao aluno.
- **Inventario:** quantidades efetivamente possuidas pelo aluno.
- **Score de colecao:** soma do score das figurinhas distintas adquiridas.
- **Patente:** nivel permanente derivado do maior score alcancado.
- **Caixa do sistema:** saldo de Dev-Coins pertencente a plataforma.
- **Oferta total:** soma do caixa com todos os saldos de alunos.
- **Escrow:** copia reservada durante anuncio ou doacao pendente.

## Experiencia do aluno

### Acesso e resumo

O dashboard do aluno tera um botao `Album de figurinhas`, acompanhado de patente atual, score e progresso ate o proximo nivel. A pagina do album tambem mostra quantas figurinhas distintas e quantas copias o aluno possui, com atalhos para pacotes, repetidas e mercado global.

### Meu album

A vitrine principal deve oferecer:

- abas ou filtros `Todas`, `Baixa`, `Media` e `Alta`;
- filtro por colecao/temporada;
- busca por nome;
- ordenacao por numero, raridade ou score;
- grade responsiva e navegavel por teclado;
- imagem em escala de cinza para item nunca adquirido;
- imagem colorida para item possuido;
- bolha de quantidade para itens possuidos;
- indicacao de `Nova` ate a primeira visualizacao;
- detalhes acessiveis sem depender exclusivamente de cor.

Ao abrir uma figurinha possuida, o aluno ve nome, descricao, serie, raridade, score, copias totais e quantidade possuida. Os botoes `Vender` e `Doar` so aparecem quando existe ao menos uma duplicata livre.

### Minhas repetidas

Deve listar apenas a quantidade acima da primeira unidade. Copias reservadas em anuncio ou doacao nao podem ser novamente selecionadas.

### Mercado global

O aluno ve apenas anuncios de outros alunos ativos, de figurinhas que ainda nao possui e de copias nao vendidas e nao expiradas. Cada anuncio mostra figurinha, raridade, score, preco, data limite e identificacao reduzida do vendedor. Codigo de acesso, sobrenome completo e saldos do vendedor nao devem ser expostos.

O professor controla uma chave persistente no catalogo. Quando desativada, novos anuncios e compras sao recusados no servidor, inclusive se a interface estiver desatualizada. Anuncios existentes permanecem visiveis e podem ser cancelados pelo vendedor para liberar a copia em escrow. A alteracao e auditada e a chave inicia desativada.

## Cadastro e oferta de figurinhas

Cada figurinha exige:

- identificador estavel (`slug`);
- numero dentro da colecao;
- nome e descricao;
- texto alternativo da imagem;
- colecao/temporada;
- caminho versionado da imagem WebP;
- total de copias;
- estado `DRAFT`, `PUBLISHED` ou `ARCHIVED`;
- data de publicacao.

O total de copias deve ser um inteiro de no minimo 30. Depois da primeira copia distribuida, imagem, `slug`, total de copias, raridade e score tornam-se imutaveis. Correcoes editoriais de nome, descricao e texto alternativo continuam permitidas e auditadas.

Uma figurinha arquivada deixa de entrar em novos sorteios, mas permanece nos albuns, inventarios, historicos e transacoes existentes.

## Raridade e score

### Faixas

| Raridade | Total de copias |
|---|---:|
| Alta | 30–100 |
| Media | 101–250 |
| Baixa | 251 ou mais |

A raridade e derivada do total de copias e nao pode ser escolhida manualmente.

### Formula

```text
scoreDaFigurinha = teto(3.000 / totalDeCopias)
```

| Copias | Raridade | Score |
|---:|---|---:|
| 500 | Baixa | 6 |
| 300 | Baixa | 10 |
| 200 | Media | 15 |
| 150 | Media | 20 |
| 100 | Alta | 30 |
| 60 | Alta | 50 |
| 30 | Alta | 100 |

O score do aluno e a soma das figurinhas distintas que possui. Quantidade dois ou maior nao acrescenta score.

## Distribuicao por pacotes

### Pacote inicial

- Nome: `Pacote Maker`.
- Preco inicial: 30 DC.
- Conteudo: tres copias.
- Limite: cinco pacotes por aluno por dia escolar.
- Pagamento: aluno transfere 30 DC ao caixa do sistema.
- Resultado: definitivo depois da confirmacao; nao ha reembolso por duplicata.

Cada sorteio escolhe aleatoriamente uma copia entre todas as copias elegiveis que ainda pertencem ao caixa. Portanto, tipos com menos copias possuem probabilidade proporcionalmente menor. A transacao deve bloquear ou condicionar o estoque para nunca distribuir mais unidades que o total publicado.

Antes da compra, a interface deve informar preco, quantidade de cartas, possibilidade de repetidas, quantidade restante por faixa, ausencia de valor monetario e limite diario restante. Se restarem menos de tres copias elegiveis, novas compras ficam indisponiveis.

## Patentes

### Sequencia

1. Bronze I, II e III;
2. Prata I, II e III;
3. Ouro I, II, III e IV;
4. Platina I, II, III e IV;
5. Diamante I, II, III, IV e V;
6. Mestre I, II e III;
7. Super Dev.

Sao 23 niveis e 22 promocoes. O aluno inicia em Bronze I sem receber recompensa de entrada.

### Thresholds

Os limites nao devem ser codificados diretamente na interface. Devem existir como configuracao versionada de patente. Antes da ativacao de uma temporada, o sistema calcula o score maximo do catalogo publicado e o professor confirma os limites.

Distribuicao recomendada do score maximo de referencia:

| Nivel | Percentual acumulado sugerido |
|---|---:|
| Bronze II / III | 2% / 5% |
| Prata I / II / III | 8% / 12% / 16% |
| Ouro I / II / III / IV | 21% / 26% / 31% / 36% |
| Platina I / II / III / IV | 42% / 48% / 54% / 60% |
| Diamante I / II / III / IV / V | 66% / 71% / 76% / 81% / 86% |
| Mestre I / II / III | 90% / 93% / 96% |
| Super Dev | 100% |

Os valores absolutos ficam congelados na versao publicada. Novas figurinhas nao podem reduzir patente nem alterar retroativamente thresholds ja alcancados.

### Recompensas ajustadas

A proposta inicial de 100 DC por nivel e 250 DC por troca de faixa produziria 3.100 DC para um unico aluno ate Super Dev, alem de 1.400 XP. Isso e incompatível com oferta inicial de 1.000 DC e com o objetivo de desinflar XP.

Regra adotada:

- promocao dentro da mesma faixa: 10 XP, 15 DC e recompensa visual;
- mudanca de faixa: 25 XP, 40 DC, recompensa visual e um pacote Maker;
- chegada a Super Dev: 50 XP, 100 DC, titulo e moldura exclusivos, substituindo a recompensa comum de mudanca de faixa.

As moedas saem do caixa. Se o caixa estiver temporariamente insuficiente, a promocao e registrada e a parte monetaria fica como `PENDING`, sem duplicar recompensa. Recompensas visuais e patente sao liberadas imediatamente.

Cada nivel possui uma reivindicacao unica por aluno. Reprocessamento, reconexao ou alteracao de score nunca paga novamente.

## Venda de duplicatas

### Criacao de anuncio

- apenas aluno ativo e autenticado;
- apenas copia acima da primeira unidade;
- preco inteiro em DC;
- senha atual do aluno obrigatoria;
- um anuncio representa exatamente uma copia;
- validade padrao de sete dias;
- a copia entra em escrow;
- vendedor pode cancelar antes da compra.

Faixas iniciais de preco:

| Raridade | Minimo | Maximo |
|---|---:|---:|
| Baixa | 5 DC | 60 DC |
| Media | 10 DC | 150 DC |
| Alta | 20 DC | 300 DC |

### Compra

O comprador nao pode possuir a figurinha, comprar o proprio anuncio ou gastar saldo insuficiente. A operacao atomica:

1. confirma anuncio ativo e copia em escrow;
2. confirma comprador e vendedor ativos;
3. debita o comprador;
4. transfere a copia ao comprador;
5. paga 90% ao vendedor, arredondado para baixo;
6. envia o restante ao caixa como taxa;
7. encerra o anuncio;
8. recalcula score/patente do comprador;
9. grava ledgers e auditoria.

Duas compras concorrentes nunca podem adquirir o mesmo anuncio.

## Doacao de duplicatas

O remetente seleciona uma duplicata livre, informa o codigo do colega e confirma sua senha atual. E proibido doar para si mesmo, para conta inativa ou para aluno que ja possua a figurinha. A copia entra em escrow por sete dias. O destinatario recebe notificacao e pode aceitar ou recusar.

No aceite, a mesma transacao deve:

- validar doacao pendente e contas ativas;
- validar que o destinatario ainda nao possui a figurinha;
- exigir pelo menos 5 XP do remetente e 20 XP do destinatario;
- debitar 5 XP do remetente e 20 XP do destinatario;
- criar os dois `XpEntry` com chaves idempotentes;
- transferir a copia;
- recalcular score/patente do destinatario;
- concluir a doacao e notificar as partes.

Recusa ou expiracao devolve a copia ao inventario livre e nao movimenta XP. Os custos sao aplicados apenas no aceite.

## Oferta administrada de Dev-Coins

### Invariante

```text
ofertaTotal = saldoDoCaixa + somaDosSaldosDosAlunos
```

A oferta inicial alvo e 1.000 DC. Como o professor podera adicionar ou remover unidades, o recurso nao deve ser descrito como Bitcoin nem como oferta fixa. A denominacao correta na interface e `oferta administrada de Dev-Coins`.

### Fluxos

| Operacao | Origem | Destino |
|---|---|---|
| Converter XP em DC | Caixa | Aluno |
| Comprar pacote | Aluno | Caixa |
| Comprar avatar/item da plataforma | Aluno | Caixa |
| Comprar anuncio | Comprador | Vendedor + taxa para caixa |
| Recompensa de patente | Caixa | Aluno |
| Mint administrativo | Criacao auditada | Caixa |
| Burn administrativo | Caixa | Destruicao auditada |

A conversao XP → DC continua usando `devCoinsPerXp`, mas passa a depender de saldo suficiente no caixa. Debito de XP, credito ao aluno, debito do caixa e ledgers devem ocorrer atomicamente.

### Ajustes pelo professor

O professor pode aumentar ou reduzir a oferta apenas na tela de tesouraria. A operacao exige sessao ativa, confirmacao da senha pessoal, quantidade inteira positiva, motivo entre 10 e 300 caracteres, visualizacao antes/depois e confirmacao final.

Burn nunca pode exceder o saldo do caixa. O professor nao edita saldos diretamente nem remove moedas da conta de um aluno por esse fluxo. Toda alteracao gera ledger da tesouraria e auditoria.

## Migracao dos saldos existentes

Antes da ativacao:

1. somar saldos atuais de todos os usuarios;
2. reconciliar cada saldo com `DevCoinEntry`;
3. se a soma for menor ou igual a 1.000, criar o caixa com `1.000 - soma`;
4. se a soma superar 1.000, bloquear a migracao e exigir decisao explicita de oferta inicial maior;
5. registrar a abertura da tesouraria sem apagar ou reescrever historicos;
6. verificar novamente a invariante por consulta independente.

Nenhum saldo existente pode ser zerado silenciosamente.

## Persistencia proposta

- `StickerCollection` — serie/temporada e estado;
- `Sticker` — metadados, oferta, raridade e score imutaveis;
- `StickerCopy` — unidade individual, proprietario e estado;
- `StickerPackPurchase` — compra e resultado do pacote;
- `StickerListing` — anuncio e preco;
- `StickerTrade` — liquidacao de venda;
- `StickerDonation` — convite, aceite/recusa/expiracao;
- `PatentLevel` — thresholds versionados;
- `StudentPatentProgress` — score, patente atual e melhor patente;
- `PatentRewardClaim` — garantia de pagamento unico;
- `DevCoinTreasury` — saldo e oferta total;
- `DevCoinTreasuryEntry` — ledger do caixa.

Todas as tabelas financeiras e de transferencia precisam de chaves idempotentes, datas, estado e referencias aos participantes.

## Seguranca e privacidade

- Revalidar identidade, papel, status e versao de sessao em toda API.
- Nunca aceitar `studentId`, score, raridade ou saldo como autoridade enviada pelo cliente.
- Senhas usadas para venda, doacao ou tesouraria sao comparadas no servidor e nunca registradas.
- Respostas publicas usam DTOs allowlisted.
- Nao expor codigo de acesso de colegas no mercado.
- Aplicar limite de requisicoes a pacote, anuncio, compra e doacao.
- Nao permitir dinheiro real, saque, promessa de valorizacao ou comercio externo.

## Criterios de aceite

1. Aluno novo aparece como Bronze I, score zero e album em preto e branco.
2. Compra de pacote conserva oferta de DC e estoque de copias.
3. O sorteio nunca ultrapassa `totalCopies`.
4. Primeira copia colore a figurinha e acrescenta score; repetidas apenas incrementam quantidade.
5. Mudanca de patente e recompensa acontecem uma unica vez.
6. Apenas duplicatas livres podem ser anunciadas ou doadas.
7. Mercado omite cartas ja possuidas pelo comprador.
8. Compra concorrente de um anuncio possui apenas um vencedor.
9. Venda distribui valor entre vendedor e caixa conforme taxa.
10. Doacao so movimenta XP e copia no aceite.
11. Conversao de XP falha sem saldo de tesouraria e nao debita o aluno.
12. Mint/burn exige senha, motivo, confirmacao e auditoria.
13. A invariante da oferta e verificada por testes e consulta independente.
14. Interfaces sao responsivas, navegaveis por teclado e nao dependem apenas de cor.

## Fora do escopo inicial

- dinheiro real, PIX, cartao ou saque;
- troca direta de DC entre alunos;
- leilao, lance ou aposta;
- venda da unica copia do album;
- caixas com probabilidades secretas;
- vantagens em notas, presenca, comportamento ou correcao;
- negociacao com usuarios externos a Sala Maker.

## Validacao obrigatoria

- testes unitarios de score, raridade, patente, taxa e conservacao;
- testes de integracao transacionais em PostgreSQL isolado;
- concorrencia de pacote, compra e aceite de doacao;
- migracao testada sobre copia descartavel do estado real;
- teste de autorizacao entre dois alunos e um professor;
- teste de teclado, leitor de tela e dispositivo movel;
- reconciliacao de saldos, caixa, ledgers e estoque depois do teste completo.

## Evidencia de implementacao — 2026-09-28

- A consulta final somente leitura ao Neon compartilhado encontrou 25 contas de aluno, 15.005 DC nos saldos e 15.005 DC no `DevCoinEntry`; a reconciliacao estava exata. Uma leitura anterior havia encontrado 15.020 DC, comprovando que o valor pode mudar enquanto o sistema esta em uso.
- A abertura adotada e derivada dentro da migration: oferta administrada = 1.000 DC solicitados + 500 DC de reserva + saldo existente. Com o retrato final consultado, isso corresponde a 16.505 DC de oferta e 1.500 DC no caixa depois do reconhecimento dos 15.005 DC ja em circulacao.
- A migration `20260928120000_add_sticker_album_and_treasury` repete a reconciliacao dentro da propria execucao e aborta diante de qualquer divergencia. Ela nao foi aplicada ao banco compartilhado durante a implementacao.
- Conversao XP → DC, compra de avatar, pacote Maker, mercado, recompensas e distribuicao do professor agora transferem DC de/para o caixa na mesma transacao. Mint e burn ficam restritos a tesouraria com senha pessoal, motivo, previa e auditoria.
- Album, sorteio de tres copias com bloqueio concorrente, limite diario, score distinto, patentes versionadas, recompensas idempotentes, anuncios, taxa de mercado, escrow e doacoes com custo de XP foram integrados a autenticacao e aos ledgers existentes.
- O catalogo do professor possui uma chave persistente, inicialmente desativada, que bloqueia no servidor a criacao e a liquidacao de anuncios sem impedir o cancelamento de anuncios existentes.
- Portas tecnicas executadas: Prisma format/validate/generate, TypeScript, testes unitarios, lint e build Webpack. Integracao transacional em PostgreSQL descartavel, concorrencia real, navegacao assistiva e validacao visual autenticada continuam pendentes antes do deploy.
