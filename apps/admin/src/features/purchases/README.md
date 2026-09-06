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
- **O custo unitário da entrada é o total FINAL ÷ quantidade**, arredondado ao
  centavo. R$ 100 em 3 unidades vira lote a R$ 33,33; a compra continua
  guardando os R$ 100 exatos.
- **Fotos são enviadas na hora** para o catálogo de imagens (o mesmo do
  produto); a compra guarda só os ids. No recebimento de produto novo, as
  mesmas imagens viram a galeria do cadastro sem novo upload. A busca na web
  reaproveita `ProductImageSearchModal`, o proxy e a otimização do cadastro.

## Os dois caminhos do "Lançar recebimento"

1. **Produto já cadastrado (reposição).** `PurchaseReceiveDialog` pede só o
   que a compra não sabe — data da entrada, número da nota e preço de venda
   (zero mantém o atual) — e chama `POST /Purchases/{id}/receive`. O backend
   grava a entrada com a quantidade e o custo da compra e marca como lançada,
   **numa transação**, usando `compra-<id>` como chave de idempotência: um
   segundo clique devolve a mesma entrada em vez de lançar o estoque duas
   vezes. Depois a tela navega para o detalhe do produto, onde a entrada já
   aparece na aba Estoque.
2. **Produto novo.** Navega para `/produtos?compra=<id>`
   (`productFromPurchasePath`). `useProductDetailFromUrl` lê o parâmetro,
   busca a compra e abre o cadastro **preenchido** (nome, descrição, fotos e
   preço sugerido a 40% sobre o custo unitário). O operador completa código
   de barras, departamento, categoria e variações, e salva. A aba Estoque
   então abre com a entrada da compra já pronta (fornecedor, quantidade,
   custo); ao gravar a entrada, `mark-received` fecha a compra vinculando
   produto e entrada. Ver `features/products/README.md`, seção "Cadastro a
   partir de uma compra".

## Decisões de implementação

- `usePurchases` (listagem, situação, exclusão, recebimento) e
  `usePurchaseForm` (formulário e fotos) são dois hooks para nenhum arquivo
  passar de 300 linhas; a página só compõe.
- Busca e filtro voltam para a página 1 nos próprios setters, não em efeito.
- Invalidar o prefixo `["purchases"]` alcança lista e itens; o recebimento
  invalida também `products`, porque mexe em estoque e custo do produto.
