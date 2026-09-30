# Estoque baixo (`features/low-stock`)

Relatório dos produtos que precisam de reposição e o alerta vermelho que
aparece no painel e no topo da listagem de produtos.

É uma tela **sem estado próprio**: ela responde "o que comprar hoje?" a cada
consulta e não guarda nada sobre o que já foi tratado — isso vive nas compras e
nas entradas de estoque.

## Regras de negócio

- **Todo produto é controlado por padrão (29/09/2026).** A regra mora no
  backend (`StockControlRules`), não aqui. Até essa data o "controle" era o
  estoque mínimo maior que zero, que quase ninguém preenchia. Agora:
  - a chave `stockControlEnabled` do produto vem ligada, e se desliga aqui (menu
    da linha, com motivo opcional) ou na aba Opcionais do produto;
  - a rotina diária do backend tira sozinho quem vende **menos de 1 por mês**
    (mediana dos meses observados) — o **giro baixo**;
  - quem tem mínimo PRÓPRIO continua controlado mesmo com giro baixo.
- **Quem entra.** Produto vivo, vendável e controlado que passe por **um**
  destes gatilhos:
  1. **Mínimo próprio atingido** (`minStock > 0` e saldo igual ou abaixo);
  2. **Dura menos de 30 dias** na demanda prevista (inclui o esgotado que vende);
  3. **Mínimo padrão atingido**: sem mínimo próprio, saldo igual ou abaixo do
     padrão da loja (Configurações › Estoque, 2 de fábrica). A coluna
     "Estoque / mín." mostra o mínimo que VALE (`effectiveMinStock`).
  - A demanda é a média ponderada 3/2/1 dos três últimos meses (`dailyDemand`),
    gravada pela rotina diária; a duração sai do saldo ATUAL, então uma entrada
    tira o produto daqui na hora.
- **Duas abas (29/09/2026).** "Para repor" é o relatório; "Fora do controle"
  lista o desligado à mão e o de giro baixo, com o porquê na linha. Existe para
  o que sai da lista não sumir sem ninguém ver. O botão da linha lá é
  **Religar**, só para quem foi desligado — o de giro baixo já está com a chave
  ligada e volta sozinho quando voltar a vender. Trocar de aba volta à página 1;
  a exportação baixa a aba aberta.
- **Ordem: esgotados primeiro, depois o que acaba antes (12/09/2026).** Sem
  demanda vai para o fim: duração nula não é "dura pouco", é "não dá para saber".
- **Os dois filtros só ESTREITAM (12/09/2026).** "Estoque menor que" e "vendeu ao
  menos N em 30d" recortam a lista; vazio, zero e lixo digitado voltam à lista
  inteira.
- **O relatório não guarda estado por item (06/09/2026).** Quem registra que a
  reposição foi **encaminhada** é a compra; quem registra que ela **chegou** é a
  entrada de estoque.
- **A ação da linha é "Comprar".** Leva a
  `/estoque/compras?produto=&fornecedor=` com o formulário preenchido: produto,
  último fornecedor, situação Pendente e a quantidade que cobre **60 dias da
  demanda** ou recompõe o mínimo próprio, o que for maior
  (`suggestedRestockQuantity`, em `src/lib/stock-control.ts`).
  - **Ele some quando já existe compra em aberto** (`hasOpenPurchase`). Compra
    **lançada** não conta: ela já virou entrada.
- **O menu da linha.**
  - **Desligar controle de estoque** (com confirmação e motivo opcional: Fim de
    linha, Brinde ou uso interno, Sazonal, Outro). Não mexe no mínimo. Fim de
    linha **religa sozinho** quando entra compra do produto. Até 29/09/2026 a
    ação só zerava o mínimo, e o produto que acabava pelo ritmo de venda
    continuava na lista — o botão não fazia o que dizia.
  - **Religar controle de estoque**, sem confirmação: o mesmo menu desfaz.
  - **Inativar produto** (12/09/2026): a saída do que não se vende mais. Sai
    também do PDV e da loja; volta a Ativo quando entra mercadoria.
  - Todas ficam no **histórico do produto**.
