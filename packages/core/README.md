# @workspace/core

Regras de domínio compartilhadas entre o Admin e o PDV. Lógica pura: sem React,
sem rede, sem DOM.

## Por que este pacote existe

O monorepo tinha quatro lugares para código (`apps/admin`, `apps/pdv`,
`packages/api-client`, `packages/ui`) e nenhum deles servia para uma regra de
negócio que os dois apps precisam calcular igual. O resultado era duplicação —
e duplicata aqui **divergiu na prática**: `round2` chegou a ter cinco
implementações e três algoritmos, com o total exibido no carrinho podendo não
bater com o total enviado à API nem com o subtotal impresso no cupom.

## O que entra

| Arquivo | Responsabilidade |
| --- | --- |
| `money.ts` | `round2`, `parseAmount`, `parseAmountOrNull`, `formatCurrency`, `formatQuantity`, `formatPercentage` |
| `format.ts` | `formatDate`, `formatShortDate`, `toDateKey` |
| `text.ts` | `normalizeSearchText` |
| `mask.ts` | `cleanPhone`, `formatPhone` |
| `api-error.ts` | `describeApiError` |

## O que NÃO entra

- Chamada HTTP, DTO do backend e hook de query → `@workspace/api-client-react`
- Componente visual → `@workspace/ui`
- Montagem do cupom impresso → `@workspace/receipt`
- Regra que só um dos apps usa → fica no `src/lib/` do app

## Regras de negócio embutidas

1. **Arredondamento monetário usa `Number.EPSILON`.** `Math.round(1.005 * 100)`
   devolve 100 em ponto flutuante binário, e o centavo some. Somar o epsilon
   antes da multiplicação empurra o número para o lado certo da fronteira.
   Os casos 1,005 / 1,045 / 1,335 / 2,675 estão no teste porque eram exatamente
   onde os algoritmos antigos divergiam.

2. **Data de calendário nunca passa por `toISOString()`.** O método converte
   para UTC, e no Brasil (UTC-3) isso joga o dia para trás em qualquer horário
   antes das 21h — "hoje" vira "ontem" no filtro. Use `toDateKey`.

3. **Campo de dinheiro vazio vale zero, texto ilegível vale `null`.**
   `parseAmount` devolve `NaN` para os dois casos, e quem chamava direto mandava
   `NaN` para a API. `parseAmountOrNull` separa "não informou" de "digitou
   bobagem".

4. **Máscara de telefone é progressiva.** Fechar parênteses e hífen antes da
   hora faz o cursor pular no meio da digitação. E ela é idempotente: o campo
   remascara a cada tecla, então formatar o já formatado é o caminho normal.

5. **`describeApiError` lê o erro por duck typing**, não por `instanceof
   ApiError` — é o que mantém o helper independente do cliente HTTP e testável
   sem mock de rede. Ele existe para desempacotar o `ValidationProblemDetails`
   do ASP.NET, que sem tratamento chega ao usuário como "One or more validation
   errors occurred".

## Testes

```bash
npm run test:core
```

Toda função exportada daqui tem teste. É a regra do pacote: se a lógica é
importante o bastante para ser compartilhada, é importante o bastante para ser
coberta.
