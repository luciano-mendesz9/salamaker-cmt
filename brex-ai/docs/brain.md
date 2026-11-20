# Contexto do modelo

O servidor lê os arquivos de `brex-ai/brain/*.txt` ao iniciar, na ordem definida em `server.mjs`, e os envia como instrução de sistema em cada chamada. Reinicie `npm run brex-ai` após alterar um arquivo.

| Arquivo | Responsabilidade |
| --- | --- |
| `persona.txt` | Nome, tom, linguagem e transparência sobre ser IA |
| `developer.txt` | Atribuição e biografia fornecida pelo criador |
| `scope.txt` | Assuntos atendidos e redirecionamento gentil |
| `technical.txt` | Referência inicial de Arduino e diagnóstico |
| `teaching.txt` | Método de ensino e limites do que pode afirmar |
| `conduct.txt` | Perguntas sobre hacking, respeito e marcador de denúncia |

Além desses textos, o servidor envia primeiro nome, sobrenome, XP e DevCoins recebidos no pedido. A pergunta é enviada como mensagem do usuário. `accessCode` não entra no prompt. Os textos são orientações para um modelo probabilístico: não garantem conformidade perfeita nem substituem controles no servidor.

Para testar uma mudança de comportamento, use perguntas de programação, pedidos fora do tema, brincadeiras sobre hacking e expressões leves ou graves sobre colegas. Verifique se o Brex preserva o tom e não inventa fatos sobre o sistema.
