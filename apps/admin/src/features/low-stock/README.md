# Estoque baixo (`features/low-stock`)

Relatório dos produtos que precisam de reposição, o fluxo que trata cada um e
o alerta vermelho que aparece no painel e no topo da listagem de produtos.

## Regras de negócio

- **O que é "baixo".** Produto vivo (não excluído, não inativo, não rascunho),
  com **estoque mínimo configurado** (`minStock > 0`, aba Opcionais do
  produto) e saldo **igual ou abaixo** do mínimo. Mínimo zero é "não controlo
  este item": sem essa exigência todo produto zerado do catálogo entraria no
  alerta. O critério é o MESMO do relatório de inventário (`Stock <= MinStock`),
  para os dois números não divergirem — a regra mora no backend
  (`LowStockService.IsLowStock`), não aqui.
- **Filtro "estoque menor que" (06/09/2026).** Preenchido, a pergunta muda:
  passa a ser "quem tem menos de N unidades", **ignorando o mínimo** — senão o
  filtro deixaria de fora justamente os produtos sem controle de estoque, que
  são os que o operador quer varrer. Vazio, zero e lixo digitado voltam ao
  padrão.
- **Resolver é registrar a compra (06/09/2026).** A reposição é um fluxo com
  dependência: um alerta só está tratado quando existe um **pedido de compra**.
  - Sem compra em aberto, o botão leva a `/estoque/compras?produto=&fornecedor=`
    com o formulário já preenchido (produto, último fornecedor, situação
    Pendente, quantidade que recompõe o mínimo) e avisa em laranja. **Nada é
    marcado** — marcar aqui esconderia o vermelho sem ninguém ter comprado nada.
  - Com compra em aberto (`hasOpenPurchase`), pergunta e, confirmando, marca
    como resolvido. Compra **lançada** não conta: ela já virou entrada, e o
    produto continuar baixo significa que aquele pedido não resolveu.
- **Resolvido não mexe em estoque.** É a marca "já tratei". O produto sai da
  contagem de pendentes (que acende o vermelho) mas continua no relatório,
  esmaecido, com quem e quando. A marca **cai sozinha na próxima entrada** do
  produto.
- **O que tira um produto do relatório.** Uma **entrada de estoque** que leve o
  saldo acima do mínimo tira sozinha — o critério é avaliado a cada consulta, e
  nada precisa ser "baixado" na lista. **Remover o controle de estoque** (menu
  de opções) zera o mínimo e também tira, sem tirar o produto do catálogo; a
  mudança fica no histórico do produto.
- **O alerta só acende com pendente > 0.** `LowStockAlert` some com zero: um
  alerta permanentemente aceso ensina a ignorá-lo. Ele usa o MESMO hook de
  contagem do relatório, então painel, listagem e relatório nunca discordam.

## Giro do produto (06/09/2026)

Duas colunas respondem à pergunta que decide se vale repor — um produto parado
há um ano com saldo 1 não é urgência:

- **Última venda**: a venda mais recente não cancelada, de toda a história.
- **Dura**: previsão de duração do saldo no ritmo dos **últimos 90 dias**
  (`LowStockService.SalesWindowDays`), pela mesma fórmula do painel de
  inteligência (`DashboardMath.DaysOfCover`). Sem giro na janela a coluna fica
  vazia: zero diria "acaba hoje" para um produto que não sai. A cor é vermelha
  até uma semana e âmbar até três.
- **Saldo zero diz "esgotado", não "acaba hoje"** (06/09/2026). Com saldo zero
  não há previsão a fazer — o produto já acabou, e mandar conferir uma data que
  passou confunde quem está decidindo o que comprar hoje.

## Exportação XLSX

O botão "Exportar XLSX" gera um arquivo de verdade (ExcelJS), com cabeçalho em
negrito sobre fundo escuro, painel congelado, autofiltro, largura por coluna e
o saldo em vermelho nas linhas abaixo do mínimo. Não é CSV renomeado como o do
inventário: o pedido era cabeçalho formatado, e CSV não carrega formato nenhum.

- A exportação **refaz a consulta** com os filtros da tela (até mil linhas), em
  vez de usar a página em memória: ninguém exporta um relatório para receber as
  vinte linhas da página corrente.
- O ExcelJS entra por `import()` dinâmico **e** tem chunk próprio no
  `vite.config.ts` (`vendor-xlsx`). Sem a segunda parte o `manualChunks` o
  puxaria para o vendor comum, que todo mundo baixa no primeiro paint — foram
  929 kB fora do carregamento inicial.

## Decisões de implementação

- **Contagem em endpoint próprio** (`/LowStock/summary`): o painel abre a cada
  visita e só precisa do número. Um minuto de `staleTime`.
- **`LOW_STOCK_REPORT_PATH`** (`low-stock-route.ts`) é a única string do
  caminho: rota, alerta do painel e alerta da listagem apontam para ela.
- **O link do produto abre pelo id do GRUPO** (`/produtos/<grupo>/detalhes`),
  que é o que a tela edita; o item traz `productGroupId` para isso.
- Busca, teto de saldo e filtro de resolvidos voltam para a página 1 nos
  próprios setters, não em efeito.
