# E-003 — Decisões sobre lançamentos de dívida com leitura antiga ou dívida excluída

_Nota de decisão curta (T-007). Segue o E-002, corrigido em 74759d5 e 215eb12._

## Problema

As operações de dívida são feitas uma de cada vez: cada uma trava a linha da dívida (`SELECT ... FOR UPDATE` em
`lockAndCheck`). O E-002 mostrou que pagar uma parcela decidia com o lançamento lido **antes** da trava. O Reviewer
apontou o mesmo padrão em mais dois lugares. Na varredura apareceu um terceiro caso, da mesma família.

## Caminhos avaliados

| Caminho | Corrida | Antes | Decisão |
|---|---|---|---|
| `transactions.service.ts` `update` (editar lançamento) | editar uma parcela enquanto o cancelamento do acordo a apaga | **500** (P2025 do Prisma no `update` de linha apagada) | **Corrigido**: num lançamento de dívida, a gravação vai para o `withDebtLock`, relê o lançamento (404 se sumiu) e confere o valor da parcela com a leitura nova (mesma mensagem 422 de antes) |
| `debts.repository.ts` `lockAndCheck` (toda operação travada da dívida) | pagar, desmarcar ou editar uma parcela, registrar pagamento, atualização ou acordo enquanto a dívida é excluída | **500** (`Error('Dívida sumiu durante a operação')`) | **Corrigido**: `NotFoundError('Dívida')`, ou seja, 404, como se a requisição tivesse chegado depois da exclusão |
| `recurrences.service.ts:191` (`updateFuture` muda o `paidDate` da paga) | — | — | **Não alcançável** para dívida: lançamento de dívida nunca tem `recurrenceId`. Ele só nasce em `debts.repository` (`txData`) e na demo, os dois sem recorrência; `createTransactionSchema` não aceita `debtId`; o `update` descarta `recurrence`; e esse ramo exige `current.recurrenceId`. Além disso, ele já relê o lançamento com a recorrência travada (`lockFresh`) |
| `update` → `followPaidDate` / `movePaidDate` | — | — | Não se aplica: lançamento de dívida é excluído da regra (`current.debtId`) |
| `remove` (excluir lançamento) | — | — | Sem mudança: o 422 depende de `debtId` e `installmentNumber`, que a corrida não altera. O cancelamento só apaga parcelas pendentes, e elas já dão 422 aqui |

## Regras mantidas

- Mesmas mensagens 422 (`DEBT_INSTALLMENT_MESSAGES`).
- Lançamento sem dívida: o caminho não muda (sem trava extra).
- Desvio pequeno de camada: `debts.repository.ts` passa a importar `NotFoundError`. O `lockAndCheck` é o único ponto
  de todas as operações travadas da dívida, e as conferências dos serviços já rodam dentro dele.

## Limite conhecido

Desmarcar um pagamento avulso cuja dívida foi excluída no mesmo instante responde 404 ("Dívida não encontrada").
O pagamento continua existindo, agora sem vínculo, e uma nova tentativa funciona. É uma corrida rara, e a resposta
está correta para o estado do momento da trava.

## Testes

Em `apps/api/test/debts.test.ts`, o helper `raceBehindLock` segura uma trava e só dispara cada requisição depois que
a anterior entrou na fila atrás dela. A espera é filtrada pelo banco de teste e pela cadeia de bloqueio
(`pg_blocking_pids`), e no `finally` o helper aguarda as requisições em voo. Testes novos, que falhavam com 500 antes:
editar parcela × cancelar acordo; pagar parcela × excluir dívida. O teste do E-002 passou a usar o mesmo helper.
