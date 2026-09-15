# Compras (`features/purchases`)

Compras a fornecedor — o **pedido**, não a nota. Registra o que foi (ou vai
ser) comprado enquanto a mercadoria não chegou, e transforma o recebimento numa
entrada de estoque. Tela `/estoque/compras`, no grupo Estoque.

Não confundir com `features/stock-entries` (`/PurchaseEntries`), que é a
ENTRADA: a nota que já chegou e mexe no estoque. A compra vem antes; o
recebimento dela é o que gera a entrada.

## Regras de negócio

- **Um produto por compra — com as VARIAÇÕES dele** (12/09/2026). Variação é
  produto (uma linha em `products` dentro do mesmo grupo), e a compra era 1:1 com
  um SKU: uma camiseta em três cores eram três compras, com fornecedor, data,
  link e fotos digitados três vezes e o total rateado de cabeça. Agora a compra
  tem uma **grade** (`purchase_items`) e o recebimento vira UMA entrada com um
  lote por variação. Produtos diferentes continuam sendo compras diferentes:
  fotos, preço sugerido e a grade são todos do grupo, e misturar dois produtos
  esvaziaria os três.
- **Comprar com variação exige o produto já cadastrado**, com as variações
  definidas. O caminho de produto novo continua existindo e continua sendo de um
  item só — quem precisa de variação cadastra o produto primeiro.
- **A grade mostra TODAS as variações do grupo**, não só as compradas: é ela que
  responde "o que existe para eu escolher". Quantidade zero é "não comprei esta"
  e a linha nem vira item ao gravar, então a grade da tela e os itens gravados
  não têm o mesmo tamanho. Produto simples não tem grade — a quantidade continua
  num campo só, que é o caso da esmagadora maioria e não podia ficar mais
  trabalhoso para atender ao caso raro.
- **A data da compra é do OPERADOR, não do sistema.** Nasce hoje e pode ser
  retroagida (nunca adiantada): o pedido costuma ser digitado depois de fechado,
  e é essa data que a listagem exibe e por onde ela ORDENA — `created_at`
  responde só "quando isto foi digitado". A data da ENTRADA é outra, perguntada
  no recebimento: comprar e receber são dias diferentes.
- **Situação: Pendente (vermelho) → A caminho (azul) → Lançado (verde).** Só
  as duas primeiras são escolhidas à mão. **Lançado nasce do recebimento** e
  torna a compra imutável — não se edita nem se exclui uma compra cuja entrada
  já existe. A cor mora em `PurchaseStatusBadge`, e em nenhum outro lugar.
- **Pendente aceita só o essencial: fornecedor, produto (ou nome), quantidade e
  data.** É a anotação de "preciso comprar isto" — do relatório de estoque baixo
  ou de uma ideia no balcão —, antes de escolher o anúncio, negociar o preço ou
  saber o frete. Custo, link, preço sugerido e fotos entram quando existirem.
  Uma compra sem custo aparece na listagem com **traço** no total e no unitário,
  não com R$ 0,00 — zero leria como "de graça".
- **O total final (o custo) é exigido ao sair de Pendente.** "A caminho" já é
  compra feita, e é do total final que sai o custo unitário da entrada; exigir
  o custo em Pendente obrigaria a inventar um número, e número inventado vira
  custo de lote. A regra vale no formulário (`purchaseCostIsRequired`, com o
  asterisco acompanhando a situação), no menu "Marcar como a caminho" e no
  recebimento — o backend é a fonte de verdade (`PurchaseRules`). O **bruto
  continua opcional** em qualquer situação: zero é "não houve desconto a
  registrar", e o recebimento grava o bruto igual ao custo.
- **Recebimento de compra sem custo não acontece.** O diálogo de recebimento
  diz que a compra está sem custo e troca "Confirmar recebimento" por "Editar
  compra", que abre o formulário da mesma compra. No caminho de produto novo o
  custo é digitado na entrada, e o `mark-received` copia o total da entrada
  para a compra, que fecha com o valor real em vez de "Lançada, R$ 0".
