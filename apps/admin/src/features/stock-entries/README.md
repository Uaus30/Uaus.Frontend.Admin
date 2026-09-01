# Módulo de Entradas de Estoque (`features/stock-entries`)

Este módulo gerencia o recebimento de mercadorias no estoque, permitindo o registro de notas fiscais de fornecedores, atualização instantânea de custo/preço de venda de produtos e o cancelamento de lançamentos. Ele segue o padrão **AI-First**.

**Desde 31/08/2026 a entrada é de UM produto por vez, nas duas rotas** (página
Entradas e aba Estoque do detalhe do produto). A decisão é de controle — um lote
por lançamento, conferível de uma olhada — e de simplicidade: a grade multi-item
exigia busca, tabela e soma de linhas para o caso raro. Nota com vários produtos
vira um lançamento por item; o backend continua aceitando lista em
`POST /PurchaseEntries/receive`, então notas antigas multi-item seguem legíveis.

---

## 📂 Estrutura de Arquivos

- `components/StockEntriesTable.tsx`: Exibe o histórico de entradas de estoque registradas com suporte a filtragem por fornecedor e controles de paginação.
- `components/StockEntryDetailsModal.tsx`: Modal exibindo o espelho da nota fiscal, produtos recebidos com seus respectivos custos e preços, além do controle para exclusão de lançamento (cancelamento de entrada).
- `components/NewStockEntryModal.tsx`: Modal contendo formulário de cabeçalho da nota (fornecedor, NF, data, observações) e a grade dos itens recebidos. O produto entra pelo [`ProductSearchPicker`](../../components/product-search-picker.tsx) compartilhado com as baixas de estoque. A data usa o `DatePicker` do [padrão de calendário](../../components/ui/README.md); como ele abre num portal fora do modal, o `DialogContent` aplica `guardCalendarDismiss` para não fechar o formulário ao escolher um dia.
- `components/SimpleStockEntryModal.tsx`: Lançamento de UM produto, aberto de dentro da tela do produto. Mesmo `POST /PurchaseEntries/receive`, com um item só e sem busca de produto. Ver seção 6.
- `hooks/useStockEntries.ts`: Centraliza requisições paginadas (`useGetPurchaseEntries`), detalhes (`useGetPurchaseEntryDetails`), mutations de recebimento (`useReceivePurchaseEntry`), mutations de exclusão (`useDeletePurchaseEntry`), e sincronização de query strings.
- `hooks/useProductStockEntries.ts`: A mesma coisa recortada em UM produto — alimenta a aba **Estoque** da tela de detalhe do produto. Ver seção 6.
- `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. O produto entra por busca, não por lista

- O catálogo passa de mil produtos: quem escolhe é a API, pelo `ProductSearchPicker`, que aceita **nome ou código de barras** (o backend decide qual dos dois pelo formato do termo, a mesma regra da tela de produtos e do PDV).
- Escolher outro produto **troca** o atual — a entrada é de um produto só. O X no cartão do produto limpa a escolha para buscar de novo.
- A escolha já sugere o preço de venda (`price`), o custo (`costPrice`) e mostra o estoque atual com a prévia "X → X+N". É sugestão, não imposição: a nota manda no custo, e os campos seguem editáveis.
- Preço abaixo do custo não é bloqueado, mas a modal avisa que a margem será negativa.

### 2. A data viaja como instante LOCAL, sem fuso

- O payload leva `2026-08-16T00:00:00` — **nunca** `toISOString()`.
- Não é preciosismo de fuso: `entry_date` é `timestamp without time zone` e o Npgsql **recusa** gravar um `DateTime` com `Kind=Utc` nessa coluna. O `...T00:00:00.000Z` que o `toISOString()` produzia derrubava a gravação com **500**. Mesmo que gravasse, a entrada do dia 16 cairia no dia 15 no Brasil.
- A convenção completa está em `docs/fuso-horario.md` do backend.

### 3. Validações ao Salvar

- O fornecedor, a data e o produto são obrigatórios.
- Quantidade: inteira e maior que zero (o backend só aceita inteiro; fração virava 400 cru).
- Custo unitário: não-negativo — **zero é legítimo** (bonificação, brinde).
- **Preço de venda: maior que zero.** O valor lançado sobrescreve o preço de venda do produto no cadastro; zero aqui zerava o preço da loja em silêncio. O backend recusa desde a mesma correção (`ReceivePurchaseEntryItemRequest`).
- **Idempotência**: cada lançamento envia um `clientReference` (UUID) gerado na abertura da modal; um retry depois de timeout reenvia a mesma chave e o backend devolve a nota já gravada em vez de duplicar lote e estoque. A chave é renovada a cada abertura/reset — nunca por tentativa.
- **Data futura é recusada** — no calendário (`maxDate`) e no backend. Uma entrada futura viraria o lote "mais recente" e passaria a ditar o `costPrice` do produto. Retroativa continua permitida.
- Os campos de custo e preço usam o `CurrencyInput` (vírgula), o mesmo do resto do admin; a quantidade não tem trava no `onChange` — limpar o campo não volta para 1, quem barra zero é o submit.

### 4. Ordenação e recarga da listagem

- A listagem vem do backend ordenada por **data de entrada decrescente e, no empate, por ID decrescente** (`PurchaseEntryService.GetAllAsync`). O empate é o caso comum: como a data é um dia-calendário à meia-noite, tudo que foi lançado no mesmo dia empata, e aí a nota registrada por último aparece primeiro.
- **Uma nota retroativa não vai para o topo** — ela cai na posição do dia que o operador escolheu. Isso é a ordenação funcionando, não um defeito: uma entrada lançada hoje com data de três dias atrás aparece três dias atrás.
- Depois de salvar, a tela **volta para a página 1** e invalida a listagem pelo prefixo da chave (`getGetPurchaseEntriesQueryKey`). Os dois passos importam: `refetch()` sozinho atualizaria só a página aberta e deixaria as outras no cache com dados velhos, e ficar na página 2 esconderia justamente a nota que acabou de ser lançada.
- Trocar o filtro de fornecedor também volta para a página 1, senão o recorte novo — que costuma ter menos páginas — mostraria "nenhuma entrada".
- A listagem mostra o **nome (composto) do produto** da entrada (`firstProductName` do DTO); notas antigas multi-item exibem o primeiro produto e um selo `+N`. Ajustes manuais de estoque (edição inline na tabela de produtos) aparecem com o selo **Ajuste manual** no lugar do número da nota (`type` do DTO, normalizado com `enumCode` + `PURCHASE_ENTRY_TYPE`).

### 5. Cancelamento de Entrada

- A exclusão de uma entrada é permitida (controlada pelo flag `canDelete` do backend).
- O cancelamento remove os lotes de estoque lançados por esta entrada e atualiza/recalcula os saldos físicos vigentes dos produtos relacionados.
- Se o estoque de algum item da entrada já tiver sido vendido/consumido abaixo da quantidade de cancelamento, o backend retornará um erro impedindo a remoção.

### 6. A entrada simplificada, lançada de dentro do produto (30/08/2026)

A tela de detalhe do produto (`features/products`) ganhou uma aba **Estoque**, e
ela é servida por `useProductStockEntries` — daqui, não de lá. O motivo é que
tudo o que ela sabe é regra desta feature: a data sem fuso da seção 2, as
validações da seção 3 e a invalidação por prefixo da seção 4. Duplicar isso na
outra feature reabriria a armadilha que o `toISOString()` já custou uma vez.

O que muda em relação ao formulário completo:

- **Sem busca de produto.** Quem chegou pela aba já escolheu o produto;
  reapresentar a busca era o atrito que a tela veio resolver. Desde 31/08/2026
  as duas rotas são de um produto por vez — a diferença entre elas é só a busca.
- **Custo e preço vêm sugeridos do cadastro**, lidos por `GET /Products/{id}`. É
  sugestão, não imposição, igual à seção 1. O botão **Registrar Entrada** fica
  desabilitado até esse produto chegar: abrir antes preencheria custo e preço
  com 0 — e o preço lançado passa a valer no cadastro.
- **O fornecedor vem pré-selecionado** com o da entrada mais recente do produto
  (primeiro item da listagem, que é ordenada da mais nova para a mais velha):
  o caso comum é repor com quem já vendeu.
- **A listagem da aba é filtrada por `productId`** e mostra o total da NOTA, não
  o do produto: `GET /PurchaseEntries` não quebra por item. Quantidade e custo
  daquele produto saem nos detalhes.
- **A invalidação inclui `RESOURCE_KEYS.products`.** Receber mercadoria grava
  custo, preço e saldo no PRODUTO; sem essa chave, a listagem de produtos atrás
  da tela continuaria mostrando o estoque de antes. O formulário completo não
  precisava disso porque não há tela de produto por baixo dele.
- **Trocar de produto volta para a página 1.** Numa aba com seletor de variação,
  manter a página 3 do SKU anterior mostraria "nenhuma entrada" para um produto
  que tem entradas.
