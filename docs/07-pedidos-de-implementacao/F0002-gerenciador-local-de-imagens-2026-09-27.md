# F0002 — Gerenciador local de imagens

## Identificacao

| Campo | Valor |
|---|---|
| ID | F0002 |
| Data | 2026-09-27 |
| Estado | Pedido especificado; nao implementado |
| Publico | Professor autenticado, somente em desenvolvimento local |
| Dependencias | Catalogo atual de avatares e F0001 para figurinhas |

## Objetivo

Criar no painel do professor um gerenciador local para preparar novas fotos de perfil e imagens de figurinhas. O professor faz upload, recorta, preenche os metadados e confirma. A aplicacao converte a imagem para WebP e salva os arquivos versionaveis nas pastas corretas. Depois, o professor revisa `git diff`, faz commit e publica normalmente pelo GitHub/Vercel.

O recurso nao deve tentar persistir arquivos no filesystem da Vercel. Em producao, upload e endpoints de escrita de arquivo nao existem.

## Correcao do fluxo proposto

O banco usado localmente tambem aponta para producao. Por isso, cadastrar a figurinha no banco no momento do upload local criaria um periodo em que o banco referencia uma imagem que ainda nao foi commitada, publicada e entregue pela Vercel.

Fluxo adotado:

1. upload local prepara imagem WebP e manifesto de metadados versionado;
2. professor revisa imagem, manifesto e registro gerado;
3. professor faz commit e push;
4. Vercel publica os arquivos estaticos;
5. somente depois do deploy, o professor ativa a figurinha no banco por uma acao protegida;
6. ativacao cria estoque e dados persistentes usando o manifesto ja publicado.

O upload local nunca cria, altera ou exclui estoque de figurinhas no banco de producao.

## Navegacao

O painel do professor exibira o grupo `Midias locais` apenas quando o gerenciador estiver habilitado. As telas devem ser separadas:

- `/professor/midias/perfis` — fotos de perfil;
- `/professor/midias/figurinhas` — imagens e manifestos de figurinhas.

Uma pagina indice `/professor/midias` pode apresentar os dois atalhos e explicar que as alteracoes ainda precisam de commit.

Em producao, esses links nao aparecem. Acesso direto retorna `404`, inclusive para professor autenticado.

## Condicoes para habilitacao

Todas as condicoes devem ser verdadeiras:

- `NODE_ENV !== "production"`;
- variavel `ENABLE_LOCAL_ASSET_MANAGER=true`;
- filesystem do projeto gravavel;
- usuario autenticado e revalidado como professor ativo.

O bloqueio deve existir na interface, pagina e Route Handler. Esconder o botao nao e uma protecao suficiente. Verificacao de hostname local pode ser usada como defesa adicional, mas nao substitui o bloqueio do processo/ambiente.

Preview deployments da Vercel continuam bloqueados, pois usam build/runtime de producao.

## Tecnologia de imagem

A implementacao deve declarar uma biblioteca de processamento como dependencia direta, preferencialmente `sharp`. Nao deve depender de uma instalacao transitiva do Next.js.

Formatos de entrada aceitos:

- JPEG;
- PNG;
- WebP estatico.

Arquivos GIF, SVG, imagens animadas e formatos nao reconhecidos devem ser rejeitados na primeira versao.

Validacoes comuns:

- maximo de 10 MB por upload;
- deteccao pelo conteudo real, nao apenas extensao/MIME enviado;
- decodificacao completa antes de salvar;
- limite maximo de 4.096 × 4.096 pixels;
- remocao de EXIF e demais metadados pela recodificacao;
- hash SHA-256 para detectar duplicata exata;
- nomes de arquivo derivados de slug validado, nunca do nome original;
- gravacao temporaria e renomeacao atomica;
- limpeza do temporario em erro.

## Fotos de perfil

### Tela

A pagina deve mostrar todas as imagens ja registradas em uma grade, incluindo:

- miniatura;
- chave/slug;
- rotulo;
- dimensoes finais;
- tamanho em bytes;
- hash curto;
- indicador `padrao` ou `paga`;
- data de preparacao quando disponivel.

Deve haver busca, ordenacao por chave e um botao `Nova foto de perfil`.

### Formulario

Campos:

- arquivo de imagem;
- chave/slug unica, entre 3 e 40 caracteres, `[a-z0-9-]`;
- rotulo administrativo;
- texto alternativo;
- confirmacao do recorte quadrado;
- confirmacao de que a imagem pode ser usada no projeto.