- **Nome de produto é sempre em caixa alta** (09/09/2026), inclusive o nome
  livre da compra de produto novo: o campo converte ao digitar, como o editor
  de produto, e o backend grava em maiúsculas de qualquer jeito
  (`ProductDisplayName.Normalize`) — é o que a listagem mostra e o que vira o
  nome do cadastro no recebimento.
- **O produto é opcional.** A compra costuma ser de algo que ainda não está no
  cadastro: sem produto vinculado, ela guarda nome, detalhes, link e fotos —
  o pré-cadastro que o recebimento abre preenchido. Com produto vinculado, o
  nome é o do cadastro (composto, com grades) e fica travado no formulário.
- **O custo tem UM dono por compra, e ele é gravado** (`costSplitManual`). Em
  **rateio** (o padrão) o operador digita os totais do PEDIDO e a fatia de cada
  variação é derivada, proporcional à quantidade, com a **sobra do arredondamento
  no último item** — sem ela, R$ 100 em três variações viraria 33,33 × 3 = 99,99 e
  a soma da grade contradiria o total que a mesma tela mostra. Em **manual** é o
  inverso: a fatia vira campo e o total do pedido passa a ser a soma. Existe para
  a variação mais cara (o GG custa mais que o P). Nunca os dois digitados. O flag
  é gravado porque, sem ele, reabrir a compra e mexer numa quantidade
  redistribuiria em silêncio o que foi digitado à mão. A prévia é
  `lib/purchase-items.ts`; quem vale é o `PurchaseCostSplit` do backend.
- **Só os TOTAIS são digitados** (bruto e final, com desconto/acréscimo).
  Unitários e percentual são derivados — na tela por `derivePurchaseTotals`
  (prévia) e no backend pela mesma fórmula (o que vale). Nunca divergem do
  total porque nunca são gravados.
- **Os dois totais aceitam CONTA:** "=17,99*2" vira R$ 35,98 ao sair do campo.
  A nota do fornecedor vem em "12 unidades a 17,99", e a conta digitada no
  próprio campo tira a calculadora do caminho e — o que importa mais — deixa o
  número conferível. Vírgula e ponto valem os dois como separador decimal. Quem
  avalia é `evaluateAmountFormula` do `@workspace/core`, escrito à mão: o texto
  vem de um formulário, e `eval` num campo de tela é injeção. Conta que não
  fecha devolve o valor anterior; não zera o campo.
- **O custo unitário da entrada é o total FINAL ÷ quantidade**, arredondado ao
  centavo. R$ 100 em 3 unidades vira lote a R$ 33,33; a compra continua
  guardando os R$ 100 exatos.
- **Departamento e categoria são obrigatórios** (13/09/2026). Com produto
  vinculado eles vêm do cadastro e ficam **travados** — quem edita a categoria de
  um produto é a tela de Produtos, e mudá-la por efeito colateral de salvar uma
  compra é o tipo de coisa que só aparece quando o item some do filtro da
  vitrine. Sem cadastro, são escolhidos aqui: é com eles que o recebimento gera o
  produto **pronto**, em vez de abrir o cadastro com dois selects em branco para
  quem está com a caixa aberta na mão. Só a categoria é gravada
  (`purchases.category_id`); o departamento sai dela, como no cadastro de
  produto, e serve para filtrar a lista de categorias.
- **O preço sugerido de venda é decidido AQUI**, olhando para o custo, com a
  margem prevista ao lado (`PricingPreview`, o mesmo bloco da entrada de
  estoque). No recebimento ele já vem preenchido e passa a valer no cadastro do
  produto; em branco (zero) o produto fica com o preço que já tem. Perguntar de
  novo no recebimento seria pedir a mesma decisão duas vezes.
- **O campo nasce preenchido com o preço do cálculo de margem** (13/09/2026):
  informar o total final preenche o sugerido com 40% de margem sobre o custo
  unitário, arredondado para cima ao múltiplo de dez centavos. Na maioria das
  compras a sugestão é o que se pratica, e digitá-la de novo seria repetir uma
  conta que a tela já fez ao lado. **Mexeu no campo, o número é dele** — mudar o
  custo depois não o substitui, e compra reaberta com preço gravado não
  recalcula: reabrir e ver o número mudar sozinho descartaria a decisão de quem
  comprou. Abaixo do campo, o **preço atual do produto** quando há cadastro; é a
  comparação que decide se a compra muda a etiqueta. Em produto novo não existe
  preço atual, e a linha não aparece.
