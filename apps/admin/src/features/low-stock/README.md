# Estoque baixo (`features/low-stock`)

Relatório dos produtos que precisam de reposição e o alerta vermelho que
aparece no painel e no topo da listagem de produtos.

É uma tela **sem estado próprio**: ela responde "o que comprar hoje?" a cada
consulta e não guarda nada sobre o que já foi tratado — isso vive nas compras e
nas entradas de estoque.

## Regras de negócio

- **Quem entra (12/09/2026).** Produto vivo (não excluído, não inativo, não
  rascunho) que passe por **uma** destas três portas — a regra mora no backend,
  em `LowStockService.NeedsRestock`, não aqui:
  1. **Esgotado que vende**: saldo zerado e com saída nos últimos 30 dias. É
     venda que a loja já perdeu.
  2. **Mínimo atingido**: `minStock > 0` (aba Opcionais do produto, decisão de
     quem cadastrou) e saldo **igual ou abaixo** dele. O "igual conta" é o mesmo
     critério do relatório de inventário (`Stock <= MinStock`), para os dois
     números da tela não divergirem.
  3. **Dura menos de 30 dias** no ritmo dos últimos noventa. É esta porta que
     alcança o produto **sem mínimo configurado** — quase todo o catálogo, já
     que o campo raramente é preenchido. Na loja, medido em 12/09/2026: 130
     produtos de 1.042 entram no relatório, e 129 deles por esta porta.
  - A terceira porta **contém** a primeira hoje, porque saldo zero dura zero. As
    duas continuam escritas porque são regras diferentes do dono: mexer numa das
    janelas separa uma da outra.
  - A duração é comparada por multiplicação, e não dividindo saldo por média:
    `saldo * 90 < 30 * vendas`. Divisão em consulta já derrubou o
    `GET /Purchases` de produção; o motivo está em
    `Uaus.Backend.Api/docs/projecoes-ef-e-avaliacao-no-cliente.md`.
- **Ordem: esgotados primeiro, depois o que acaba antes (12/09/2026).** Era "do
  menor saldo para o maior", e saldo solto não compara — três unidades de um
  produto que vende dez por dia são mais urgentes que uma unidade de um produto
  que vende uma por mês. Quem não tem previsão (não vendeu nos 90 dias) vai para
  o fim: duração nula não é "dura pouco", é "não dá para saber".
- **Os dois filtros só ESTREITAM (12/09/2026).** "Estoque menor que" e "vendeu ao
  menos N em 30d" recortam o relatório; nenhum deles traz de volta produto que
  não precisa de reposição. Antes o teto trocava o critério da tela por "quem tem
  menos de N unidades", e com isso ela deixava de responder à própria pergunta.
  Vazio, zero e lixo digitado voltam ao relatório inteiro.
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
- **O que tira um produto do relatório.** Uma **entrada de estoque** que faça o
  saldo durar mais de trinta dias tira sozinha — o critério é avaliado a cada
  consulta, e nada precisa ser "baixado" na lista. O menu da linha tem as outras
  duas portas, e as duas pedem confirmação porque alteram cadastro sem desfazer
  à vista:
  - **Remover o controle de estoque** zera o mínimo. Desde 12/09/2026 isso já
    **não é saída universal**: tira quem estava aqui só por causa do mínimo, e
    quem continua acabando pelo ritmo de venda permanece na lista (a porta 3 não
    olha o mínimo). O diálogo diz isso.
  - **Inativar produto** (12/09/2026) é a saída do que esgotou e não se quer
    repor. O produto sai do relatório, do alerta e da venda — PDV e loja deixam
    de oferecê-lo — sem sair do catálogo: saldo, histórico e vendas passadas
    ficam onde estão, e reativar é um clique na tela do produto. Não é exclusão,
    e nem poderia ser: produto com venda registrada não pode ser excluído.
  - As duas ficam no **histórico do produto**, como qualquer edição de cadastro.
- **O alerta conta quem VENDEU no mês e está acabando (12/09/2026).**
  `LowStockAlert` usa `summary.restock`: produto com saída nos últimos 30 dias
  que esteja **esgotado ou com menos de 30 dias de estoque**. A contagem antiga
  — todo mundo abaixo do mínimo — acendia o vermelho também para item parado há
  um ano, e alerta que aponta para o que não precisa de ação ensina a ser
  ignorado.
  - O critério é do backend (`LowStockService.SellsAndIsRunningOut`); a tela não
    repete regra nem número. Os antigos `restockMinSales` e `restockMaxStock`
    saíram da resposta junto com o mínimo de 3 unidades e o teto de 5.
  - **É um subconjunto do relatório**, e por isso o link abre a lista **sem
    filtro**. Filtrar para o número "bater" esconderia o resto do que precisa de
    compra; e o que o alerta conta aparece no topo de qualquer forma, porque a
    lista ordena pelo que acaba antes. Na loja, em 12/09/2026: 33 no alerta, 130
    no relatório.
  - Com zero, o alerta some.
- **A tela abre no critério do relatório, sem filtro semeado (12/09/2026).** Os
  dois campos chegaram preenchidos com os números do alerta por uma semana,
  porque sem filtro a tela caía no relatório clássico — **3 produtos de 1.042**.
  Agora o critério do backend responde à pergunta sozinho, e semear filtro
  esconderia justamente o que ele passou a alcançar: o produto sem mínimo que
  acaba em duas semanas. Com isso saíram também a espera pela contagem
  (`enabled`) e o `?vendas=` da URL.

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
  até uma semana e âmbar até três. **É a coluna da ordem padrão** e a terceira
  porta de entrada do relatório.
  - O número que ordena e o que a tela mostra saem do MESMO `coverWindowSales`
    que a projeção trouxe. Somar a janela duas vezes — uma para ordenar, outra
    para exibir — deixaria a primeira linha aparecer durando mais que a segunda.
  - O `title` mostra a conta inteira ("150 un. vendidas em 90 dias — média de
    1,67 un./dia"): a média arredondada sozinha não explica de onde saiu a
    previsão.
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