O preco nao sera cadastrado por imagem na primeira versao. O valor continua seguindo a regra global de avatar pago. A imagem `default` nao pode ser substituida pelo gerenciador.

### Processamento

- recorte quadrado escolhido na interface;
- saida 512 × 512 pixels;
- WebP estatico, qualidade inicial 85;
- preservar transparencia quando houver;
- impedir overwrite de chave existente;
- salvar em `src/assets/profiles/<slug>.webp`;
- atualizar manifesto versionado de avatares;
- regenerar o registro TypeScript de imports estaticos.

O projeto atual usa imports allowlisted em `src/lib/profile-avatars.ts`. A implementacao deve preservar essa protecao. O gerenciador nao pode transformar a escolha do avatar em URL ou caminho arbitrario enviado pelo aluno.

Estrutura proposta:

```text
src/assets/profiles/<slug>.webp
src/content/profile-avatar-catalog.json
src/lib/profile-avatar-assets.generated.ts
```

O arquivo gerado deve conter apenas imports e mapa produzidos a partir do manifesto. Nao deve ser editado manualmente.

## Figurinhas

### Tela

A pagina local deve separar:

- `Preparadas` — presentes no manifesto/Git;
- `Publicadas` — ja ativas no banco;
- `Pendentes de deploy/ativacao` — manifesto existente sem registro ativo;
- `Arquivadas` — preservadas para historico.

Cada cartao mostra imagem, numero, nome, colecao, total de copias, raridade derivada, score derivado, caminho e estado. A tela tambem deve alertar quando manifesto, arquivo e registro gerado estiverem inconsistentes.

### Formulario de figurinha

Campos obrigatorios:

- arquivo de imagem;
- colecao/temporada existente ou novo slug de colecao;
- numero inteiro dentro da colecao;
- slug unico;
- nome;
- descricao;
- texto alternativo;
- total de copias, minimo 30;
- confirmacao do recorte;
- confirmacao de direito de uso da imagem.

Raridade e score nao sao campos editaveis. A interface apenas apresenta a previa calculada pelas regras do F0001:

```text
raridade = faixa derivada de totalDeCopias
score = teto(3.000 / totalDeCopias)
```

### Processamento

- proporcao final 3:4;
- saida 900 × 1.200 pixels;
- recorte confirmado visualmente antes do envio;
- WebP estatico, qualidade inicial 85;
- preservar transparencia quando aplicavel;
- impedir colisao de colecao, numero ou slug;
- salvar imagem e manifesto sem escrever no banco.

Estrutura proposta:

```text
public/media/stickers/<colecao>/<slug>.webp
src/content/sticker-catalog/<colecao>.json
```

Figurinhas ficam em `public` porque o catalogo e dinamico e potencialmente grande. O manifesto continua sendo a allowlist: a aplicacao nunca renderiza um caminho fornecido livremente por aluno ou requisicao externa.

### Exemplo de entrada do manifesto

```json
{
  "slug": "robo-explorador",
  "number": 12,
  "name": "Robo Explorador",
  "description": "Explora terrenos desconhecidos.",
  "alt": "Robo azul com rodas e antena",
  "imagePath": "/media/stickers/robos-lendarios/robo-explorador.webp",
  "totalCopies": 60,
  "rarity": "HIGH",
  "score": 50,
  "state": "DRAFT"
}
```

`rarity`, `score` e `imagePath` sao calculados e gravados pelo servidor local. O cliente nao e autoridade sobre esses campos.

## Ativacao depois do deploy

A producao pode possuir uma pagina protegida `/professor/figurinhas/catalogo`, sem upload de arquivo. Ela lista entradas do manifesto entregue pelo deploy e permite ativar uma figurinha ainda inexistente no banco.

A ativacao exige:

- professor ativo;
- senha pessoal do professor;
- confirmacao do total de copias, raridade e score;
- verificacao de que a URL estatica da imagem responde;
- inexistencia de slug e numero conflitantes;
- transacao que cria figurinha e suas copias/estoque;
- auditoria com hash do manifesto e commit/build quando disponivel.

Depois da primeira copia distribuida, dados de escassez ficam bloqueados conforme F0001. A ativacao e idempotente: repetir a mesma solicitacao nao duplica estoque.

Como alternativa operacional, pode existir um comando `npm run stickers:publish -- <slug>`, mas ele deve aplicar as mesmas autorizacoes de ambiente, validacoes e idempotencia. O fluxo visual e preferencial.