- **Fotos são enviadas na hora** para o catálogo de imagens (o mesmo do
  produto); a compra guarda só os ids. São quatro entradas — arquivo, colagem
  (Ctrl+V, no diálogo inteiro), URL e busca na web — e **todas passam pelo mesmo
  funil**: `optimizeImage` antes do upload. Não é economia de disco: a foto do
  site do fornecedor é PNG de vários MB, e um punhado delas estourava o que a
  hospedagem aceita. URL e busca na web passam antes pelo proxy do backend
  (CORS). No recebimento de produto novo, as mesmas imagens viram a galeria do
  cadastro sem novo upload.

## A galeria da compra É a galeria do produto (13/09/2026)

Com produto vinculado, **as fotos da modal são as do GRUPO**
(`product_group_images`), e o que é removido ou acrescentado ali é removido ou
acrescentado no produto ao salvar a compra — na mesma transação
(`PurchaseService.ReplicateImagesToGroupAsync`).

Antes eram duas listas que só se encontravam no recebimento, e a pergunta
"substituir ou unificar?" (`purchases.replace_product_images`) existia para
resolver o encontro. Com uma lista só, a pergunta some — a flag saiu do
formulário, do diálogo de recebimento e da API; a coluna fica no banco sem uso,
porque derrubá-la é script destrutivo e não há pressa.

As cinco regras que explicam o desenho:

1. **Escolher um produto carrega a galeria dele.** O que estivesse no formulário
   antes é substituído: a regra da modal é uma só — o que está ali é a galeria do
   grupo escolhido —, e o seletor de produto fica acima do campo de fotos
   justamente porque ele vem primeiro. Desvincular limpa, pelo inverso do mesmo
   motivo: deixar as fotos daria ao cadastro novo as fotos de outro item.
2. **A LEITURA vem do grupo, não de `purchase_images`.** A compra continua
   guardando os ids que ela mandou, mas `PurchaseDto.Images` devolve a galeria do
   grupo — em uma consulta em lote por página. Sem isso, editar a galeria pela
   tela de Produtos deixaria a listagem de Compras e a modal mostrando a versão
   velha, e salvar a compra devolveria essa versão velha ao produto.
3. **Lista vazia esvazia na EDIÇÃO, e não faz nada no CADASTRO.** Remover a foto
   tem que significar alguma coisa; mas compra nasce sem foto o tempo todo — a
   anotação vinda do relatório de estoque baixo é o caso comum —, e apagar a
   galeria do produto por ausência não é decisão de ninguém.
4. **A imagem nunca é apagada.** Sai só a associação: `images` é o catálogo
   compartilhado e a mesma foto pode estar em outro produto.
5. **Produto novo continua guardando só na compra.** As fotos ficam em
   `purchase_images` e viram a galeria do cadastro quando ele nascer, no
   recebimento — como sempre funcionou.

No recebimento, `PromotePurchaseImagesAsync` continua existindo para reconciliar
as compras registradas **antes** desta data, que guardaram galeria própria; com
a replicação no salvar, ele é um no-op no caso normal. Compra sem foto nenhuma
não mexe na galeria, pela mesma razão do item 3.

### O item 1 passou a PERGUNTAR (15/09/2026)

Vincular um produto a uma compra que estava como **produto novo** substitui duas
coisas que podem ter sido preenchidas à mão: o nome e as fotos. Agora, quando há
o que substituir, isso vira uma pergunta — `PurchaseProductLinkDialog`, aberta
pelo `pendingProduct` do `usePurchaseForm`. Antes, quem anotou a compra de um
item novo, subiu as fotos do anúncio do fornecedor e só depois descobriu que o
produto já tinha cadastro via o trabalho sumir sem aviso nenhum.

- **Só quando há o que perder** (`purchaseDataWouldBeReplaced`): foto anexada, ou
  nome digitado diferente do nome do produto escolhido — comparando em caixa
  alta, que é como ele é gravado. Pergunta que aparece à toa é a que ninguém lê.
