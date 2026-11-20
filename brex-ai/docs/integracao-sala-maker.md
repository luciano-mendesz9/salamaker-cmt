# Integração com a Sala Maker

## Fluxo

O aluno abre `/aluno/brex-ai`. O navegador chama `/api/student/brex-ai/ping`; a API Next verifica a configuração do professor, lê o saldo de tokens do aluno e consulta `GET /ping` do Express com o segredo `BREX_API_TOKEN`. Se a IA estiver desativada, o túnel não responder ou o modelo não estiver pronto, a tela mostra o avatar desativado e oculta histórico e entrada de texto.

Quando ativa, a tela lista apenas as conversas do aluno autenticado. O envio aceita até 300 caracteres. O Next usa a sessão para buscar nome, XP e DevCoins, recupera até cinco mensagens anteriores, descriptografa esse contexto e o envia ao Express. O código de acesso do aluno não é enviado. O Express executa a chamada local ao Ollama e devolve resposta e contagem de tokens. O Next grava pergunta e resposta criptografadas com AES-256-GCM, e a tela apresenta a resposta com animação de escrita.

O título de uma nova conversa é formado pelas duas primeiras palavras da primeira pergunta. O aluno pode abrir e excluir suas conversas; todas as consultas verificam que ele é o proprietário.

## Configuração

O professor usa `/professor/brex-ai` para definir versão, domínio HTTPS do ngrok (sem caminho) e ativação. O sistema acrescenta `/ping` e `/v1/chat`. Apenas domínios ngrok são aceitos. A configuração fica em `BrexSetting`; chats em `BrexChat`, mensagens em `BrexMessage`, saldo em `BrexTokenAccount` e vagas temporárias de processamento em `BrexRun`.

No ambiente do Next, configure `BREX_API_TOKEN` igual ao token do `brex-ai/.env` e `BREX_MESSAGE_KEY` como 32 bytes em hexadecimal (`openssl rand -hex 32`). A chave deve ser guardada: perdê-la impede ler mensagens antigas. Alterá-la exige migração dos dados cifrados. Não use `AUTH_SECRET` como substituto. As duas variáveis locais foram acrescentadas ao `.env` ignorado pelo Git; a implantação precisa recebê-las separadamente.

## Limites e comportamento

- Cada aluno recebe 10.000 tokens. O Next debita a soma dos tokens de entrada e saída informada pelo Ollama no mesmo commit que grava as mensagens. Quando a resposta usa mais que o saldo restante, o débito é limitado ao saldo, a resposta é entregue e o saldo chega a zero. O próximo envio fica bloqueado.
- A partir do esgotamento, a cota se renova em 30 minutos. O navegador mostra os minutos e segundos restantes e reconsulta o servidor quando o prazo termina. O próprio Next também verifica a renovação, sem depender de cron.
- Há um teto de 10.000 tokens de entrada + saída por interação. O contexto do modelo atualmente é menor que esse teto (`num_ctx: 4096`).
- Até três chamadas simultâneas no Next, controladas por transações serializáveis no banco. Uma quarta recebe HTTP 429 e pode tentar novamente. Vagas expiram após três minutos em caso de queda do processo.
- Apenas uma chamada por aluno ao mesmo tempo, inclusive em chats diferentes, para impedir corridas no saldo. O histórico enviado ao modelo contém no máximo cinco mensagens anteriores.
- O saldo permanece debitado quando um chat é excluído. Falhas do modelo e respostas rejeitadas antes de salvar não debitam tokens.
- Mensagens criadas antes da migration de saldo não são debitadas retroativamente; cada aluno inicia com a cota integral.
- O Express gera a resposta inteira antes de responder. A animação de escrita é feita no navegador após recebê-la; ainda não há streaming de tokens em tempo real.
- As mensagens são cifradas antes de salvar. Títulos, identificadores, horários e contagens de tokens permanecem visíveis no banco para listar e operar as conversas.
- SHA-256 é hash irreversível e não serviria para reabrir o histórico; por isso foi usado AES-256-GCM.

## Estado operacional

As migrations `20261120140000_add_brex_ai` e `20261120190000_add_brex_token_account` criam as tabelas. A configuração começa desativada. Para liberar aos alunos, inicie `npm run brex-ai`, abra `ngrok http 8000`, configure o domínio no painel do professor e ative o Brex. A qualidade das respostas do modelo 1B precisa ser acompanhada pelo professor.
