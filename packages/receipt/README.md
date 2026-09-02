# @workspace/receipt

Montagem e impressão dos documentos de bobina de 80mm: o **comprovante da
venda** e o **relatório de vendas** — o do turno de caixa e o do dia da loja.

## Por que este pacote existe

O comprovante é a única coisa que sai do sistema e fica na mão do cliente. Ele
não tem "atualizar a página": o que foi impresso está impresso, e a segunda via
tem que sair igual à primeira mesmo que o cadastro tenha mudado no meio do
caminho.

Por isso a montagem vive fora dos apps. Ela é chamada de três lugares — a venda
recém-fechada no PDV, a reimpressão no histórico do PDV e a reimpressão na tela
de vendas do admin —, e ter três montagens é ter três comprovantes diferentes
para a mesma venda.

## O que entra

| Arquivo           | Responsabilidade                                                                |
| ----------------- | ------------------------------------------------------------------------------- |
| `types.ts`        | `ReceiptData`, `ReceiptItem`, `ReceiptPayment`, `ReceiptCoupon`, `ReceiptStore` |
| `document.ts`     | Folha de estilo da bobina, `row`, `divider`, formatação de dinheiro/data        |
| `render.ts`       | `buildReceiptHtml` — o layout do comprovante                                    |
| `from-sale.ts`    | `buildReceiptFromSale` — venda da API → `ReceiptData` (reimpressão)             |
| `sales-report.ts` | Relatório de vendas: fechamento do caixa, ou do dia quando não há turno         |
| `store-info.ts`   | Identidade da loja, com padrão embutido para cadastro pela metade               |
| `print.ts`        | Impressão via iframe isolado                                                    |

## O que NÃO entra

- Chamada de API — quem busca a venda é a feature; aqui chega o dado pronto
- Cálculo de dinheiro — é `computeSaleTotals`/`round2` do `@workspace/core`
- Componente de tela — é `@workspace/ui`

O pacote depende **só** do `@workspace/core`, e isso é deliberado: ele também é
montado offline, a partir do snapshot local do PDV, onde não existe DTO nem
cliente HTTP por perto.

## Regras de negócio

### 1. O `discount` do comprovante é o desconto do OPERADOR, sem o cupom

Esta é a regra que mais custa caro errar, porque não quebra compilação nem
teste de outra camada.

Na API, `sales.discount` é o desconto **total** e a parcela do cupom
(`sales.couponDiscount`) **já está dentro dele** — é parcela, nunca adição.
No papel, porém, são duas linhas. Repassar o número da API cru para
`ReceiptData.discount` junto com o bloco `coupon` imprimiria o mesmo abatimento
duas vezes:

```
Subtotal                            R$ 123,40
Desconto                          - R$ 12,34     ← o cupom, de novo
DESCONTO CUPOM 10OFFSET26 (10%)   - R$ 12,34
TOTAL                               R$ 111,06     ← não fecha
```

`123,40 − 12,34 − 12,34 = 98,72`, e o papel diz 111,06. É a única conta que o
cliente confere de fato, e ele confere no balcão.

Quem monta do **carrinho** (PDV) passa o `globalDiscount` de
`computeSaleTotals`, que já sai discriminado do cupom. Quem monta da **API**
(`buildReceiptFromSale`) faz a subtração, com piso em zero para que snapshot
inconsistente não vire desconto negativo — que o cliente leria como acréscimo.

### 2. A linha do cupom sai entre o desconto e o TOTAL

```
DESCONTO CUPOM 10OFFSET26 (10%)     - R$ 12,34
DESCONTO CUPOM BEMVINDO (R$ 20,00)  - R$ 20,00
```

É a ordem em que a conta acontece (item → global → cupom) e a ordem em que se lê
de cima para baixo. A descrição do cupom, quando existe, sai numa linha menor
logo abaixo.

### 3. O texto do parâmetro chega **pronto**, não como tipo e valor

`ReceiptCoupon.label` é `"10%"` ou `"R$ 20,00"` — string montada por quem chama.

O tipo do desconto é um enum do backend (`CouponDiscountType`, que a API
serializa ora pelo nome, ora pelo número) e mora em `@workspace/api-client`,
pacote do qual este aqui **não depende**. Recebendo texto pronto, o layout nunca
precisa saber quantos tipos de desconto existem: um terceiro tipo amanhã muda
quem chama, e não a impressão.

A exceção é `from-sale.ts`, que lê o snapshot da venda e por isso conhece os dois
códigos do enum. É a fronteira certa para esse conhecimento — o adaptador da
API —, e não o layout.

Rótulo vazio é aceito: sai o código sem os parênteses. É o que sobra de uma
venda antiga cujo snapshot não guardou tipo e valor, e imprimir `(0%)` seria
pior, porque número errado no comprovante o cliente cobra.

### 4. O Subtotal aparece quando há desconto **ou** cupom

O Subtotal existe para que todo abatimento tenha de onde ser subtraído. Uma
venda abatida só pelo cupom tem `discount = 0`, e o portão antigo
(`discount > 0`) deixaria o abatimento pendurado sem o valor cheio acima dele.