- **Só no vínculo NOVO.** Trocar um produto já vinculado por outro não pergunta:
  o que está na tela é a galeria do produto ANTERIOR, não trabalho de ninguém.
- **O nome não é escolha, é aviso.** Com produto vinculado ele é sempre o do
  catálogo — o campo nem aparece na modal, e o backend regrava
  `purchases.product_name` a partir do produto em todo salvamento
  (`PurchaseService.ResolveProductAsync`). A modal informa a troca para o
  operador não procurar depois pelo nome que digitou.
- **A foto tem duas respostas legítimas**, e por isso é a única pergunta de
  verdade: "usar as fotos do produto" (o caminho de sempre) ou "manter as desta
  compra", que **substituem** a galeria do produto no salvar — consequência
  direta de a lista ser uma só. Mantendo, a galeria do grupo nem é buscada; a
  categoria continua vindo do cadastro, porque ela nunca foi escolha aqui.
- **"Não vincular"** fecha sem aplicar nada, e é para onde o Esc cai.

## O recebimento é uma CONFERÊNCIA (12/09/2026)

Em compra com variações, a grade aparece **editável** no diálogo de
recebimento: dá para ajustar quantidade, zerar a variação que não veio e
acrescentar a que veio sem estar no pedido. Existe porque caixa sortida se
registra no chute — não dá para saber as cores antes de abrir a embalagem.

A regra que mantém os dois documentos coerentes: **ajusta-se a DISTRIBUIÇÃO, não
o valor pago.** O total da compra é o que saiu do bolso e não muda por efeito
colateral de um ajuste de quantidade; a grade redistribui esse total. Enquanto a
soma não fechar, o aviso aparece e o **confirmar fica desabilitado** — deixar
passar faria a entrada e a compra contarem histórias diferentes sobre o mesmo
dinheiro, e a compra fica imutável logo em seguida. Quando o valor mudou de
verdade (faltou item e o fornecedor abateu), o botão "Usar X como total pago"
confirma o novo total, explicitamente.

Conferida a grade, a compra passa a `costSplitManual`: o operador distribuiu à
mão, e reabrir não pode re-ratear. Compra de um produto só não tem conferência —
o que foi pedido é o que chegou, e a grade seria uma tabela de uma linha para
não decidir nada.

## Os dois caminhos do "Lançar recebimento"

**Compra PENDENTE não se recebe** (13/09/2026): a opção aparece bloqueada no
menu da listagem. Pendente é a anotação de "preciso comprar isto" — o pedido
ainda não foi fechado, e é ali que o custo pode nem existir. O caminho é marcar
como a caminho primeiro, o que já exige o custo de que a entrada precisa.

1. **Produto já cadastrado (reposição).** `PurchaseReceiveDialog` pede só o
   que a compra não sabe — data da entrada e número da nota. O preço de venda
   já vem do preço sugerido da compra (zero mantém o atual) e continua
   editável. Chama `POST /Purchases/{id}/receive`; o backend grava a entrada com
   a quantidade e o custo da compra, reconcilia as fotos da compra com a galeria
   do produto e marca como lançada, **numa transação**, usando `compra-<id>`
   como chave de idempotência: um segundo clique devolve a mesma entrada em vez
   de lançar o estoque duas vezes. Depois a tela navega para o detalhe do
   produto **já na aba Estoque**
   (`productStockTabPathname`, que escreve `?aba=estoque`), onde a entrada
   recém-gravada aparece: cair em Dados obrigaria a clicar numa aba para ver o
   efeito da ação que a pessoa acabou de confirmar.
2. **Produto novo.** Navega para `/produtos?compra=<id>`
   (`productFromPurchasePath`). `useProductDetailFromUrl` lê o parâmetro,
   busca a compra e abre o cadastro **preenchido** — nome, descrição, fotos,
   preço sugerido (sem ele, 40% sobre o custo unitário) e, desde 13/09/2026,
   **departamento e categoria**. Sobra o código de barras e as variações. A aba
   Estoque então abre com a entrada da compra já pronta (fornecedor, quantidade,
   custo); ao gravar a entrada, `mark-received` fecha a compra vinculando
   produto e entrada. Ver `features/products/README.md`, seção "Cadastro a
   partir de uma compra".
   **Se o código bipado ali já for de um produto** (15/09/2026), o cadastro é
   interrompido por uma modal que manda ajustar o vínculo aqui e traz a pessoa de
   volta para `/estoque/compras?compra=<id>` — ver a seção 4.2 daquele README. O
   conserto é nesta tela porque é a COMPRA que está dizendo "produto novo"; e
   ajustada ela, o recebimento passa a ser o caminho 1, que nem abre cadastro.

