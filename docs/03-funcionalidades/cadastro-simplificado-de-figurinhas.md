# Cadastro simplificado de figurinhas locais

Estado: implementado no gerenciador local em 29 de setembro de 2026. O recurso continua bloqueado em producao e prepara arquivos versionados para revisao, commit e deploy.

## Fluxo do professor

O formulario de figurinhas solicita somente informacoes que dependem de decisao humana:

- imagem e confirmacao do recorte 3:4;
- colecao existente ou nome de uma nova colecao;
- nome, descricao e texto alternativo;
- quantidade total de copias;
- confirmacao de direito de uso.

O campo de colecao e um `select`. A opcao “Criar nova colecao/pasta” solicita o nome visivel e cria a pasta na preparacao do primeiro asset.

## Campos gerados pelo sistema

O servidor gera automaticamente:

- slug seguro da colecao nova;
- slug seguro da figurinha ou foto de perfil;
- sufixos `-2`, `-3` etc. quando houver colisao;
- proximo numero livre da figurinha dentro da colecao;
- caminho WebP e manifesto da colecao;
- raridade, score, hash, dimensoes, bytes e data de preparacao.

Nomes com acentos sao normalizados, caracteres inseguros sao removidos e o resultado continua limitado a 40 caracteres. O servidor valida novamente a colecao selecionada e nao aceita caminhos enviados pelo navegador.

## Separacao entre preparar e ativar

Preparar uma imagem grava somente asset, manifesto e registro gerado no checkout local. Isso nao cria estoque no Neon. Depois de revisar e publicar os arquivos, o professor usa a tela de catalogo para ativar o manifesto implantado, com senha pessoal e verificacao do asset no deploy.
