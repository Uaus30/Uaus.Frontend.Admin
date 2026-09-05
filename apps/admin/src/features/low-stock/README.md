# Estoque baixo (`features/low-stock`)

Relatório dos produtos abaixo do estoque mínimo, com o "resolvido" por item, e
o alerta vermelho que aparece no painel e no topo da listagem de produtos.

## Regras de negócio

- **O que é "baixo".** Produto vivo (não excluído, não inativo, não rascunho),
  com **estoque mínimo configurado** (`minStock > 0`, aba Opcionais do
  produto) e saldo **igual ou abaixo** do mínimo. Mínimo zero é "não controlo
  este item": sem essa exigência todo produto zerado do catálogo entraria no
  alerta. O critério é o MESMO do relatório de inventário (`Stock <= MinStock`),
  para os dois números não divergirem — a regra mora no backend
  (`LowStockService.IsLowStock`), não aqui.
- **Resolvido não mexe em estoque.** É a marca "já tratei" — pedido feito ao
  fornecedor, item que vai ser descontinuado. O produto sai da **contagem de
  pendentes** (que acende o vermelho) mas continua no relatório, esmaecido, com
  quem e quando. A marca **cai sozinha na próxima entrada de estoque** do
  produto: entrada nova é situação nova. Se depois da entrada ele continuar
  abaixo do mínimo, volta ao alerta — que é o correto.
- **O alerta só acende com pendente > 0.** `LowStockAlert` some com zero: um
  alerta permanentemente aceso ensina a ignorá-lo. Ele mora em duas telas
  (Dashboard e Produtos) e usa o MESMO hook de contagem do relatório
  (`useGetLowStockSummary`), então painel, listagem e relatório nunca discordam.
- **Resolver invalida o prefixo `["low-stock"]`**, que cobre lista (todas as
  páginas e filtros) e contagem. Sem isso o relatório atualizaria e o alerta do
  painel seguiria vermelho até um F5.

## Decisões de implementação

- **Contagem em endpoint próprio** (`/LowStock/summary`): o painel abre a cada
  visita e só precisa do número; baixar a lista seria pagar pelo relatório sem
  abri-lo. Um minuto de `staleTime` — o número muda com venda e entrada, não a
  cada clique.
- **`LOW_STOCK_REPORT_PATH`** (`low-stock-route.ts`) é a única string do caminho:
  rota, alerta do painel e alerta da listagem apontam para ela.
- **O link do produto abre o detalhe pelo id do GRUPO** (`/produtos/<grupo>/detalhes`),
  que é o que a tela edita; o item traz `productGroupId` justamente para isso.
- Busca e filtro de resolvidos voltam para a página 1 nos próprios setters, não
  em efeito (armadilha do `setState` em `useEffect` que o lint recusa).