## Decisões de implementação

- **O painel avisa o que está por chegar** (15/09/2026). `OpenPurchasesAlert` é
  uma faixa âmbar no painel com a contagem das compras **não lançadas**, e o
  clique cai nesta tela — que já abre nessa mesma aba. Os dois números vêm
  separados (`GET /Purchases/summary` → `pending` e `inTransit`) porque pedem
  ações diferentes: a pendente espera alguém COMPRAR, a que está a caminho
  espera a mercadoria CHEGAR; somados, o painel diria quanta coisa está aberta
  sem dizer o que fazer com ela.
  - **Âmbar, não vermelho.** Âmbar é "em andamento" no vocabulário de cores da
    loja; vermelho é "negativo, bloqueado" e já é do alerta de estoque baixo,
    logo acima. Compra em aberto não é problema — é trabalho em curso —, e
    pintá-la de vermelho gastaria a única cor que significa "resolva agora".
  - **Endpoint próprio, e não a listagem.** Contar pela página traria
    fornecedor, itens e galeria de cada compra para a resposta ser dois
    inteiros. O agrupamento acontece no banco.
  - A chave de cache é `["purchases", "summary"]`, sob o mesmo prefixo da
    listagem: qualquer `invalidate()` desta tela já atualiza o painel.
- **Fechar com algo digitado pergunta antes** (15/09/2026). O clique no fundo
  fechava a modal e levava o formulário inteiro junto — fornecedor, quantidade,
  totais, as fotos que acabaram de subir —, sem nada explicando o que
  aconteceu. Agora os quatro caminhos de fechar (fundo, Esc, X e "Cancelar")
  passam por `requestClose`, e com `dirty` a confirmação aparece. É o mesmo
  padrão do cadastro de produto.
  - **Só gesto do operador suja o formulário.** O preenchimento automático usa o
    `setForm` cru: a grade que nasce quando as variações chegam, a categoria e a
    galeria do grupo escolhido, o departamento derivado da categoria e o preço
    pela margem. Sem essa separação, abrir uma compra e fechá-la sem digitar
    nada já perguntaria — e a pergunta que aparece à toa é a que ninguém lê.
  - Mexer na **galeria** conta: a lista da modal é a do grupo, e remover uma
    foto ali remove do produto quando a compra é salva.
  - **Compra lançada fecha direto**: ela abre em leitura e não tem o que perder.
- **A URL diz qual compra está aberta.** Clicar na linha abre a modal e
  escreve `?compra=<id>` na barra de endereços (`/estoque/compras?compra=12`);
  fechar a modal tira o parâmetro. Quem chega por esse link cai na mesma
  modal — a compra é buscada pelo id (`usePurchaseFromUrl`), porque ela pode
  estar em outra página ou fora do filtro padrão. É o que permite copiar o
  link e mandar a compra a alguém. Query string, e não segmento de rota, de
  propósito: a listagem está mesmo aberta com um detalhe pendurado, e fechar
  devolve a lista como estava. Sem entrada no histórico: "voltar" continua
  saindo da tela.
- **A tela abre em "Não lançadas"** (Pendente e A caminho), e o filtro de
  situação tem essa opção além de "Todas as situações" e das três situações.
  A tela responde "o que ainda está por chegar"; a compra lançada já virou
  entrada e vive na aba de estoque do produto, e aqui só empurraria para baixo
  o que ainda precisa de ação. A API recebe `onlyOpen=true`
  (`purchasesStatusParams` traduz o valor do select); o filtro se soma ao de
  situação em vez de substituí-lo.
