# FinControl — Sub-projeto 9: Importar extrato (OFX e CSV)

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente, a pedido do usuário ("pode fazer tudo que você disse"). Item 3 da recomendação em `docs/pesquisa-concorrentes-2026-11-18.md`. É a ponte barata até o Open Finance, que exige agregador pago.
- **Banco:** nada muda (sem migration).

| # | Decisão | Motivo |
|---|---|---|
| I1 | **O arquivo é lido no navegador.** UTF-8 primeiro e, se falhar, Windows-1252, a codificação de muitos OFX brasileiros. A API recebe só as linhas (data, descrição e valor com sinal). | O arquivo nunca sai do aparelho. Sem upload, não há armazenamento nem LGPD extra. |
| I2 | **OFX 1.x (SGML) e 2.x (XML):** cada `<STMTTRN>`, com `DTPOSTED`, `TRNAMT` e `MEMO`/`NAME`. **CSV com cabeçalho:** separador `;` ou `,`, colunas achadas pelo nome (Data, Valor, Descrição/Histórico/Title), valores em "1.234,56" ou "-1234.56" e datas em dd/mm/aaaa ou aaaa-mm-dd. O formato do Nubank (conta) e do Inter foi testado. Linha sem data ou valor fica de fora, e a tela avisa quantas. | Cobre o que os bancos grandes exportam sem pedir para a pessoa mapear colunas. |
| I3 | **Até 1.000 linhas por vez.** O corpo das rotas `/imports` aceita 1 MB; o resto da API continua em 100 KB. | Um ano de extrato de uma pessoa cabe. |
| I4 | **`POST /imports/preview`** devolve, por linha, o tipo (sinal), a categoria sugerida e se parece repetido. | A pessoa revisa antes de gravar. |
| I5 | **Sugestão de categoria:** primeiro o último lançamento com a mesma descrição normalizada (sem acentos, números e pontuação), entre os 3.000 mais recentes. Depois, palavras-chave comuns (Uber → Transporte, iFood → Alimentação, Netflix → Assinaturas, salário → Salário…), que precisam começar uma palavra. Por fim, "Outros". | Aprende com o uso sem tabela de regras nova (sem migration). |
| I6 | **`POST /imports/commit`**: as linhas marcadas viram lançamentos pagos na data do extrato, natureza variável, num `createMany` só. Categoria de outro usuário dá 404; categoria do tipo errado dá 422 sem gravar nada. | Tudo ou nada. |
| I7 | **Repetido:** já existe na conta um lançamento no mesmo dia (pagamento, ou vencimento se pendente), com o mesmo valor e o mesmo tipo. É contado: duas linhas iguais no arquivo e uma no banco marcam só uma. As repetidas começam desmarcadas. | Evita lançar duas vezes o que a pessoa já tinha registrado à mão. |
| I8 | **Só contas comuns** (corrente, poupança, carteira), ativas. Cartão de crédito fica de fora (422). | A compra no cartão tem fatura e parcelas, que o extrato não traz. |
| I9 | **Tela `/importar`**, aberta pelo botão "Importar extrato" em Lançamentos. Mostra a conta, o arquivo, a lista com caixa de marcar, data, descrição, valor, categoria editável e a origem da sugestão, e o botão "Importar N lançamentos". | Um passo só, revisável. |

## Revisão final (revisor novo e CodeRabbit)

- **Pagamento de fatura e transferência:** a checagem de repetidos agora inclui as transferências, vistas pela conta do extrato (saída ou entrada). Linhas com cara de fatura, transferência, TED, aplicação ou resgate começam desmarcadas, com o aviso "Parece fatura ou transferência entre suas contas".
- **Fatura de cartão:** a do Nubank (`date,title,amount`) e o OFX de cartão (`<CCSTMTRS>`) são recusados com uma explicação, porque numa conta inverteriam os sinais.
- **Formatos:**
  - sinal no fim ("10,00-"), sufixo D/C, menos Unicode;
  - coluna "Tipo" (D/C) e colunas de crédito e débito separadas;
  - data com hora;
  - ano com 2 dígitos ("99" é 1999);
  - OFX com o ponto sempre decimal;
  - cabeçalho procurado nas 20 primeiras linhas;
  - aspas com quebra de linha;
  - separador contado fora das aspas.
- **Palavras-chave:** mantêm os números ("99app"), e "Mercado Livre" é Compras.
- **Tela:**
  - a conta fica travada durante a leitura;
  - a prévia guarda a conta para a qual foi feita;
  - uma resposta velha é ignorada;
  - o mesmo arquivo pode ser lido de novo;
  - as linhas usam `memo` (1.000 itens);
  - aparecem o erro das categorias e o "lendo" anunciado.
- **Limite:** 30 pedidos de importação por hora por pessoa.
