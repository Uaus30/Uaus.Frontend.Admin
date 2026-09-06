# Estoque baixo (`features/low-stock`)

Relatório dos produtos que precisam de reposição e o alerta vermelho que
aparece no painel e no topo da listagem de produtos.

É uma tela **sem estado próprio**: ela responde "o que comprar hoje?" a cada
consulta e não guarda nada sobre o que já foi tratado — isso vive nas compras e
nas entradas de estoque.

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
- **Filtro "vendeu ao menos N em 30d" (06/09/2026).** Mesma regra e mesmo
  motivo: ignora o estoque mínimo. A pergunta que ele responde — "o que está
  acabando e TEM saída?" — só faz sentido alcançando os produtos sem controle
  de estoque. Combinado com o teto de saldo, é a varredura completa: pouco
  estoque **e** giro.
- **O relatório não guarda estado por item (06/09/2026).** Não existe
  "resolvido", nem histórico do que já foi tratado, nem a flag "mostrar
  resolvidos". Quem registra que a reposição foi **encaminhada** é a compra;
  quem registra que ela **chegou** é a entrada de estoque. Uma terceira marca de
  "já tratei" duplicava as duas, podia contradizê-las e, sendo manual,
  envelhecia sozinha. As colunas `low_stock_resolved_at` e
  `low_stock_resolved_by` continuam no banco, sem uso e sem mapeamento — tirá-las
  é script destrutivo, que espera decisão.
- **A ação da linha é "Comprar".** Leva a
  `/estoque/compras?produto=&fornecedor=` com o formulário já preenchido
  (produto, último fornecedor, situação Pendente, quantidade que recompõe o
  mínimo). Sem toast: o botão diz o que faz e a tela de destino confirma.
  - **Ele some quando já existe compra em aberto** (`hasOpenPurchase`): o pedido
    está feito e não há o que fazer daqui. No lugar dele fica o aviso "compra em
    aberto" — célula vazia pareceria linha quebrada.
  - Compra **lançada** não conta como em aberto: ela já virou entrada, e o
    produto continuar baixo significa que aquele pedido não resolveu.
- **O que tira um produto do relatório.** Uma **entrada de estoque** que leve o
  saldo acima do mínimo tira sozinha — o critério é avaliado a cada consulta, e
  nada precisa ser "baixado" na lista. **Remover o controle de estoque** (menu
  de opções) zera o mínimo e também tira, sem tirar o produto do catálogo; a
  mudança fica no histórico do produto. É a única ação da tela que pede
  confirmação, porque é a única que altera cadastro sem desfazer à vista.
- **O alerta conta quem VENDE e está acabando (06/09/2026).** `LowStockAlert`
  usa `summary.restock`, não `summary.pending`: a contagem antiga acendia o
  vermelho também para item parado há um ano, que não é urgência de reposição —
  e alerta que aponta para o que não precisa de ação ensina a ser ignorado.
  - "Está acabando" respeita o **estoque mínimo** de quem tem um (decisão de
    quem cadastrou) e usa um **teto de 5 unidades** para quem não tem; sem o
    teto, produto sem controle de estoque nunca acenderia, e é ali que mora boa
    parte do que vende e some sem ninguém perceber.
  - "Vende" é ter saído ao menos **3 unidades em 30 dias**. Os dois números são
    do backend (`LowStockService.AlertMinRecentSales` e `AlertStockCeiling`); a
    tela não os repete — o mínimo de vendas volta na resposta
    (`restockMinSales`) e monta o texto e o link.
  - O link já leva `?vendas=<mínimo>`, e o relatório abre com o campo
    preenchido e **editável**. Sem isso a pessoa cairia numa lista de outro
    critério e teria de reconstruir na mão o que o alerta já sabia.
  - Com zero, o alerta some.

## Giro do produto (06/09/2026)

Três colunas respondem à pergunta que decide se vale repor — um produto parado
há um ano com saldo 1 não é urgência:

- **Última venda**: a venda mais recente não cancelada, de toda a história.
- **Vendas 30d**: unidades vendidas nos últimos 30 dias
  (`LowStockService.RecentSalesWindowDays`), sem as canceladas. É a coluna do
  filtro e da ordenação. A janela é mais curta que a da previsão **de
  propósito**: a previsão quer ritmo estável, e noventa dias diluem um mês
  atípico; esta quer saber se o produto está saindo AGORA. Um item que vendeu
  bem em julho e parou em setembro tem média boa e nenhuma urgência.
  - O valor vem da **projeção** no backend, não do preenchimento por página.
    Filtrar e ordenar depois de paginar filtraria a página, não o relatório: a
    segunda página traria linhas que a primeira já deveria ter excluído.
  - **Clicar no cabeçalho** cicla mais vendido → menos vendido → padrão. O
    terceiro estado existe porque a ordem padrão (o mais crítico primeiro) é a
    razão de ser do relatório; sem ele, quem ordenasse uma vez a perderia até
    recarregar a tela. Menos vendido primeiro é a pergunta oposta e igualmente
    útil: saldo baixo sem saída é candidato a **não** repor.
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
  `lowStockRestockPath` monta o link com o filtro do alerta e
  `salesFilterFromUrl` o lê — uma vez, na montagem, para o campo continuar
  editável e apagá-lo não fazer o filtro voltar.
- **A tela não repete a contagem em cards** (06/09/2026). Os dois cards
  (pendentes e resolvidos) diziam, em números grandes, o que a lista logo
  abaixo já mostra — e quem chega pelo alerta já leu o número lá.
- **A tabela tem largura mínima e rola na horizontal.** Sem isso o navegador
  espreme as colunas para caber e a última — a das ações — perde espaço, com o
  botão cortado. Pelo mesmo motivo saíram da tela a **categoria** e a
  **situação**: a primeira não decide reposição e a segunda virou redundante
  quando o "resolvido" acabou. A categoria continua no XLSX, que não disputa
  largura com botão.
- **O nome do produto tem teto de ~40 caracteres e quebra linha** (`max-w-[40ch]`
  - `break-words`), em vez de truncar. Nome com variação passa de sessenta
    caracteres com facilidade, e uma coluna que cresce sem limite empurra as
    demais para fora da tela; cortar com reticências esconderia o fim do nome, que
    é onde mora a variação que distingue duas linhas iguais.
- **O link do produto abre pelo id do GRUPO** (`/produtos/<grupo>/detalhes`),
  que é o que a tela edita; o item traz `productGroupId` para isso.
- Busca, teto de saldo, mínimo de vendas e ordenação voltam para a página 1 nos
  próprios setters, não em efeito.