- **Cem linhas por página** (13/09/2026). A tela abre no que está por chegar —
  dezenas de linhas, não milhares —, e paginar isso esconde parte do que a pessoa
  veio olhar de uma vez. Cem é também o teto que a API aceita
  (`Math.Clamp(size, 1, 100)`), então pedir mais não traria mais; a paginação
  continua na tela para "Todas as situações", que inclui o histórico de lançadas
  e cresce sem parar.
- **As colunas de dinheiro respondem "por quanto entrou e quanto sobra".**
  Ficaram o **unitário final** — o custo que o lote vai gravar, com o desconto
  negociado ao lado — e a **margem prevista**, nas faixas de cor de toda tela que
  mostra margem. O **total final saiu** em 13/09/2026: é a soma de um pedido cujo
  tamanho varia, e R$ 1.500 ao lado de R$ 30 não diz qual compra foi melhor.
  Continua a um clique, na compra. A margem sai de `purchaseMarginPercent`: custo
  unitário contra o preço sugerido da compra e, sem ele, contra o preço que o
  produto já tem — **traço, nunca zero**, quando falta um dos dois, porque zero
  leria como "vende no custo".
- **A listagem encolhe por prioridade, não por sorte.** Abaixo de `2xl` saem
  **Unit. final**, **Margem** e **Data da compra**, e ficam produto, fornecedor,
  quantidade, situação e ações. Com as oito colunas a tabela pede mais de
  1.200px, e a área útil de um notebook Full HD a 125% de zoom — ou do monitor
  auxiliar da loja — é de ~1.140px: aparecia uma barra de rolagem horizontal e o
  que caía fora da tela era a ponta direita, ou seja, a situação e o menu de
  opções. Os três valores continuam a um clique, porque a linha abre a compra; a
  barra de rolagem não tinha atalho.
- **O nome do produto NÃO é link para o cadastro** (13/09/2026): clicar nele abre
  a compra, como o resto da linha. Era link, e o gesto mais natural de uma lista
  de compras fazia a única coisa que não era "ver esta compra". O cadastro do
  produto virou uma opção do menu, **no lugar de "Abrir link da compra"** — e ela
  fica desabilitada quando o produto ainda não existe, em vez de sumir, para a
  linha ter sempre o mesmo menu.
- **O nome do produto tem teto de largura (`max-w-[20rem]`).** Sem ele o
  `truncate` não vale nada: em tabela de layout automático a largura mínima da
  coluna é a do conteúdo, e texto `nowrap` mede o nome inteiro. Um nome de 63
  caracteres pedia sozinho ~600px e estourava a tabela mesmo com colunas
  escondidas. O nome completo fica no `title` e na compra.

- `usePurchases` (listagem, situação, exclusão, recebimento), `usePurchaseForm`
  (formulário e gravação), `usePurchaseImages` (as quatro entradas de foto,
  proxy, compressão e upload) e `usePurchaseVariations` (a grade) são quatro
  hooks para nenhum arquivo passar de 300 linhas; a página só compõe.
- **Três ajustes acontecem durante o RENDER, não num efeito.** A montagem da
  grade, a resolução do departamento a partir da categoria e o preenchimento do
  preço sugerido. Em todos, a condição se desfaz sozinha depois do ajuste; num
  efeito seria preciso guardar "já fiz este" para não refazer a cada render — e
  refazer apagaria o que o operador acabou de digitar.
- **A galeria e a categoria do grupo são buscadas na hora de ESCOLHER o
  produto**, com `await` direto no serviço em vez de `useQuery`: acontece uma vez,
  no gesto, e o que interessa é o estado do servidor naquele instante — cache aqui
  só serviria para devolver uma galeria que a tela de Produtos já mudou. Enquanto
  a busca corre, o salvar fica travado (`loadingGroup`): gravar antes gravaria a
  compra sem fotos e, numa edição, esvaziaria a galeria do próprio produto.
- **A listagem mostra "N variações" no lugar do código de barras** quando a
  compra tem mais de um item: o código é de UMA delas e não representa o pedido. O `usePurchaseForm` reexporta o de imagens
  inteiro, então a tela continua vendo um objeto só.
- Busca e filtro voltam para a página 1 nos próprios setters, não em efeito.
- Invalidar o prefixo `["purchases"]` alcança lista e itens; o recebimento
  invalida também `products`, porque mexe em estoque e custo do produto.
