# Módulo de Baixas de Estoque (`features/stock-write-offs`)

Saída de mercadoria **sem venda**: consumo interno, perda, doação e a falta apurada na contagem. Contrato e regras do backend em [`baixas-de-estoque.md`](../../../../../Uaus.Backend.Api/docs/baixas-de-estoque.md).

---

## 📂 Estrutura de Arquivos

- `components/StockWriteOffsTable.tsx`: Listagem com a barra de filtros (período, motivo, situação e quem registrou) e a paginação. O período usa o `DateRangePicker` do [padrão de calendário](../../components/ui/README.md).
- `components/StockWriteOffDetailsModal.tsx`: Espelho da baixa com os itens (produto, código de barras, quantidade e custo) e o bloco do estorno quando ele existe.
- `components/RegisterStockWriteOffModal.tsx`: Formulário de registro — motivo, itens e observação.
- `components/ProductSearchPicker.tsx`: Busca de produto no molde do `TagMultiSelect`: `Command` com `shouldFilter` desligado, porque quem filtra é a API.
- `components/ReverseStockWriteOffDialog.tsx`: Confirmação do estorno, com o campo de motivo.
- `hooks/useStockWriteOffs.ts`: Listagem (`useGetStockWriteOffs`), detalhes, rascunho do registro e as mutations de registro e estorno.
- `types.ts`: Estado dos filtros, rascunho de item e opção de produto.
- Acesso a dados e montagem de payload: [`@/features/stock-write-offs/domain.ts`](../../services/stock-write-offs.service.ts).

---

## ⚙️ Regras de Negócio Importantes

### 1. Inventário não é um motivo escolhível

- O select de registro vem de `SELECTABLE_STOCK_WRITE_OFF_REASONS`, que exclui Inventário: esse motivo é gerado pela importação da contagem, o único caminho autorizado a baixar acima do saldo em lote.
- A guarda também vive em `submitStockWriteOff`, para a regra não depender do que a tela renderizou.
- No **filtro** da listagem Inventário aparece, porque essas baixas existem no histórico.

### 2. Estorno em vez de exclusão

- Baixa não se apaga: apagar deixaria o estoque reduzido sem contrapartida. Estornar devolve aos lotes o que cada um cedeu e mantém o registro, marcado como estornado.
- Só baixa **efetivada** pode ser estornada, e o motivo do estorno é obrigatório — é o que explica o lançamento no histórico.
- Na listagem, a linha estornada fica esmaecida e com os números riscados.

### 3. Custo congelado

- `totalCost` é o custo FIFO do momento da baixa, não o custo atual do produto: `stock_lots.unit_cost` é mutável e editar uma entrada de compra o reescreve.

### 4. Erros da API

- Toda falha passa por `describeApiError` (de `@workspace/core`), que prefere as frases de `ValidationProblemDetails` ao título genérico do ASP.NET. É assim que "Estoque insuficiente para baixa do produto #5" chega ao toast.