### 5. Quem escapa é quem monta o rótulo

`row()` interpola **cru**. Código do cupom, descrição, nome de produto e
observação são campo livre do cadastro, e todos passam por `escapeHtml` do
`@workspace/core` — a implementação única, que escapa também a aspa simples.
(Havia duas no repositório, e a antiga daqui não escapava a aspa: o mesmo nome
de produto saía seguro na etiqueta de gôndola e inseguro no comprovante.)

### 6. As respostas do questionário da campanha **NUNCA são impressas**

O cupom pode estar vinculado a uma campanha com perguntas respondidas no balcão
(sexo, faixa etária, "como conheceu a loja"). Nada disso entra no comprovante —
nem no bloco `ReceiptCoupon`, nem em lugar nenhum do papel.

O comprovante é o documento que o cliente leva no bolso, esquece na sacola e
deixa cair no balcão. Resposta de pesquisa é dado da campanha: vive no relatório
de campanha, atrás de autenticação de Admin. Se algum dia alguém precisar do
dado "no papel", o lugar é um relatório novo, não este.

### 7. Venda zerada imprime igual

O cupom pode zerar a venda (nunca torná-la negativa), e nesse caso o checkout do
PDV pula a etapa de pagamento. O comprovante sai com `TOTAL R$ 0,00`, sem troco
— zero de troco seria lido como "recebi certo", que é outra informação — e a
seção de forma de pagamento cai para "Nenhum pagamento registrado.", para o
título não ficar solto sobre o vazio.

### 8. A segunda via nasce do snapshot, não do cadastro

`SaleLike` lê `couponCode`, `couponDescription`, `couponDiscountType`,
`couponDiscountValue` e `couponDiscount` — todos vindos do **snapshot do
resgate**, gravado no momento da venda. Não é o cadastro de hoje.

Sem isso, editar o cupom faria a segunda via sair diferente da primeira, e uma
segunda via que discorda da primeira é pior do que não reimprimir: o cliente
tem as duas na mão.

Como `SaleDto` já expõe esses campos e o recorte de `SaleLike` é estrutural (só
campos opcionais), as duas telas que reimprimem passaram a reproduzir a linha do
cupom **sem alteração no ponto de chamada**: o PDV
(`use-sale-history-actions.ts`) tipa a venda como `SaleDto`, e o admin
(`useSales.ts`) monta `EnrichedSale` por espalhamento (`{ ...sale }`), então os
campos de cupom sobrevivem.

> **Atenção:** o admin ainda tem um `Sale` local em
> `features/sales/types.ts` que **não declara** os campos de cupom. Hoje isso
> não quebra — o valor chega pelo espalhamento —, mas trocar aquele mapeamento
> por uma cópia campo a campo apagaria a linha do cupom da segunda via **sem
> erro de compilação**. O conserto definitivo é aquele tipo local deixar de
> existir em favor de `SaleDto`.

### 9. O relatório de caixa não precisou mudar

`summary.discounts` soma `sales.discount`, que **já inclui** o cupom. Somar
`couponDiscount` ali contaria o abatimento duas vezes e o relatório deixaria de
bater com o Dashboard.

### 10. O desconto de item sai NA LINHA DO ITEM, com o preço de tabela

A API grava o item com `unitPrice` **líquido** e o desconto unitário à parte
(`discount`); o carrinho do PDV guarda preço de tabela e desconto. Os dois
caminhos preenchem `ReceiptItem.unitDiscount`, e o layout imprime:

```
CARREGADOR CELULAR IPHONE           R$ 20,00
1 UN x R$ 22,00
Desconto                           - R$ 2,00
```

A linha da quantidade mostra o preço de **tabela** de propósito: "1 UN x
R$ 20,00" seguido de "Desconto - R$ 2,00" sugeriria R$ 18,00. O total da linha
(à direita) continua sendo o que o cliente pagou, e o Subtotal do bloco de
totais continua sendo a soma dessas linhas — o mesmo Subtotal que o carrinho
mostra na tela.

Antes deste campo o cupom só lia o preço líquido, e o desconto de item sumia
das duas vias: o produto de R$ 22,00 vendido a R$ 20,00 saía no papel como se
custasse R$ 20,00. O histórico do PDV tinha o mesmo ponto cego — lia só
`sales.discount`, que não inclui o desconto de item; ver
`computeSaleDiscountTotal` no `@workspace/core`.

## Testes

`npm run test --workspace=@workspace/receipt`

O que a suíte trava: venda só com cupom imprime Subtotal; a linha do cupom vem
antes do TOTAL; venda sem abatimento nenhum não fala em desconto; código e
descrição com `<` e `"` saem escapados; venda zerada sai sem troco; e a
reimpressão via `buildReceiptFromSale` produz **o mesmo bloco de totais** e
**a mesma linha de item com desconto** que a primeira via montada do carrinho —
a comparação é feita sobre o HTML, porque o que precisa bater é o que sai no
papel.

`print.ts` aparece descoberto no relatório e não adianta fingir o contrário: ele
fala com a impressora do sistema pelo iframe, e o jsdom não implementa
`window.print`.
