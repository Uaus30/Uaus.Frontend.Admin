# Compras (`features/purchases`)

Compras a fornecedor — o **pedido**, não a nota. Registra o que foi (ou vai
ser) comprado enquanto a mercadoria não chegou, e transforma o recebimento numa
entrada de estoque. Tela `/estoque/compras`, no grupo Estoque.

Não confundir com `features/stock-entries` (`/PurchaseEntries`), que é a
ENTRADA: a nota que já chegou e mexe no estoque. A compra vem antes; o
recebimento dela é o que gera a entrada.

## Regras de negócio

- **Um produto por compra.** O recebimento vira UMA entrada de estoque de um
  produto só, que é como a entrada funciona desde 31/08/2026. Pedido com vários
  itens são várias compras.
- **A data da compra é do OPERADOR, não do sistema.** Nasce hoje e pode ser
  retroagida (nunca adiantada): o pedido costuma ser digitado depois de fechado,
  e é essa data que a listagem exibe e por onde ela ORDENA — `created_at`
  responde só "quando isto foi digitado". A data da ENTRADA é outra, perguntada
  no recebimento: comprar e receber são dias diferentes.
- **Situação: Pendente (vermelho) → A caminho (azul) → Lançado (verde).** Só
  as duas primeiras são escolhidas à mão. **Lançado nasce do recebimento** e
  torna a compra imutável — não se edita nem se exclui uma compra cuja entrada
  já existe. A cor mora em `PurchaseStatusBadge`, e em nenhum outro lugar.
- **O produto é opcional.** A compra costuma ser de algo que ainda não está no
  cadastro: sem produto vinculado, ela guarda nome, detalhes, link e fotos —
  o pré-cadastro que o recebimento abre preenchido. Com produto vinculado, o
  nome é o do cadastro (composto, com grades) e fica travado no formulário.
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
- **O preço sugerido de venda é decidido AQUI**, olhando para o custo, com a
  margem prevista ao lado (`PricingPreview`, o mesmo bloco da entrada de
  estoque). No recebimento ele já vem preenchido e passa a valer no cadastro do
  produto; em branco (zero) o produto fica com o preço que já tem. Perguntar de
  novo no recebimento seria pedir a mesma decisão duas vezes.
- **Fotos são enviadas na hora** para o catálogo de imagens (o mesmo do
  produto); a compra guarda só os ids. São quatro entradas — arquivo, colagem
  (Ctrl+V, no diálogo inteiro), URL e busca na web — e **todas passam pelo mesmo
  funil**: `optimizeImage` antes do upload. Não é economia de disco: a foto do
  site do fornecedor é PNG de vários MB, e um punhado delas estourava o que a
  hospedagem aceita. URL e busca na web passam antes pelo proxy do backend
  (CORS). No recebimento de produto novo, as mesmas imagens viram a galeria do
  cadastro sem novo upload.
- **A primeira foto da compra vira a imagem PRINCIPAL do produto no
  recebimento** — e as que o produto já tinha descem de posição, sem serem
  apagadas. Quem fotografa na hora de comprar está registrando o que acabou de
  chegar, e é essa foto que deve aparecer na vitrine, no PDV e na etiqueta. Foto
  antiga é trabalho manual acumulado; faxina se faz pela galeria do produto, não
  por um efeito colateral do recebimento. Quem faz é
  `PurchaseService.PromotePurchaseImagesAsync`, dentro da transação.

## Os dois caminhos do "Lançar recebimento"

1. **Produto já cadastrado (reposição).** `PurchaseReceiveDialog` pede só o
   que a compra não sabe — data da entrada e número da nota. O preço de venda
   já vem do preço sugerido da compra (zero mantém o atual) e continua
   editável. Chama `POST /Purchases/{id}/receive`; o backend grava a entrada com
   a quantidade e o custo da compra, **promove as fotos da compra a principais
   do produto** e marca como lançada, **numa transação**, usando `compra-<id>`
   como chave de idempotência: um segundo clique devolve a mesma entrada em vez
   de lançar o estoque duas vezes. Depois a tela navega para o detalhe do
   produto **já na aba Estoque**
   (`productStockTabPathname`, que escreve `?aba=estoque`), onde a entrada
   recém-gravada aparece: cair em Dados obrigaria a clicar numa aba para ver o
   efeito da ação que a pessoa acabou de confirmar.
2. **Produto novo.** Navega para `/produtos?compra=<id>`
   (`productFromPurchasePath`). `useProductDetailFromUrl` lê o parâmetro,
   busca a compra e abre o cadastro **preenchido** (nome, descrição, fotos e o
   preço sugerido da compra — sem ele, 40% sobre o custo unitário). O operador completa código
   de barras, departamento, categoria e variações, e salva. A aba Estoque
   então abre com a entrada da compra já pronta (fornecedor, quantidade,
   custo); ao gravar a entrada, `mark-received` fecha a compra vinculando
   produto e entrada. Ver `features/products/README.md`, seção "Cadastro a
   partir de uma compra".

## Decisões de implementação

- `usePurchases` (listagem, situação, exclusão, recebimento), `usePurchaseForm`
  (formulário e gravação) e `usePurchaseImages` (as quatro entradas de foto,
  proxy, compressão e upload) são três hooks para nenhum arquivo passar de 300
  linhas; a página só compõe. O `usePurchaseForm` reexporta o de imagens
  inteiro, então a tela continua vendo um objeto só.
- Busca e filtro voltam para a página 1 nos próprios setters, não em efeito.
- Invalidar o prefixo `["purchases"]` alcança lista e itens; o recebimento
  invalida também `products`, porque mexe em estoque e custo do produto.
