# Entradas de estoque (`features/stock-entries`)

O recebimento de mercadoria: a nota do fornecedor que vira **lote**, atualiza o
custo e o preço de venda do produto e pode ser cancelada. É o único caminho pelo
qual estoque **nasce** — não existe edição direta de saldo.

## Onde isto aparece na tela

**Só na aba Estoque do cadastro do produto** (`features/products`), desde
13/09/2026. A listagem geral `/estoque/entradas` saiu do admin junto com o item
de menu "Entradas".

Ela existia de quando a entrada era uma nota com vários produtos. Desde
31/08/2026 **a entrada é de UM produto por vez**, e a pergunta que a listagem
respondia — "o que entrou na loja?" — passou a custar uma busca por produto para
chegar no que interessa. A pergunta de quem abre o admin é outra: "o que entrou
DESTE produto, a que custo, com que margem?" — e essa é a aba, que já mostra as
notas daquele produto com detalhe e cancelamento.

Saíram com ela: `pages/stock-entries.tsx`, `useStockEntries`,
`StockEntriesTable` e `NewStockEntryModal` (o formulário com busca de produto).
O caminho antigo responde "página não encontrada": a tela não mudou de lugar,
deixou de existir, e redirecionar para Produtos seria adivinhar.

## Estrutura

- `hooks/useProductStockEntries.ts` — o histórico de UM produto e o lançamento.
  Alimenta a aba Estoque. Mora aqui, e não em `features/products`, porque tudo
  que ele sabe é regra de entrada de mercadoria: a data sem fuso, a validação do
  rascunho e a invalidação por prefixo. Duplicá-las lá reabriria a armadilha que
  o `toISOString()` já custou uma vez.
- `components/SimpleStockEntryModal.tsx` — o lançamento. Um produto, sem busca:
  quem chegou pela aba já escolheu o produto.
- `components/StockEntryDetailsModal.tsx` — o espelho da nota e o cancelamento.
- `components/PricingPreview.tsx` — margem, markup e preço sugerido. Usado
  também pela compra e pelo recebimento (`features/purchases`).
- `lib/margin-tone.ts` — a cor de cada faixa de margem.
- `types.ts` — só o que é da TELA. O que descreve a resposta da API vive em
  `packages/api-client` (`ReceivedPurchaseEntryDto`); as cópias locais saíram em
  13/09/2026, e uma delas já estava incompleta — faltava `userName`, e era por
  isso que a modal de detalhes tipava a nota como `any`.

## Regras de negócio

### 1. A data viaja como instante LOCAL, sem fuso

O payload leva `2026-08-16T00:00:00` — **nunca** `toISOString()`. Não é
preciosismo: `entry_date` é `timestamp without time zone` e o Npgsql **recusa**
um `DateTime` com `Kind=Utc` nessa coluna; o `...T00:00:00.000Z` derrubava a
gravação com **500**. Mesmo que gravasse, a entrada do dia 16 cairia no dia 15.
Ver `docs/fuso-horario.md` do backend.

### 2. Validações ao salvar

- Fornecedor e data são obrigatórios.
- Quantidade inteira e maior que zero — o backend só aceita inteiro, e fração
  virava 400 cru.
- Custo unitário não-negativo: **zero é legítimo** (bonificação, brinde).
- **Preço de venda maior que zero.** O valor lançado **sobrescreve** o preço do
  produto no cadastro; zero aqui zerava o preço da loja em silêncio. O backend
  recusa pela mesma razão (`ReceivePurchaseEntryItemRequest`).
- **Idempotência:** cada lançamento envia um `clientReference` (UUID) gerado na
  abertura da modal. Um retry depois de timeout reenvia a mesma chave e o backend
  devolve a nota já gravada, em vez de duplicar lote e estoque. A chave é
  renovada a cada abertura — nunca por tentativa.
- **Data futura é recusada**, no calendário (`maxDate`) e no backend: uma entrada
  futura viraria o lote "mais recente" e passaria a ditar o `costPrice` do
  produto. Retroativa continua valendo.

### 3. Ordenação

A listagem vem do backend por **data de entrada decrescente e, no empate, id
decrescente** (`PurchaseEntryService.GetAllAsync`). O empate é o caso comum: a
data é um dia-calendário à meia-noite, então tudo lançado no mesmo dia empata e a
nota registrada por último aparece primeiro.

**Uma nota retroativa não vai para o topo** — ela cai no dia que o operador
escolheu. Isso é a ordenação funcionando, não defeito.

### 4. Cancelamento

Cancelar uma entrada **apaga os lotes dela** e recalcula o saldo dos produtos.
Por isso só existe enquanto o lote está **intacto** (`canDelete`, do backend:
nenhum lote com `AvailableQuantity < OriginalQuantity`).

Quando não dá, a modal **diz por quê** e aponta a saída — a Contagem Física da
mesma aba, que lança a diferença como baixa ou ajuste. Antes o botão apenas
sumia, e a tela parecia quebrada para quem tinha acabado de cancelar outra.

### 5. O que a aba mostra, e o que ela não mostra

- **A lista é de NOTAS filtradas por `productId`**, e a coluna de valor é o total
  da NOTA — `GET /PurchaseEntries` não quebra por item. Quantidade e custo
  daquele produto saem nos detalhes, pelo olho da linha.
- **A margem da linha usa o preço de venda de HOJE**, e responde "se eu vender
  pelo preço atual, quanto sobra do que paguei naquela compra?". É o que deixa
  comparar duas entradas do mesmo produto. Usar o preço da época exigiria um
  histórico de preço que não existe.
- **Custo e preço vêm sugeridos do cadastro**, lidos por `GET /Products/{id}`. O
  botão de lançar fica desabilitado até esse produto chegar: abrir antes
  preencheria os dois com 0 — e o preço lançado passa a valer no cadastro.
- **O fornecedor vem pré-selecionado** com o da entrada mais recente: o caso
  comum é repor com quem já vendeu.
- **A invalidação inclui `RESOURCE_KEYS.products`.** Receber mercadoria grava
  custo, preço e saldo no PRODUTO; sem essa chave, a listagem atrás da tela
  continuaria mostrando o estoque de antes.
- **Trocar de variação volta para a página 1.** Manter a página 3 do SKU anterior
  mostraria "nenhuma entrada" para um produto que tem entradas.

## Margem, markup e preço sugerido (05/09/2026)

Assim que há custo digitado, a modal mostra a **margem prevista**
(`(preço − custo) / preço`), o **markup** (`(preço − custo) / custo`) e um **preço
sugerido** — 40% de margem, arredondado ao múltiplo de dez centavos
(`suggestedPrice`, em `packages/core/src/pricing.ts`). "Usar sugerido" copia o
valor; sugerir não é impor.

Existe porque o preço lançado passa a valer no cadastro, e a modal não dizia nada
sobre a conta: quem recebia a custo novo calculava de cabeça se o preço antigo
ainda dava lucro. O bloco some com custo zero — brinde entra sem custo, e "margem
100%" ali seria ruído.