## Arquivos ja existentes

As telas locais devem reconstruir sua listagem a partir de manifestos e registros gerados, nao apenas do banco. Na primeira implementacao, sera necessario criar um manifesto inicial para as 41 imagens de perfil existentes (`default` e `001`–`040`) sem alterar as chaves salvas nos usuarios.

Arquivos orfaos devem aparecer como erro de consistencia, nunca ser apagados automaticamente.

## Escritas e recuperacao de erro

Cada preparacao local deve funcionar como uma pequena transacao de filesystem:

1. validar formulario e imagem;
2. processar em diretorio temporario;
3. validar o WebP resultante;
4. calcular hash;
5. preparar novo manifesto e registro gerado;
6. confirmar que nenhum destino existe;
7. mover os arquivos para os destinos finais;
8. se uma etapa final falhar, restaurar manifesto/registro anterior e remover apenas os novos arquivos desta operacao.

O sistema nunca deve executar `git add`, commit, push ou deploy automaticamente. Essas operacoes permanecem sob controle explicito do professor/desenvolvedor.

## Revisao antes do commit

Depois do upload, a tela apresenta:

- miniatura final;
- caminhos criados ou alterados;
- hash e tamanho;
- trecho dos metadados;
- lembrete para revisar `git status` e `git diff`;
- aviso de que a figurinha ainda nao esta ativa em producao.

O commit deve conter a imagem WebP, manifesto e arquivo gerado correspondentes. Commitar somente a imagem e considerado estado invalido.

## Operacoes nao permitidas na primeira versao

- sobrescrever imagem existente;
- excluir imagem usada por usuario, inventario ou historico;
- renomear slug publicado;
- alterar total de copias depois da ativacao;
- escrever arquivos em producao;
- cadastrar URL remota como imagem;
- baixar imagem externa pelo servidor;
- executar automaticamente Git ou deploy;
- ativar figurinha no banco antes de o asset estar publicado.

Substituicao excepcional de uma imagem deve ser um fluxo futuro separado, com backup, novo hash, justificativa e auditoria.

## Seguranca

- Usar `requireTeacher()` em todas as paginas e APIs.
- Revalidar ambiente no servidor imediatamente antes de qualquer escrita.
- Proteger formularios contra requisicoes de origem indevida.
- Normalizar e validar slug antes de compor caminho.
- Resolver o caminho final e confirmar que permanece dentro da pasta allowlisted.
- Nao aceitar `..`, barras, bytes nulos, nomes reservados ou extensoes do cliente.
- Impor limites antes e durante a decodificacao para evitar image bomb.
- Nao registrar bytes da imagem, senha ou segredos.
- Nao devolver caminhos absolutos do servidor em respostas para alunos.
- Aplicar bloqueio por operacao para impedir duas gravacoes concorrentes no mesmo manifesto.

## Criterios de aceite

1. As duas telas aparecem apenas no ambiente local explicitamente habilitado.
2. Endpoint acessado em producao retorna `404` e nao toca o filesystem.
3. Apenas professor ativo pode listar ou preparar midias.
4. JPEG, PNG e WebP valido geram WebP nas dimensoes especificadas.
5. Metadados e animacao sao removidos/rejeitados conforme regra.
6. Slug malicioso ou duplicado nao cria arquivo.
7. Perfil salva asset, manifesto e registro de imports de forma consistente.
8. Figurinha salva asset e manifesto sem escrever no banco.
9. Imagens existentes aparecem nas respectivas galerias.
10. Falha intermediaria nao deixa arquivo ou manifesto parcial.
11. A ativacao pos-deploy cria estoque uma unica vez.
12. O asset da figurinha esta acessivel antes da ativacao.
13. `git status` mostra somente arquivos esperados pela operacao.
14. Build confirma que todos os imports/manifestos apontam para arquivos existentes.
15. A interface permite recorte, previa e operacao por teclado em tela pequena.

## Validacao obrigatoria

- testes unitarios de slug, caminhos, dimensoes e manifestos;
- testes com arquivo corrompido, MIME falso, imagem gigante e colisao;
- teste de rollback de cada etapa de escrita;
- teste garantindo bloqueio com `NODE_ENV=production`;
- teste de autorizacao com aluno e usuario sem sessao;
- verificacao visual do WebP final;
- `npm test`, lint, typecheck e build sequenciais;
- smoke test da imagem publicada na Vercel;
- ativacao em banco apenas depois do smoke test do asset.
