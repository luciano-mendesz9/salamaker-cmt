# Operação e diagnóstico

## Iniciar

Na raiz do projeto:

```bash
npm run brex-ai
```

O comando testa `BREX_OLLAMA_URL/api/version`. Se não responder, inicia `ollama serve`, aguarda até 20 segundos e então inicia o Express. A porta do Express é `BREX_PORT` (8000 por padrão). O servidor Express liga somente em `127.0.0.1`; use `ngrok http 8000` em outro terminal quando quiser expô-lo. Fechar o comando encerra o Express e o Ollama iniciado por ele. Se o Ollama já estava rodando, ele permanece ativo.

Uma instância iniciada pelo serviço do sistema e outra iniciada pelo usuário podem guardar modelos em diretórios diferentes. O comando verifica se `BREX_MODEL` está disponível na instância escolhida; se não estiver, encerra com instrução para baixar o modelo nela. Isso evita apresentar o Brex como pronto quando ele não consegue gerar respostas.

## Testar

Confira o modelo instalado com `ollama list`. Verifique a saúde com:

```bash
curl -i http://127.0.0.1:8000/ping -H "Authorization: Bearer $BREX_API_TOKEN"
```

Faça o POST de exemplo em [README.md](README.md). No Postman, escolha `POST`, a URL `http://127.0.0.1:8000/v1/chat`, autenticação Bearer Token e body JSON igual ao exemplo.

Respostas comuns: `400` para corpo inválido; `401` para token ausente/incorreto; `403` para `Origin` não autorizado; `502` para erro do Ollama; `503` quando a fila está cheia; `504` para tempo esgotado.

## Segurança e dados

O ngrok deve encaminhar a porta 8000, nunca a porta 11434 do Ollama. Guarde o token da API apenas nos ambientes do servidor Sala Maker e do notebook. Não coloque o token no JavaScript enviado ao navegador. O endpoint de saúde também exige token.

O contexto do estudante informado no POST pode ser falsificado por qualquer cliente que possua o token; por isso, mantenha o token secreto. A API Next do Sala Maker cria esses dados a partir da sessão e do banco. O arquivo `reports/moderation.jsonl` é ignorado pelo Git e deve ser revisado e removido conforme a política de retenção definida pelo professor. Ele contém nome e pergunta, nunca o código de acesso.

Se a porta 8000 já tiver uma instância antiga do Express, pare esse processo e execute `npm run brex-ai` novamente antes de configurar o ngrok. A versão antiga não terá a rota `/ping`.