- **O alerta conta o mesmo que o relatório (29/09/2026).** `LowStockAlert` mostra
  `summary.restock`, o tamanho da aba "Para repor" sem filtro. Entre 12/09 e
  29/09/2026 era um subconjunto (só quem vendeu no mês), porque a lista trazia o
  parado que estava acabando; com o giro baixo saindo sozinho, dois números para
  a mesma pergunta só confundiam. Com zero, o alerta some.
- **A tela abre no critério do relatório, sem filtro semeado (12/09/2026).**

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
- **Dura**: previsão de duração do saldo na **demanda prevista** pela rotina
  diária (`dailyDemand`, 29/09/2026; antes, a média simples de 90 dias). Sem
  demanda a coluna fica vazia: zero diria "acaba hoje" para um produto que não
  sai. A cor é vermelha até uma semana e âmbar até três. **É a coluna da ordem
  padrão.**
  - O número que ordena e o que a tela mostra saem da MESMA demanda cheia que a
    projeção trouxe; a exibida (`averageDailySales`) é só arredondada.
  - O `title` mostra a conta ("Demanda prevista de 4,0 un./mês (0,13 por dia) —
    mediana de 4/mês").
- **Saldo zero diz "esgotado", não "acaba hoje"** (06/09/2026). Com saldo zero
  não há previsão a fazer — o produto já acabou, e mandar conferir uma data que
  passou confunde quem está decidindo o que comprar hoje.

## Exportação XLSX

O botão "Exportar XLSX" gera um arquivo de verdade (ExcelJS), com cabeçalho em
negrito sobre fundo escuro, painel congelado, autofiltro, largura por coluna e
o saldo em vermelho nas linhas no mínimo que vale para o produto. Não é CSV renomeado como o do
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
  caminho: rota, alerta do painel e alerta da listagem apontam para ela. O
  `?vendas=` que o alerta mandava saiu em 12/09/2026, junto com os filtros
  semeados.
- **A tela não repete a contagem em cards** (06/09/2026). Os dois cards
  (pendentes e resolvidos) diziam, em números grandes, o que a lista logo
  abaixo já mostra — e quem chega pelo alerta já leu o número lá.
- **A tabela tem largura mínima e rola na horizontal.** Sem isso o navegador
  espreme as colunas para caber e a última — a das ações — perde espaço, com o
  botão cortado. Pelo mesmo motivo saíram da tela a **categoria** e a
  **situação**: a primeira não decide reposição e a segunda virou redundante
  quando o "resolvido" acabou. A categoria continua no XLSX, que não disputa
  largura com botão.
- **A listagem encolhe por prioridade, não por sorte (12/09/2026).** Abaixo de
  `2xl` saem **Fornecedor**, **Estoque / mín.** e **Última venda**, e ficam
  produto, vendas 30d, duração e ações — mesmo tratamento da tela de Compras. Com
  as sete colunas a tabela pede mais de 1.200px, e a área útil de um notebook
  Full HD a 125% de zoom (ou do monitor auxiliar da loja) é de ~1.140px: o que
  caía fora da tela era a ponta direita, ou seja, o botão "Comprar" e o menu — as
  duas coisas que se veio fazer aqui. A largura mínima cai junto
  (`min-w-[44rem] 2xl:min-w-[64rem]`): exigir 64rem de quatro colunas devolveria
  a barra de rolagem que esconder as colunas veio tirar.
- **O nome do produto tem teto de ~40 caracteres e quebra linha** (`max-w-[40ch]`
  - `break-words`), em vez de truncar. Nome com variação passa de sessenta
    caracteres com facilidade, e uma coluna que cresce sem limite empurra as
    demais para fora da tela; cortar com reticências esconderia o fim do nome, que
    é onde mora a variação que distingue duas linhas iguais.
- **O link do produto abre pelo id do GRUPO** (`/produtos/<grupo>/detalhes`),
  que é o que a tela edita; o item traz `productGroupId` para isso.
- Busca, teto de saldo, mínimo de vendas e ordenação voltam para a página 1 nos
  próprios setters, não em efeito.
