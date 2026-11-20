# Brex AI — versão inicial

Brex AI é um serviço Express local, separado do servidor Next.js. O comando `npm run brex-ai` verifica se o Ollama responde, inicia `ollama serve` apenas se necessário e então inicia o Express em `127.0.0.1:8000`. O comando não inicia o ngrok.

Fluxo: navegador do aluno → API Next do Sala Maker → túnel ngrok → Express local → Ollama local. O navegador nunca chama o túnel diretamente: o token da API ficaria exposto. A integração do Next está descrita em [integracao-sala-maker.md](integracao-sala-maker.md).

## Preparação

1. Instale o Ollama e baixe o modelo configurado, por exemplo `ollama pull llama3.2:1b`. O modelo precisa estar disponível na mesma instância que o Brex usará.
2. Copie `brex-ai/.env.example` para `brex-ai/.env`.
3. Substitua `BREX_API_TOKEN` por um segredo com pelo menos 24 caracteres. Você pode gerá-lo com `openssl rand -hex 32`.
4. Na raiz do repositório, execute `npm install` e `npm run brex-ai`.
5. Opcionalmente, em outro terminal, execute `ngrok http 8000` para expor somente o Express.

O arquivo `.env` é ignorado pelo Git. O Ollama continua escutando apenas em localhost. Se já estiver ativo, o comando usa a instância existente; ao encerrar, só tenta parar a instância que ele próprio iniciou.

## API

Todas as rotas exigem `Authorization: Bearer <BREX_API_TOKEN>`.

- `GET /ping` e `GET /health`: informam se o Ollama está acessível, o modelo configurado e os pedidos ativos/em fila. Retornam `503` se o Ollama estiver indisponível.
- O estado de saúde também retorna `model_missing` e HTTP `503` se o Ollama estiver ativo sem o modelo configurado.
- `POST /v1/chat`: recebe o corpo abaixo e retorna uma resposta do modelo.

```json
{
  "data": {
    "query": "O que faz o pinMode no Arduino?",
    "user": {
      "firstName": "Ana",
      "lastName": "Silva",
      "xp": 120,
      "devCoins": 40,
      "accessCode": "codigo-do-aluno"
    }
  }
}
```

Resposta bem-sucedida:

```json
{
  "answer": "...",
  "reportRegistered": false,
  "usage": { "inputTokens": 123, "outputTokens": 45 }
}
```

`accessCode` é opcional para manter compatibilidade com o contrato inicial, mas não autentica o aluno e **não é enviado ao Ollama nem gravado em relatórios**. O Next envia os dados do aluno autenticado sem o código de acesso. O histórico é mantido criptografado no banco pelo Next; o Express recebe somente as cinco mensagens recentes necessárias para a resposta.

Exemplo local com `curl` após configurar `BREX_API_TOKEN` no terminal:

```bash
curl -sS http://127.0.0.1:8000/v1/chat \
  -H "Authorization: Bearer $BREX_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"data":{"query":"O que faz o pinMode no Arduino?","user":{"firstName":"Ana","lastName":"Silva","xp":120,"devCoins":40,"accessCode":"codigo-do-aluno"}}}'
```

## Limites desta versão

- Até 5 gerações simultâneas e 20 pedidos esperando, configuráveis em `.env`. A fila é mantida em memória; se encher, a API responde `503`.
- Cada resposta tem teto de 350 tokens gerados; o contexto do modelo é limitado a 4096 tokens. Pedidos podem levar até 120 segundos.
- O Next impõe teto de 10.000 tokens por interação e no máximo três chamadas simultâneas. Cada aluno tem saldo de 10.000 tokens; após esgotá-lo, recebe uma nova cota 30 minutos depois. O saldo fica no banco do Next e não depende do histórico de chats.
- Ainda não há ferramentas externas, acesso à atividade, execução de código ou ações sobre XP/DevCoins.
- A checagem de origem aceita `https://salamakercmt.vercel.app` e requisições sem `Origin` (como chamadas entre servidores). Ela não substitui o token Bearer.
- Ameaças explícitas reconhecidas por uma regra conservadora são registradas antes de chamar o modelo. Para outras ofensas graves, a detecção depende de um marcador emitido pelo modelo e pode falhar. Os registros vão para `brex-ai/reports/moderation.jsonl`, apenas neste computador; ainda não existe notificação automática ao professor.
- O modelo 1B instalado foi testado com uma pergunta de Arduino e produziu uma imprecisão. Avalie respostas com perguntas reais da turma antes de liberar o Brex aos alunos; um modelo maior pode melhorar a qualidade, mas exigirá mais memória e tempo.

Consulte [brain.md](brain.md) para o funcionamento dos arquivos de contexto e [operacao.md](operacao.md) para testes e diagnóstico.
