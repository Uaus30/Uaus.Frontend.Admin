# Promoções (Dia a Dia e Relâmpago) — especificação de implementação

> **Estado: especificação fechada em 18/09/2026, nada implementado.**
> Contrato único desta feature. **Toda camada codifica contra este arquivo.**
> Divergiu daqui, está errado — e se a divergência estiver certa, corrija aqui
> primeiro.
>
> Revisão de 18/09/2026 (segunda passada, depois da crítica ao próprio plano):
> a régua do "peso no dia" foi **remedida** na grandeza certa, a semântica do
> range das invariantes mudou, o worker de consolidação saiu, e entrou o
> **Investimento** (seção 9).
>
> Terceira passada, no mesmo dia, depois da crítica às decisões do dono: o PDV
> passa a consultar promoções **em tempo real** (decisão 3), a **Relâmpago
> sobrepõe o Dia a Dia** (decisão 5), o operador pode **liberar o limite**
> (decisão 25), existe **plano B escrito** para o sábado (decisão 26), a nota
> ganhou a pergunta que ela responde de verdade (decisão 24 e 8.4) e as fases 3
> e 4 trocaram de lugar.

---

## 0. Decisões fechadas (18/09/2026, com o dono)

| #  | Decisão                                                                                     | Consequência                                                                                        |
| -- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1  | **A promoção é dado; o preço promocional é DERIVADO.** `Product.Price` nunca é escrito         | nada para restaurar quando acaba; o "de/por" fica honesto e a margem do BI continua correta             |
| 2  | **Nada de `PromotionalValue` no `ProductGroup`**                                               | preço continua morando em um lugar só (`products.price`), e não há minuto crítico para um worker perder |
| 3  | **O PDV consulta as promoções em TEMPO REAL**, e a base local é a rede de segurança             | promoção criada às 13h de sábado chega ao balcão sem fechar o caixa; queda de internet não muda preço (ver 5.1) |
| 4  | **Uma promoção promove UM `ProductGroup`** e vale para todas as variações ativas dele          | percentual respeita preço diferente por variação; preço final iguala todas (ver 4.2)                    |
| 5  | **Relâmpago SOBREPÕE Dia a Dia** no mesmo produto; duas do mesmo tipo nunca se sobrepõem       | o produto com preço de patamar entra na relâmpago de sábado sem ninguém encerrar e recriar nada (ver 3.1) |
| 6  | **Relâmpago é de um dia só**, com intervalo de horário opcional                                | o teto de 24 h sai da própria seleção, e não de uma validação que alguém pode afrouxar depois           |
| 7  | **`sale_items.promotion_discount` é PARCELA de `sale_items.discount`**, nunca uma adição       | precedente de `sales.coupon_discount`; nenhum totalizador existente precisa mudar                       |
| 8  | **A parcela da promoção sai do limite de desconto do vendedor**                                | sem isso, toda relâmpago de 30% pede senha de administrador a cada cliente na fila                      |
| 9  | **A venda fotografa `promotion_id`**                                                           | a aba Performance sobrevive a editar, encerrar ou excluir a promoção — precedente do resgate de cupom   |
| 10 | **Uma única relâmpago com exibição no site por vez**                                           | o site nunca precisa escolher entre dois banners                                                        |
| 11 | **Toda promoção vigente marca o card do site**; `ShowOnSite` decide só o BANNER                | a vitrine nunca anuncia um preço diferente do que o balcão cobra                                        |
| 12 | **Nota 0–100 só para Relâmpago**; Dia a Dia mostra totalizadores e impulso                     | as duas perguntas são diferentes: a relâmpago é um evento, a dia a dia é um patamar                     |
| 13 | **Dia a Dia aceita desconto ZERO** ("efeito isca": produto já barato marcado como promoção)    | vale para o PERCENTUAL. **Preço final zero é sempre recusado** — gravaria o produto a R$ 0,00 e o balcão obedeceria |
| 14 | **O "de/por" só aparece no site com diferença > 5%**                                           | "de R$ 5,00 por R$ 4,90" chama atenção para um corte de 2%; abaixo do corte, só a etiqueta              |
| 15 | **O banner do site é composto em HTML**, não é a arte gerada por IA                            | preço, limite e contagem vêm do dado e nunca mentem; a arte serve WhatsApp e Stories                    |
| 16 | **Relâmpago guarda duas artes opcionais** (4:5 e 9:16) como `ImageType.Banner`                 | reusa upload, S3, versionamento e o catálogo de Imagens que já existem                                  |
| 17 | **O prompt das artes é gerado na hora, nunca guardado**                                        | regenerar é de graça e sempre bate com o preço, o limite e a validade atuais                            |
| 18 | **O relógio de 18h é do SITE, não da vigência**                                                | a loja pode ficar aberta alguns minutos a mais e continuar vendendo no preço (ver 6.3)                  |
| 19 | **Limite opcional de unidades por VENDA**, somado entre as variações do grupo                   | o excedente sai em linha separada, a preço normal — o cupom explica sozinho o que o cliente pagou       |
| 20 | **A nota é função pura do histórico**, com as réguas ancoradas na data da promoção             | sem worker, sem foto, sem "parcial até as 19h": reproduzível daqui a um ano (ver 8.1)                   |
| 21 | **O "peso no dia" é medido por TICKET**, não pelo faturamento do item                          | promoção de item barato deixa de ser punida por ser barata (ver 1 e 8.2)                                |
| 22 | **Investimento** é o quanto a promoção custou de faturamento, e **não se subtrai do lucro**    | `sale_items.profit` já está líquido do desconto; subtrair de novo conta duas vezes (ver 9)              |
| 23 | **As réguas do Relâmpago são medidas no MESMO DIA DA SEMANA da promoção**, nas 12 ocorrências anteriores | sábado fatura 1,75× a média da loja; medir uma relâmpago de sábado contra um dia comum premiaria o dia, não a promoção (ver 1.2) |
| 24 | **A nota responde "este produto é uma boa escolha para promoção?"**, e não só "como foi"       | ela precisa ser comparável entre promoções e ficar ao lado do histórico do produto (ver 8.4)            |
| 25 | **O operador pode liberar o limite numa venda**, com registro                                   | o dono já deixou um casal somar as compras; o sistema não pode ser mais rígido que a loja (ver 5.4)     |
| 26 | **Plano B de emergência: encerrar a promoção e baixar o preço no cadastro**                      | é o método atual da loja, continua funcionando, e o tempo real (decisão 3) faz o balcão obedecer em minutos |

---

## 1. Os números da loja que calibram a nota

Medidos na dev (cópia de produção de 15/09/2026) em 18/09/2026, vendas não
canceladas (`payment_status <> 5`, o mesmo critério das três telas de BI).

### 1.1 A loja inteira, em 90 dias

| Medida                                                   | Valor                    |
| --------------------------------------------------------- | ------------------------ |
| Vendas/dia · faturamento/dia                             | 12,7 · R$ 304,37         |
| Ticket médio · unidades por venda · linhas por venda     | R$ 23,99 · 3,51 · 2,11   |

**O campeão do dia, medido por UNIDADES** — que é o que uma relâmpago produz:

| Medida                                                        | Valor                                          |
| --------------------------------------------------------------- | ---------------------------------------------- |
| Unidades vendidas                                              | 9,3                                            |
| Faturamento **do próprio item** / faturamento do dia           | **9,8%**                                       |
| Faturamento dos **tickets que o contêm** / faturamento do dia  | 21,2% média · 18,4% mediana · 30% p75 · 42,2% p90 · 80,9% máx |
| Em quantas vendas do dia ele aparece                           | 2,4 de 12,7                                    |
| Lucro do próprio item · lucro das outras linhas da mesma venda | R$ 11,05 · R$ 13,86 (1,30 por real do item)    |

> **Por que a distinção importa, e por que a primeira versão deste plano errava
> aqui.** A régua dos 25% tinha sido medida no campeão por **faturamento**
> (18,3%) e aplicada a um componente que calcula a participação do item **com
> preço cortado**. O campeão por unidades faz só **9,8%** do dia sozinho. Com a
> xuxinha a R$ 0,01 das artes de referência, 300 unidades vendidas dariam
> R$ 3,00 — 1% do dia, nota 4 num componente que vale 25%. A promoção que a loja
> mais faz seria punida por ser barata.

### 1.2 O sábado é outro dia — e é nele que a relâmpago acontece

Medido em 18/09/2026, 90 dias, por dia da semana. **Não existe domingo na base**:
a loja não abre.

| Dia      | Vendas/dia | Faturamento/dia | Ticket    | Unidades por venda |
| -------- | ---------- | --------------- | --------- | ------------------ |
| segunda  | 9,7        | R$ 193,45       | R$ 20,01  | 3,37               |
| terça    | 11,8       | R$ 241,76       | R$ 20,41  | 3,29               |
| quarta   | 11,0       | R$ 242,55       | R$ 22,05  | 3,36               |
| quinta   | 11,4       | R$ 288,22       | R$ 25,25  | 3,52               |
| sexta    | 13,1       | R$ 333,54       | R$ 25,49  | 3,48               |
| **sábado** | **19,2** | **R$ 531,95**   | **R$ 27,75** | **3,82**        |

O sábado fatura **1,75× a média da loja**. Medir uma relâmpago de sábado contra o
dia médio premiaria o dia da semana, não a promoção — e, pior, faria qualquer
sábado parecer um sucesso. Daí a decisão 23.

**O campeão de um sábado** (12 sábados nos últimos 90 dias):

| Medida                                                        | Valor                                             |
| --------------------------------------------------------------- | ------------------------------------------------- |
| Unidades vendidas                                              | **14,6** (13,7 na média dos 27 sábados da base)   |
| Faturamento dos **tickets que o contêm** / faturamento do dia  | 23,1% média · 16,6% mediana · **37,4% p75** · 49,8% p90 |
| Em quantas vendas do sábado ele aparece                        | 4,2 de 19,2                                       |
| Lucro do próprio item · lucro das outras linhas da mesma venda | R$ 21,97 · R$ 25,37 (**1,15 por real do item**)   |

> **Por que o alvo sai do p75, e não do p90.** Com 12 sábados, o p90 é o segundo
> ou terceiro maior valor — ele pula de 49,8% nos últimos 12 sábados para 71,9%
> nos 15 anteriores. O p75 fica em 37,4% e 40,5% nas duas metades: é a estatística
> que a amostra sustenta. Alvo em **40%** significa que a promoção precisa bater
> três de cada quatro sábados normais para tirar nota cheia.

### 1.3 O catálogo

| Medida (30 dias)                                | Valor                    |
| ------------------------------------------------- | ------------------------ |
| Grupos que venderam · mediana no mês · campeão   | 249 · **2 un** · 199 un  |
| Grupos que vendem ≥ 14 un/dia                    | **zero**                 |

| Catálogo (18/09/2026)                        | Valor         |
| ---------------------------------------------- | ------------- |
| Grupos ativos (`Active` + `OutOfStock`)       | 894           |
| Com mais de uma variação                      | 98            |
| **Com preços diferentes entre as variações**  | **25** (2,8%) |

---

## 2. Modelo de dados

### 2.1 `Promotion` (`Uaus.Domain/Entities/Promotion.cs`)

```csharp
public class Promotion : Entity
{
    public long ProductGroupId { get; set; }       // a promoção promove o GRUPO
    public PromotionType Type { get; set; }        // None=0 | Everyday=1 | Flash=2
    public PromotionDiscountType DiscountType { get; set; } // None=0 | Percentage=1 | FinalPrice=2
    public decimal DiscountValue { get; set; }     // 0..90 (%) ou reais — zero só em Everyday (decisão 13)
    public DateTime ValidFrom { get; set; }        // instante, INCLUSIVO
    public DateTime? ValidUntil { get; set; }      // instante, INCLUSIVO; nulo = sem prazo (proibido em Flash)

    /// <summary>Teto de unidades do GRUPO com preço promocional na MESMA venda. Nulo = sem limite.</summary>
    public int? MaxQuantityPerSale { get; set; }

    /// <summary>
    /// Meta de unidades desta promoção, escrita pelo dono ("quero vender 60 copos").
    /// Nula = usa o padrão calculado (8.2). Existe porque um piso único não serve a
    /// um catálogo que vai de R$ 0,01 a R$ 30: quatorze unidades de um item de R$ 25
    /// é um feito, quatorze xuxinhas de um centavo é um cliente e meio.
    /// </summary>
    public int? TargetQuantity { get; set; }

    public bool IsActive { get; set; } = true;     // false = "encerrar agora"
    public bool ShowOnSite { get; set; }           // BANNER da vitrine; só em Flash
    public long? FeedImageId { get; set; }         // arte 4:5  (ImageType.Banner)
    public long? StoryImageId { get; set; }        // arte 9:16 (ImageType.Banner)
    public bool IsDeleted { get; set; }            // nome literal: o BaseRepository liga o soft delete por reflexão

    public virtual ProductGroup ProductGroup { get; set; } = null!;
    public virtual Image? FeedImage { get; set; }
    public virtual Image? StoryImage { get; set; }
}
```

`ValidFrom`/`ValidUntil` em vez de `StartsAt`/`EndsAt` porque quem decide
**dinheiro** neste sistema é o `Coupon`, e ele usa esses nomes. A `Campaign` usa
`StartsAt`/`EndsAt` justamente porque ela **não** decide dinheiro.

Não há coleção de vendas aqui: quem precisa delas consulta o repositório de
`SaleItem`. Coleção sem inverso declarado faz o EF criar uma FK sombra — a mesma
armadilha documentada em `Coupon`.

### 2.2 `SaleItem` ganha duas colunas

```csharp
/// <summary>Promoção que baixou o preço deste item, fotografada na gravação.</summary>
public long? PromotionId { get; set; }          // FK ON DELETE SET NULL

/// <summary>
/// Parte de <see cref="Discount"/> que veio da promoção. É PARCELA, não adição.
///
/// É a matéria-prima do INVESTIMENTO da promoção (seção 9), e por isso precisa
/// ficar separada do desconto que o operador deu por conta própria: somados, o
/// investimento infla com dinheiro que a promoção não gastou.
///
/// Pode ser ZERO com <see cref="PromotionId"/> preenchido: a promoção de destaque
/// sem desconto existe (decisão 13), e a atribuição é o que permite medir se
/// marcar o produto moveu alguma coisa.
/// </summary>
public decimal PromotionDiscount { get; set; }
```

`Discount` continua sendo o desconto unitário TOTAL do item e continua fora do
`Subtotal`. Nenhum totalizador existente muda — é a mesma aritmética que
`sales.coupon_discount` já usa.

### 2.3 Script de esquema — **não é um script inofensivo**

`Uaus.Data/Scripts/2026-09-18_create_promotions.sql`, aplicado no boot pelo
`SqlScriptRunner`, em ordem de nome. Conteúdo:

- tabela `promotions` com FK para `product_groups` (`ON DELETE RESTRICT`) e duas
  FKs anuláveis para `images` (`ON DELETE SET NULL`);
- `sale_items.promotion_id` (FK `ON DELETE SET NULL`) e
  `sale_items.promotion_discount numeric(10,2) NOT NULL DEFAULT 0`;
- `CHECK` do teto de 24 h no Relâmpago, de `max_quantity_per_sale > 0` e de
  `target_quantity > 0`;
- índice em `promotions (product_group_id)` e em `sale_items (promotion_id)` —
  as duas consultas da aba Performance batem nessas colunas, e `sale_items` é
  tabela que só cresce;
- `CREATE EXTENSION btree_gist` e as duas invariantes de sobreposição (2.4).

> **Classificação de risco.** Acrescentar coluna é aditivo e benigno. `CREATE
> EXTENSION` + `EXCLUDE` **não é**: o `SqlScriptRunner` **lança** quando um
> script falha, e script que falha não entra em `schema_migrations` — ele é
> retentado a cada restart. Um erro de DDL em produção não é "um script que não
> rodou", é **a API que não sobe**, em laço.
>
> Portanto: rodar o script contra um banco descartável **antes do commit**, e
> conferir o `btree_gist` no banco de produção antes de promover (na dev ele já
> está instalado, versão 1.7 — isso não prova produção).

### 2.4 As duas invariantes moram no banco

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (a) duas promoções do MESMO TIPO no mesmo grupo não se sobrepõem.
--     Relâmpago sobre Dia a Dia é permitido de propósito (decisão 5): o `type WITH =`
--     é o que abre essa porta sem abrir nenhuma outra.
ALTER TABLE promotions ADD CONSTRAINT ex_promotions_sem_sobreposicao
  EXCLUDE USING gist (
    product_group_id WITH =,
    type WITH =,
    tsrange(valid_from, coalesce(valid_until, 'infinity'), '[]') WITH &&
  ) WHERE (is_active AND NOT is_deleted);

-- (b) duas relâmpagos NO BANNER não se sobrepõem, ainda que em produtos diferentes
ALTER TABLE promotions ADD CONSTRAINT ex_promotions_banner_unico
  EXCLUDE USING gist (
    tsrange(valid_from, coalesce(valid_until, 'infinity'), '[]') WITH &&
  ) WHERE (is_active AND NOT is_deleted AND show_on_site AND type = 2);
```

> **Correção de 18/09/2026, achada na revisão adversarial da fase 1a.** Uma
> versão anterior deste plano mandava usar `'[)'` com `+ interval '1 second'`,
> dizendo que `'[]'` recusaria janelas que apenas se encostam. **Estava errado nas
> duas pontas.**
>
> `'[]'` já aceita janelas encostadas — `[8:00, 11:59:59]` e `[12:00:00, 18:00]`
> não se cruzam. O que `'[]'` recusa, e deve recusar mesmo, é emendar no MESMO
> instante do fim: com fim inclusivo, às 12:00:00 as duas valeriam.
>
> Pior, o `+ 1 second` **divergia do serviço** por até um segundo. O predicado da
> aplicação é "conflita se `x.ValidFrom <= novoFim` e `x.ValidUntil >= novoInício`";
> com segundos inteiros as duas formulações coincidem, mas `EndNowAsync` gravava
> `DateTime.Now` **com fração de segundo** — e encerrar às 14:31:59.412 e emendar
> às 14:32:00 passava no serviço e era recusado pelo banco, virando um 500 com a
> mensagem crua do Postgres no caminho mais comum que existe aqui.
>
> A correção tem três partes: `'[]'` (que reproduz o predicado exatamente), o
> serviço **truncando o "encerrar agora" para o segundo**, e a violação da
> constraint traduzida em recusa legível (`MentionsOverlapConstraint`, no molde do
> `FinancialClosingService`) — sem ela, a rede de proteção chegava ao
> administrador como erro interno.

O serviço valida antes e devolve frase legível ("já existe promoção para este
produto entre 14:00 e 18:00 de 18/09/2026"); a constraint é a rede embaixo, para
o caso de dois administradores salvando ao mesmo tempo. É o mesmo desenho do
índice único do `client_reference`: a checagem resolve o caso comum, o banco
resolve a corrida.

---

## 3. Vigência, precedência e o relógio

### 3.1 Relâmpago vence Dia a Dia — e é a única precedência que existe

Um produto pode ter, ao mesmo tempo, um preço de patamar (Dia a Dia) e uma
relâmpago de sábado. Sem isso, o dono teria que **encerrar o Dia a Dia na sexta e
recriá-lo na segunda**, toda semana, justamente nos itens baratos e populares que
são os candidatos naturais aos dois — trabalho manual que esta feature existe
para acabar.

A regra é uma linha e vale em todo lugar:

> **Vigendo as duas, aplica-se a Relâmpago.** Duas do mesmo tipo nunca se
> sobrepõem, então a escolha nunca tem três candidatas.

Quem resolve é **uma função só por camada** — `PromotionResolver` no backend,
`resolvePromotion` no PDV —, e todos os consumidores passam por ela: carrinho,
cupom, card da vitrine, banner e a atribuição da venda. Duas implementações da
precedência é o caminho conhecido para o site anunciar um preço e o caixa cobrar
outro.

Três consequências que precisam estar escritas:

- **A venda é atribuída à promoção aplicada**, uma só. Durante a relâmpago, o Dia
  a Dia não recebe venda nenhuma, e o painel dele mostra o buraco — está certo: a
  unidade saiu sob a relâmpago.
- **O "de" continua sendo o preço de tabela** (`products.price`), no cupom e no
  site. É o número que o cliente reconhece e o único que não depende de qual
  promoção venceu.
- **O investimento da relâmpago é medido contra a tabela**, não contra o preço do
  Dia a Dia. Simplificação deliberada: é o que o cupom impresso mostra e o que se
  audita linha a linha. Parte desse desconto já estava sendo dada pelo Dia a Dia
  — a relâmpago o "come" durante a janela.

### 3.2 Janelas

| Regra              | Relâmpago                                       | Dia a Dia                        |
| ------------------ | ----------------------------------------------- | -------------------------------- |
| Seleção na tela    | **um dia** (hoje ou futuro) + horário opcional  | início (data+hora), fim opcional |
| Padrão do horário  | 00:00:00 → 23:59:59 do dia escolhido            | —                                |
| `ValidUntil`       | obrigatório, no mesmo dia-calendário            | opcional (nulo = sem prazo)      |
| `ShowOnSite`       | permitido                                       | sempre `false`                   |
| Desconto zero      | recusado                                        | **permitido** (decisão 13)       |

**Fuso.** O fim "23:59:59 do dia escolhido" é a armadilha 5 e 6 do `CLAUDE.md`:
`toISOString()` grava `20:59` e a promoção morre três horas antes, com o cliente
no balcão. A composição correta já existe em
`apps/admin/src/features/campaigns/hooks/campaignRules.ts` — dia por `toDateKey`
do `@workspace/core`, segundos fixos (`00` no início, `59` no fim), comparação
início × fim sobre as strings compostas. **Repetimos o padrão dentro da feature
de promoções**, sem extrair para `packages/core`: são duas ocorrências, e a
regra do repositório é que duas não são duplicata. Na terceira, sobe para o
core — e aí campanhas migra junto.

**Edição.** Promoção com venda atribuída não se edita: só se **encerra agora**
(`ValidUntil = agora`, ou `IsActive = false` se ainda não começou). Exclusão é
lógica e só enquanto não houver venda atribuída. É o precedente do cupom, e o
motivo é o mesmo: editar o desconto depois do fato reescreveria a história que a
aba Performance conta. As artes (2.1) continuam editáveis — elas não mudam o que
foi vendido.

---

## 4. Preço, desconto e margem

### 4.1 O cálculo

```
Percentage:  preco_promo(variação) = round2(price × (1 − value/100))
FinalPrice:  preco_promo(variação) = value            // o mesmo R$ para todas
```

O arredondamento é `round2` e acontece **por variação**, na aplicação — nunca
dentro de um `Select` do EF, que manda a divisão para o SQL sem o `CASE` e
avalia no cliente (`docs/projecoes-ef-e-avaliacao-no-cliente.md`).

### 4.2 Recusas e avisos

| Situação                                                      | Comportamento                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Percentual fora de 0–90                                        | recusa                                                                    |
| **Desconto zero em Relâmpago**                                 | recusa — relâmpago é um evento de preço                                   |
| **Percentual zero em Dia a Dia**                               | **aceito**: destaque sem mexer no preço (decisão 13)                      |
| **PREÇO FINAL zero, em qualquer tipo**                         | recusa — gravaria o produto a R$ 0,00                                     |
| Tipo ou tipo de desconto fora do enum                          | recusa (o serializador aceita qualquer inteiro; sem a guarda vira 500)     |
| Preço final **acima** do menor preço atual do grupo            | recusa ("promoção que aumenta preço não é promoção")                      |
| Preço final abaixo do **custo** de alguma variação             | **aviso** com confirmação nomeando o produto — queima é decisão da loja    |
| Margem resultante < 30%                                        | **aviso** (é o corte `TIGHT_MARGIN_PERCENT` do `packages/core`)           |
| Grupo com **preços diferentes** entre variações + preço final  | **aviso**: "as variações custam de R$ 12,00 a R$ 18,00; o preço final iguala todas" (25 grupos hoje) |
| Limite de unidades ou meta ≤ 0                                 | recusa; vazio = sem limite / meta padrão                                  |

### 4.3 O painel do formulário

Preço atual, custo, preço promocional e **margem sobre o preço final**, com a
cor de `marginBand` (`packages/core/src/pricing.ts`: verde ≥ 40%, âmbar 30–40%,
vermelho < 30%) — o mesmo vocabulário da entrada de estoque e do recebimento de
compra, para o mesmo produto não sair amarelo numa tela e verde na outra. Com
mais de uma variação, tabela por variação e faixa (mín–máx) no resumo.

Ao lado, a **projeção do investimento**: "vendendo a meta de 60 unidades, esta
promoção custa R$ 45,60 de faturamento". É o mesmo número da seção 9, calculado
antes de acontecer — a decisão de descer o preço fica com o custo dela na tela.

---

## 5. PDV

### 5.1 Tempo real, com a base local por baixo

O offline do PDV é para **desastre** — queda de internet ou de energia em horário
comercial, que é raro. Promoção, ao contrário, é decidida no dia. Então o desenho
inverte a ênfase em relação ao resto do PDV:

| Quando                                   | O que acontece                                                    |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Abertura da sessão de caixa              | `GET /Pdv/snapshot` traz `promotions[]` junto com o resto          |
| **Ao iniciar cada venda**, se online     | `GET /Pdv/promotions` atualiza a base local                        |
| **A cada 5 minutos**, se online          | o mesmo, como piso                                                 |
| Sem internet                             | vale o que está na base local — a promoção continua sendo aplicada |

**A leitura é sempre da base local**, nunca da rede: um caminho só para o
carrinho, e a atualização é só quem escreve nela. Assim a queda de internet no
meio do sábado não muda preço nenhum, e a promoção cadastrada às 13h chega ao
balcão em minutos, sem fechar o caixa.

A atualização ao **iniciar a venda** não é enfeite: é o mesmo instante em que o
`referenceInstant` é congelado (5.3). Os dois juntos garantem que o preço de uma
venda é decidido uma vez, com o dado mais fresco que existia naquele momento.

`GET /Pdv/promotions` aceita `Admin` e `Seller`, como os outros três endpoints do
PDV, e devolve exatamente o mesmo formato de `promotions[]` do snapshot — um
contrato, dois portadores.

### 5.2 O que vai na base local

`GET /Pdv/snapshot` ganha `promotions[]`:

```jsonc
{ "id": 7, "productGroupId": 118, "type": "Flash", "discountType": "Percentage",
  "discountValue": 30, "validFrom": "2026-09-19T14:00:00", "validUntil": "2026-09-19T18:00:00",
  "maxQuantityPerSale": 6 }
```

Filtro: não excluídas, ativas, cuja janela intersecta `[agora, agora + 7 dias]`.
Sete dias porque a sessão de caixa abre de manhã e a relâmpago é da tarde — e
porque o payload é de poucas linhas.

**Isto sobe `PdvSnapshotDto.CurrentSchemaVersion`** e, como acrescenta uma store
nova no IndexedDB, **sobe também o `DATABASE_VERSION` do PDV** (armadilha 4:
acrescentar campo não muda, acrescentar store muda). Consequência operacional a
avisar: no primeiro acesso depois do deploy, a base local é recriada e **o caixa
precisa de internet** para reconstruí-la.

### 5.3 A alocação é DERIVADA, não congelada

O carrinho guarda a linha crua (produto, quantidade, desconto manual). Quem
decide o que é promocional é uma função pura:

```ts
allocatePromotions(items, promotions, referenceInstant) -> PdvItem[]
```

É o mesmo desenho do cupom em `stores/pdv-cart.ts`, e pelo mesmo motivo escrito
lá: **congelar o valor em reais é o erro que o desenho existe para impedir**.
Bipar mais uma unidade muda a alocação do limite; um valor congelado deixaria a
tela mostrando um número e o payload levando outro.

O `referenceInstant` é **congelado no primeiro item da venda** e relido quando
uma venda em espera é retomada. Sem isso, uma relâmpago terminando às 18:00:00
mudaria o preço no meio da conferência do carrinho.

### 5.4 O limite por venda

O limite é do **grupo**, somado entre as variações, dentro da mesma venda: 4
azuis e 4 vermelhos com limite 6 dão 6 unidades no preço promocional e 2 no
preço normal. A alocação é **por ordem de entrada no carrinho** — previsível
para quem opera e para quem confere o cupom.

O excedente vai para uma **segunda linha**, sem promoção:

```
6 UN x R$ 2,50    Desconto - R$ 9,06      PROMOÇÃO RELÂMPAGO
4 UN x R$ 2,50
```

Isso obriga uma mudança no `addItem` de `use-pdv-store.ts`: hoje ele funde por
`productId`, e passa a fundir por `productId + promotionId`. A alternativa —
uma linha só com desconto médio — não cabe no modelo: `discount` é **por
unidade** em `SaleItem`, em `SaleItemForTotals` e no `packages/receipt`, e um
desconto médio produziria centavos que o cupom não consegue explicar.

**Três bordas que a segunda linha cria**, e que os testes cobrem nominalmente:

1. **O resíduo do cupom** é alocado "ao item de maior subtotal, empate pelo menor
   `ProductId`". Duas linhas do mesmo produto podem empatar nos **dois**
   critérios; o desempate ganha um terceiro nível (a posição do item na lista),
   senão a alocação de centavos deixa de ser determinística — e é dinheiro.
2. **O estoque** é conferido por linha. 6 + 4 passariam em duas checagens
   individuais e estourariam o saldo somado: a conferência passa a ser **por
   produto agregado**, não por linha.
3. **Venda em espera** gravada no `localStorage` antes do deploy volta sem
   `promotionId`; a chave de fusão precisa tratar `undefined` como "sem
   promoção", como o campo `surcharge` já faz.

O cartaz diz "por cliente" e o campo do admin diz "por venda". Os dois estão
certos: a loja fala com o cliente, o sistema conta o que consegue contar. O
texto de ajuda do campo diz isso com todas as letras.

**O operador pode liberar o limite naquela venda** (decisão 25), num botão na
linha, e a liberação vai para o `logs` com a venda, a promoção e a quantidade.
O caso é real e já aconteceu: um casal somou as compras e passou junto no caixa,
e o dono deixou — dava no mesmo que passar em duas vendas. Sem a liberação, o
sistema obrigaria a desfazer e refazer a venda em duas, na fila do sábado, para
chegar ao mesmo total. **O limite é comunicação comercial, não trava**; o
registro existe para o limite continuar significando alguma coisa quando a
promoção for medida depois.

### 5.5 No carrinho

- Ao bipar, a linha nasce com `price` de tabela e
  `discount = price − preco_promo`, com selo visível ("PROMOÇÃO" /
  "RELÂMPAGO") e, havendo limite, o lembrete "limite de 6 un por cliente".
- Desconto manual do operador **soma** por cima do da promoção. Cupom continua
  incidindo depois de tudo: a ordem item → global → cupom de `computeSaleTotals`
  não muda.
- **Venda em espera**: ao retomar, o PDV reavalia e avisa se a promoção acabou
  ("a relâmpago terminou às 18:00; o item voltou ao preço de tabela"). A surpresa
  fica antes do pagamento, e não na sincronização de amanhã.

### 5.6 O limite do vendedor

`PdvService.ExceedsDiscountLimit` passa a conferir, por item,
`(item.Discount − item.PromotionDiscount) / listPrice`. Sem isso, a relâmpago de
30% estoura qualquer limite e cada cliente da fila passa a exigir login e senha
de administrador — exatamente o que o XML doc do método conta que aconteceu com
o cupom.

### 5.7 Gravação e sincronização

O item da venda chega com `promotionId` e `promotionDiscount`. O servidor:

1. confere que a promoção existe, não está excluída, é do grupo do produto e
   estava **vigente no `occurredAt`** — nunca na hora do sync. A venda das 17h50
   sincronizada às 8h do dia seguinte tem que passar: o cliente já pagou;
2. recalcula o preço promocional e audita o que o PDV mandou, com a mesma
   tolerância de R$ 0,01 que `EnsureIsValid` já aplica ao total;
3. soma as quantidades com a mesma `promotion_id` e confere o limite;
4. grava `promotion_id` e `promotion_discount`.

**Divergência nunca recusa venda paga** — é a decisão 7 do
`PLANO-CUPONS-CAMPANHAS.md`, e vale igual aqui. Promoção inválida no
`occurredAt` (relâmpago expirada numa venda em espera, promoção excluída no
meio): o item entra com `promotion_id` nulo e o abatimento inteiro em
`discount`. Quantidade acima do limite: a venda entra como veio, e o excesso é
**carimbado** — registro em `logs` e um contador "vendas acima do limite" na aba
Performance. Recusar aqui deixaria venda paga fora do caixa; esconder deixaria um
furo de desconto invisível.

### 5.8 Cupom impresso

A linha do item já mostra preço de tabela e "Desconto − R$ x"
(`packages/receipt/src/render.ts`). Acrescentamos o rótulo da promoção na linha
e, no rodapé, o total economizado. Quem compra na relâmpago leva no papel o
quanto economizou — é o que hoje se perde ao baixar o preço no cadastro.

---

## 6. Vitrine

### 6.1 O que o card e o detalhe mostram

Toda promoção **vigente** (Dia a Dia ou Relâmpago) marca o produto no site. O
`StorefrontProductDto` ganha um bloco anulável:

```jsonc
"promotion": {
  "type": "Flash",
  "price": 0.99, "priceMax": null,       // o que o cliente paga hoje
  "referencePrice": 2.50,                // o "de" — OMITIDO quando a diferença ≤ 5%
  "endsInSeconds": 7320,                 // só em Flash (ver 6.3)
  "maxQuantityPerSale": 6                // nulo = sem limite
}
```

- `Price`/`PriceMax` continuam sendo o **preço de tabela**: mudar o significado
  deles atingiria filtro, ordenação e o card em silêncio. Quem desenha o de/por
  é o front, com os dois números na mão.
- **O corte de 5% é do servidor**, como `StorefrontStockBadge` já é: abaixo dele
  o `referencePrice` nem sai na resposta, e o site não tem como imprimir
  "de R$ 5,00 por R$ 4,90". Constante nomeada, com o motivo escrito ao lado.
- **Etiqueta "Promoção"** (laranja/preta, com raio) na faixa de selos do card,
  ao lado das etiquetas públicas do `TagRibbons`. Ela é resolvida no backend e
  **não** é uma `Tag` cadastrada: etiqueta cadastrada teria que ser posta e
  tirada à mão, que é o trabalho manual que esta feature existe para acabar.
- Grupo **sem nenhum produto com saldo** não recebe etiqueta nem entra no
  banner: anunciar preço de quem não tem o que vender é mandar o cliente à loja
  para ouvir "acabou".
- Custo, estoque e id interno de imagem continuam fora — regra do
  `StorefrontService`, protegida por `StorefrontServiceTests`.

### 6.2 Ordem: promoção primeiro, com teto

`GET /Storefront/products` e a seção Novidades passam a ordenar por
`(tem promoção) DESC, id DESC`. Três regras:

- **Com termo de busca, a relevância continua mandando.** Busca é a pergunta do
  visitante; empurrar promoção para cima dela seria responder outra coisa.
- Com filtro de departamento ou categoria, a promoção sobe normalmente.
- **Na seção Novidades existe teto: no máximo 4 promoções** entre os 12 cards
  (e entre os 8 do celular). Sem teto, marcar 40 produtos como isca faz a seção
  parar de mostrar novidade nenhuma e a etiqueta parar de significar alguma
  coisa — o preço de usar destaque para tudo é não destacar nada.

Consequência a saber: a vitrine tem rolagem infinita, e uma promoção que começa
ou acaba **no meio** da rolagem pode repetir ou pular um card, porque a ordem
mudou entre duas páginas. É aceitável — dura uma rolagem e se resolve no
recarregamento —, e é a razão de não ordenar por nada mais volátil que isso.

### 6.3 O banner e a contagem regressiva

`GET /Storefront/flash-promotion`, `[AllowAnonymous]` na action (nunca na
classe — é o padrão do `StorefrontController`). Devolve no máximo **uma**
promoção: `Type = Flash`, vigente agora, `ShowOnSite = true`, do grupo com
`ShowOnSite` ligado e com saldo. Nada existindo, devolve nulo.

> **A vigência decide o dinheiro. O relógio do site decide a expectativa do
> visitante.** São dois números de propósito, como a vigência do cupom e a da
> campanha.

`endsInSeconds` é calculado no servidor como
`min(ValidUntil, hoje às 18:00) − agora`. A loja fecha às 18h; anunciar "termina
às 23:59" mandaria o cliente para uma porta fechada. E o contrário também vale:
se às 18h05 ainda houver fila, **a promoção continua valendo no caixa** porque a
vigência não foi cortada — a loja pode ficar aberta alguns minutos a mais sem
que o preço mude embaixo de quem já está lá dentro.

| Momento                                 | Banner   | Etiqueta e preço no card |
| --------------------------------------- | -------- | ------------------------ |
| 14:00–18:00, promoção vigente           | aparece  | aparecem                 |
| 18:01, vigência até 23:59               | **some** | **continuam**            |
| depois da vigência                      | some     | somem                    |

O banner é o primeiro bloco da home, acima do carrossel: a relâmpago dura horas
e é a única coisa da página com prazo. Preto com amarelo/laranja e raio 3D —
**não conflita com o vocabulário de cores** (verde/âmbar/vermelho/cinza), porque
ali a cor é marca, não estado; isso vale só na vitrine. `useReducedMotion` como o
resto da home, nenhuma imagem remota (o raio é SVG do bundle), e o limite por
cliente sai escrito ao lado do preço quando existir. Sem promoção, falha de rede
ou contagem zerada, o banner **some** em vez de mostrar erro — mesma regra de
`FeaturedProducts`. Clique leva ao detalhe do produto.

---

## 7. Admin

### 7.1 Rotas (`apps/admin/src/routes.ts`), todas `SO_ADMIN`

| Rota                          | Tela                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `/marketing/promocoes`        | listagem (entra no menu **logo abaixo de Campanhas**)  |
| `/marketing/promocoes/nova`   | cadastro, tela cheia                                   |
| `/marketing/promocoes/:id`    | detalhe com abas `?aba=dados` e `?aba=performance`      |

`matchPath: "/marketing/promocoes/:id?/:secao?"`, como `PRODUCTS_MATCH_PATH` —
uma `<Route>` só mantém a listagem montada na ida e na volta, e voltar do detalhe
não perde filtro nem página.

`SO_ADMIN` porque a tela expõe custo e margem, como as três telas de BI e como
Cupons e Campanhas. Repetir `roles` na rota de detalhe é obrigatório: proteger a
listagem e esquecer o detalhe é a porta dos fundos que o teste de rotas cobre.

### 7.2 Listagem

Produto (com foto e `ImageHoverZoom`), tipo, desconto, vigência com data **e**
hora, limite por venda, **investimento**, situação (No ar / Programada /
Encerrada / Inativa) e **desempenho**: nota 0–100 para Relâmpago, `+X%` de
impulso para Dia a Dia. Cor pelo vocabulário, sempre com o número ao lado — cor
nunca sozinha.

Nota e investimento são colunas **separadas** de propósito: a nota responde
"funcionou?", o investimento responde "quanto custou?". Ver 9.4.

Em tela estreita as colunas **saem por prioridade** (`hidden 2xl:table-cell`),
nunca viram rolagem horizontal: o que a barra empurra para fora é a ponta
direita, onde moram situação e ações.

### 7.3 Cadastro (tela, não modal)

Produto (busca por grupo) · Tipo · Desconto (percentual ou preço final) ·
Vigência (3) · Limite de unidades por venda (opcional) · Meta de unidades
(opcional) · Exibir no banner do site (só Relâmpago) · o painel de
preço/custo/margem e a projeção de investimento do 4.3. Confirmação nomeando o
produto nos avisos do 4.2.

Estrutura da feature: `apps/admin/src/features/promotions/` com
`hooks/usePromotions.ts` (controlador), `hooks/promotionRules.ts` (regra pura:
composição dos instantes, cálculo do preço e da margem, validação, payload),
`hooks/promotionPrompt.ts` (7.4), `components/`, `types.ts` e `README.md`.
Modelo canônico: `features/fixed-costs`. A página não contém query nem mutation.

### 7.4 Artes e os prompts

Duas artes opcionais por relâmpago: **4:5** (feed e grupos de WhatsApp) e
**9:16** (Stories). Sobem pelo caminho de imagem que já existe — `ImageType.Banner`,
que só precisa da pasta `banners` destravada em `ImageService.GetImageFolder`
(a linha está comentada). Imagem já enviada mantém a URL gravada em `images.url`;
a pasta nova vale para upload novo, então nada quebra. Aviso, não recusa, quando
a proporção do arquivo foge de 4:5 ou 9:16.

Ao lado de cada slot, um botão **"Prompt"** abre uma modal com o texto sugerido,
**editável**, com botão de copiar e a foto de capa do produto para anexar na
ferramenta de IA. O texto é composto na hora por `promotionPrompt.ts` — função
pura, testável, sem rede — e nunca é guardado: regenerar é de graça e sempre bate
com o preço, o limite e a validade de agora.

O molde saiu de três artes que a loja publicou (copo americano, xuxinhas,
batons). **Elas não são um padrão fechado**, e o molde respeita isso: as três
divergem na assinatura (duas "Máximo 30", uma "Uaus!"), no endereço (duas trazem,
uma não) e na cor do raio. Por isso os blocos abaixo são **montados conforme o
dado existir**, e o texto sai editável — direção de arte muda, e um molde rígido
viraria um parágrafo que alguém reescreve à mão toda semana.

| Bloco             | Entra quando                                                                          |
| ----------------- | -------------------------------------------------------------------------------------- |
| Cabeçalho         | sempre — "PROMOÇÃO" em caixa preta + "RELÂMPAGO" em laranja, com raio                  |
| Produto           | sempre — nome em caixa alta + subtítulo; foto recortada em fundo branco com sombra     |
| Atributo          | houver medida no nome ou na descrição (volume, quantidade)                              |
| Preço             | sempre — "POR APENAS R$ X,XX" em laranja + "A UNIDADE" / "CADA"                         |
| Limite            | `MaxQuantityPerSale` preenchido                                                         |
| Validade          | sempre — derivada da vigência por `descreverValidade()`                                 |
| Endereço e marca  | endereço vem de Configurações da Empresa; assinatura é escolhida na modal               |

`descreverValidade()` cobre os três casos das artes de referência: dia inteiro de
hoje ("VÁLIDO APENAS PARA HOJE!"), hoje com hora de fim ("SOMENTE HOJE ATÉ MEIO
DIA!") e dia futuro nomeado pelo dia da semana ("SOMENTE NESTE SÁBADO — O DIA
TODO!"). O prompt manda **escrever os textos exatamente como estão entre aspas,
em português do Brasil** — é onde gerador de imagem erra primeiro — e, no 9:16,
reserva a área segura do topo e do rodapé, que a interface do Instagram cobre.

---

## 8. Aba Performance — Relâmpago (nota 0–100)

### 8.1 A nota é função pura do histórico

**Não há worker, não há foto, não há "parcial até as 19h".** A primeira versão
deste plano copiava a consolidação do desempenho de produtos sem copiar a razão
dela: lá a apuração existe porque o **saldo de estoque daquele dia é
irrecuperável**. Aqui nada é: vendas da janela, faturamento do dia, ticket e
cesta saem todos de `sales`/`sale_items` e continuam lá para sempre.

Para a nota ser reproduzível, **toda régua é ancorada na promoção**: as **12
ocorrências anteriores do mesmo dia da semana** do `ValidFrom`, e o
dia-calendário do próprio `ValidFrom`. Assim a nota calculada hoje e a calculada
daqui a um ano são o mesmo número, sem guardar nada.

**Por que o mesmo dia da semana** (decisão 23): a relâmpago da loja é de sábado, e
sábado fatura 1,75× a média (1.2). Medida contra o dia médio, ela ganharia nota
pelo calendário; medida contra os sábados, ela responde à pergunta certa — *foi
melhor que um sábado normal?* Doze ocorrências são ~3 meses, e foi o recorte que
se mostrou estável nas duas metades da base (1.2). O mesmo vale se um dia a loja
fizer relâmpago numa quarta: a régua acompanha, sem constante nova.

**Com menos de 4 ocorrências daquele dia da semana** no histórico, a régua cai
para todos os dias e a tela diz isso ("medido em 2 sábados"). É a mesma borda de
"coleção de um só" da nota: três sábados de loja recém-aberta não sustentam um
p75, e fingir que sustentam é pior que declarar a régua mais fraca.

Velocímetro e faixas iguais aos do produto: **≥ 70 Destaque**, **≥ 40 Regular**,
abaixo **Fraco**, sem venda = cinza "Sem venda". **A nota sai inteira**, sem casa
decimal: a decimal do produto existe para desempatar dois rankings de 888 itens,
e uma lista de algumas dezenas de promoções por ano não é ordenada por nota.

Régua em `PromotionScoreRules` (estático, sem banco, sem data, sem injeção),
espelhando `ProductScoreRules`: é o único lugar em que peso e corte aparecem.

### 8.2 Os quatro componentes

Todas as réguas abaixo são do **mesmo dia da semana** da promoção (decisão 23).
Os valores da coluna da direita são os do **sábado**, que é quando a loja faz
relâmpago — numa quarta, a mesma fórmula devolve os números da quarta.

| Componente             | Peso | Nota 100 quando                                          | Régua medida no sábado (18/09/2026)    |
| ---------------------- | ---- | ---------------------------------------------------------- | -------------------------------------- |
| Volume                 | 35%  | unidades ≥ `TargetQuantity` ou, na falta, `max(média do grupo nos 12 sábados anteriores, 14 un)` | o campeão de um sábado vende 14,6 un   |
| **Peso no dia (ticket)** | 25%  | **faturamento dos tickets que levaram o produto ≥ 40% do faturamento do dia** | p75 = 37,4%; a média de um campeão de sábado é 23,1% |
| Ticket médio           | 20%  | ticket das vendas com o produto ≥ 1,5× o do dia da semana  | ticket de sábado R$ 27,75 → R$ 41,63   |
| Arraste                | 20%  | outras unidades na venda ≥ 1,5× a cesta do dia da semana   | cesta de sábado 2,82 outras un → 4,2   |

**O componente do dia mede o TICKET, não o item** (decisão 21). O item sozinho
faz 9,8% do dia mesmo quando é o campeão em unidades; com preço promocional, faz
menos ainda. O que uma isca produz é **venda inteira**, e é a venda inteira que
entra na conta. O alvo de 40% é o **p75 dos sábados**, e não o p90: com doze
sábados o p90 balança de 49,8% para 71,9% entre as metades da base, enquanto o
p75 fica em 37,4% e 40,5%. Um campeão de sábado comum tira ~45; para tirar 100 a
promoção precisa ser melhor que três de cada quatro sábados.

**O piso de 14 unidades** é o que o campeão de um sábado vende (14,6 nos últimos
doze, 13,7 nos 27 da base). Ele engole a média do próprio grupo em praticamente
todo caso — nenhum grupo da loja vende 14 un/dia —, e é por isso que o campo
`TargetQuantity` existe: numa loja deste tamanho, a meta que o dono escreve
("quero vender 60 copos") vale mais que qualquer régua derivada.

Três regras que precisam estar escritas:

- **Venda cancelada não conta** (`payment_status <> 5`) — critério que as três
  telas de BI compartilham, e contá-la faria uma promoção desfeita parecer que
  girou.
- **Com menos de 3 vendas**, ticket e arraste são ruído: a nota se renormaliza
  sobre volume e peso no dia (58,3% / 41,7%). É a borda "coleção de um só".
- **O dia da comparação é o dia-calendário da promoção**, não a janela dela. A
  pergunta da loja é "isso fez o dia", não "quanto se concentrou em quatro horas".

Fora da nota, como **fato** na tela: quantas vezes a promoção multiplicou o ritmo
normal do produto ("vendeu 40× o de um dia comum") e quantas vendas passaram do
limite por venda (5.7).

### 8.3 A nota mostra de onde ela veio

O velocímetro vem acompanhado dos **quatro componentes abertos**: quanto cada um
valeu, contra qual régua, com o número medido ao lado ("peso no dia: 28% de 40% →
70 pontos de 100, peso 25%"). Sem isso não há como recalibrar peso nenhum depois,
e a nota vira um número que se aceita ou se ignora — que é o oposto do que ela
existe para fazer.

É o mesmo princípio do `BiHelpDialog`: **o manual fala com os números que a tela
mediu**, não com o exemplo genérico. Os pesos vão mudar depois da primeira
temporada de promoções, e a tela precisa mostrar o que mudar.

### 8.4 A pergunta real: este produto é bom para promoção?

Decisão 24. A nota não existe para julgar o passado — o dono estava lá no sábado
e viu o movimento. Ela existe para a **próxima escolha**: a loja já sabe, por
experiência, que alguns produtos não mexem no movimento e outros esgotam se não
houver limite. A tela precisa transformar isso em registro.

Três coisas sustentam essa leitura, e todas são baratas:

- **Histórico do produto no detalhe da promoção**: "este produto já esteve em 3
  relâmpagos — 82, 41, 77". Uma consulta por `product_group_id`, e é o número que
  decide se ele volta ao cartaz.
- **"Repetir promoção"** na listagem: duplica a promoção encerrada com outra
  data. É o fluxo que o dono descreveu, e sem ele a decisão de repetir vira
  redigitação.
- **Esgotou durante a promoção?** O painel mostra a hora da **última venda** ao
  lado do fim da janela e o saldo atual do grupo: "última venda às 15h20, a
  promoção ia até 18h, saldo zero" é a assinatura do estoque que acabou. É
  **inferência, e a tela diz isso** — a loja não guarda a série do saldo (é o
  mesmo motivo pelo qual o giro do BI é sell-through). Importa porque muda a
  leitura de tudo: uma promoção que esgotou às 15h20 não tirou nota baixa por
  falta de apelo, tirou por falta de mercadoria — e a lição para a próxima é
  estoque maior ou limite menor, não trocar o produto.

---

## 9. Investimento — o que a promoção custou, e se ela se pagou

### 9.1 A conta

```
Investimento = Σ (promotion_discount × quantity)      -- sobre os itens da promoção, vendas não canceladas
```

É exatamente o que o dono descreveu: 100 copos que saíram de R$ 1,75 por R$ 0,99
custaram `100 × 0,76 = R$ 76,00` de faturamento. **Não é estimativa**: o desconto
unitário é gravado na linha da venda, com o preço de tabela **daquele momento** —
subir o preço depois não reescreve o passado.

Quatro coisas que a conta exclui, e por quê:

- **O desconto manual do operador** não entra. Só `promotion_discount`, nunca
  `discount`: somados, o investimento infla com dinheiro que a promoção não gastou.
- **As unidades acima do limite por venda** não entram — elas saíram a preço
  normal e não houve desconto nelas. Continuam contando no arraste, porque estão
  na mesma venda.
- **Venda cancelada** não entra.
- **Promoção isca com desconto zero** dá investimento R$ 0,00, e a tela diz isso
  com todas as letras: "sem investimento — o efeito é de destaque".

### 9.2 O nome

**"Investimento", não "Custo".** `Custo` já tem dono neste sistema: `CostPrice`,
`SaleItem.TotalCost`, "custo de prateleira", "custo em estoque". A mesma tela
mostra margem — que usa custo no sentido antigo — e um segundo significado ao
lado seria o mesmo erro que o vocabulário de cores proíbe ("não invente um quinto
significado"). "Investimento" não colide com nada, e carrega a pergunta certa:
dinheiro posto com expectativa de retorno.

Consequência: o "desconto concedido" que a primeira versão deste plano listava no
painel Dia a Dia **é este mesmo número** e passa a se chamar Investimento em toda
tela. Um número, um nome.

### 9.3 Contra o que ele se compara

Investimento sozinho não decide nada. O painel mostra uma escada, dos números
exatos para o único estimado — e diz qual é qual:

| Linha                                   | Natureza     | De onde sai                                                        |
| --------------------------------------- | ------------ | ------------------------------------------------------------------ |
| **Investimento**                        | exato        | `Σ promotion_discount × qtd`                                       |
| **Lucro do item**                       | exato        | `Σ profit` das linhas promocionais — negativo se o preço ficou abaixo do custo |
| **Arraste**                             | exato        | `Σ profit` das **outras** linhas das vendas que levaram o produto  |
| **Retorno por real investido**          | exato        | `arraste ÷ investimento`                                           |
| **O mesmo, num período equivalente**    | *estimativa* | Relâmpago: os **12 sábados anteriores** (o mesmo dia da semana da promoção). Dia a Dia: os 30 dias anteriores |
| **Saldo**                               | *estimativa* | `(lucro do item + arraste) − (mesma medida na base)`               |

> **A armadilha que este desenho existe para impedir: o investimento NÃO se
> subtrai do lucro.** `sale_items.profit` é `Subtotal − TotalCost`, e o
> `Subtotal` já está líquido do desconto — o investimento **já está descontado
> ali dentro**. Fazer "retorno − investimento" conta o mesmo dinheiro duas vezes,
> exatamente como somar `CouponDiscount` a `Discount` faria. O investimento é a
> explicação do buraco, não uma segunda subtração.

A leitura que decide é a de duas linhas: **"o copo sozinho custou R$ 37 de lucro;
as cestas que ele puxou renderam R$ 160"**. Se o arraste não cobre o item, a isca
não iscou — e isso é visível sem nenhuma estimativa.

**Não existe régua de "retorno por real investido" ainda**, e a tela não vai
fingir que existe: nenhuma promoção foi medida neste sistema. O número aparece
cru na primeira temporada e a régua nasce das próprias promoções, como a base
manda ("o manual fala com os números que a tela mediu"). A única referência que
existe hoje é o comportamento normal da loja, e ela também muda com o dia da
semana: **num sábado**, o campeão dá R$ 21,97 de lucro e as outras linhas das
mesmas vendas dão R$ 25,37 — R$ 1,15 de arraste por real de lucro do item; na
média de todos os dias são R$ 11,05 e R$ 13,86, ou R$ 1,30 por real.

### 9.4 Onde aparece

- **Nas duas abas Performance** (Relâmpago e Dia a Dia).
- **Coluna na listagem**, ao lado da nota — e não dentro dela. A nota mede
  movimento ("funcionou?"); o investimento mede preço ("quanto custou?").
  Fundir os dois faria uma nota baixa virar ambígua — não vendeu, ou vendeu caro
  demais? — e daria nota alta a uma promoção mixuruca só por ser barata.
- **Por dia, nas Dia a Dia longas**: "R$ 900 em 90 dias" é ilegível; "R$ 10 por
  dia" é uma decisão.
- **Como projeção no cadastro** (4.3), antes de a promoção existir.

---

## 10. Aba Performance — Dia a Dia (sem nota)

Totalizadores no período em que a promoção esteve vigente: unidades e
faturamento; **investimento** (seção 9), total e por dia; margem praticada ×
margem normal; ticket médio das vendas com o produto × ticket médio da loja;
**impulso** (un/dia na promoção ÷ un/dia nos 30 dias anteriores ao início), em
`+X%` / `−X%` com a cor do vocabulário; e os 5 produtos que mais saíram junto.

Na promoção de destaque sem desconto o investimento é zero, e aí o impulso
responde sozinho — que é exatamente a pergunta que a isca faz.

---

## 11. Testes (no mesmo commit, não na tarefa seguinte)

Backend (xUnit):

- sobreposição **do mesmo tipo** recusada no serviço **e** pela constraint;
  **Relâmpago sobre Dia a Dia é aceita** (decisão 5), e o resolvedor devolve a
  Relâmpago dentro da janela e o Dia a Dia fora dela — nos dois lados, backend e
  PDV, com o mesmo caso de teste;
- **janela que encosta no mesmo segundo é ACEITA** (é o `+ 1 second` do 2.4, e é
  o caminho "encerrar agora e emendar a próxima");
- Relâmpago: fim obrigatório, mesmo dia, 24 h, dia passado recusado, desconto
  zero recusado; Dia a Dia com desconto zero aceito;
- preço por variação nos dois tipos de desconto, inclusive no grupo com preços
  diferentes; arredondamento no `.005`;
- `ExceedsDiscountLimit` ignora `PromotionDiscount` e continua pegando o desconto
  manual por cima dele;
- venda com `occurredAt` dentro e fora da janela; promoção excluída entre a venda
  e o sync; quantidade acima do limite entra carimbada;
- **investimento**: ignora desconto manual, ignora venda cancelada, ignora o
  excedente do limite, dá zero na promoção sem desconto, e **não** é subtraído do
  lucro;
- nota: mesma entrada dá a mesma nota independente de quando for calculada (as
  réguas são ancoradas na promoção), o componente do dia usa o ticket e não o
  item, e as réguas de uma relâmpago de sábado saem **só dos sábados** — uma
  relâmpago numa quarta puxa as quartas, e a virada de ano na contagem das 12
  ocorrências não pula semana;
- snapshot: promoção futura dentro dos 7 dias entra, fora não;
- storefront: `referencePrice` omitido em diferença ≤ 5% e presente acima;
  promoção primeiro na listagem, teto de 4 nas Novidades, relevância intocada na
  busca; grupo sem saldo fora; um só banner; `endsInSeconds` cortado às 18h;
  nada de custo/estoque no DTO;
- a consulta da aba Performance traduz para SQL (`ToQueryString()`), porque o
  InMemory não prova tradução.

Front (Vitest + RTL):

- `promotionRules`: composição dos instantes na virada do dia, margem, validação,
  projeção de investimento;
- `promotionPrompt`: as três frases de validade das artes de referência, blocos
  opcionais presentes e ausentes, preço formatado em pt-BR;
- `allocatePromotions`: limite dividindo uma linha em duas, limite somando
  variações do mesmo grupo, limite maior que o carrinho, promoção fora da janela,
  venda em espera antiga sem `promotionId`, **limite liberado pelo operador**, e
  **Relâmpago vencendo o Dia a Dia** no mesmo grupo;
- a atualização de promoções em tempo real escreve na base local e **não** altera
  venda em andamento: promoção que chega no meio da venda só vale na próxima;
- estoque conferido pelo total do produto, não por linha;
- a linha promocional no `packages/receipt`;
- o hook controlador da feature.

---

## 12. Ordem de entrega, verificação e os freios

| Fase   | O que entra                                                                     |
| ------ | --------------------------------------------------------------------------------- |
| **1a** | entidade, enums, script, invariantes, CRUD, telas do admin, investimento projetado |
| **1b** | snapshot + `GET /Pdv/promotions`, alocação no carrinho, limite por venda e liberação, limite do vendedor, cupom impresso |
| 2      | abas Performance (os dois tipos), nota aberta, histórico do produto, repetir promoção, investimento na listagem |
| 3      | **artes 4:5 e 9:16 com os prompts**                                               |
| 4      | vitrine: etiqueta, de/por, ordem com teto, banner com contagem                    |

**A fase 3 trocou de lugar com a 4** a pedido do dono, e o motivo é de retorno,
não de esforço: a arte alimenta o **grupo de WhatsApp**, que é o canal onde a
loja já divulga toda semana e onde o cliente da relâmpago está às 15h de sábado.
O site é vitrine — reserva é por WhatsApp e não mexe em estoque —, e o retorno
dele para uma promoção de quatro horas nunca foi medido. A ordem anterior
refletia o tamanho da mudança técnica, que é o critério errado.

**1a e 1b são commits separados de propósito.** A mudança da chave de fusão do
`addItem` toca **toda venda**, promocional ou não; empacotá-la junto com entidade,
script, CRUD e telas faria um eventual defeito do carrinho chegar acompanhado de
outras quatro coisas. A 1a é publicável e inofensiva — ninguém consome a
promoção ainda.

### Como a 1b é verificada antes do commit

O `CLAUDE.md` §9 exige smoke test do fluxo afetado e **parar antes do commit** se
não der para fazer. Para o PDV isso não é automático: exige sessão de caixa
aberta (que exige internet), IndexedDB recriado e o relógio dentro da janela.
O roteiro é:

1. testes puros de `allocatePromotions` cobrindo limite, virada de janela e as
   três bordas do 5.4 — é o que prova a regra;
2. promoção criada na dev com janela de poucos minutos, sessão de caixa aberta no
   PDV de dev, produto bipado: conferir preço na linha, selo, divisão do
   excedente, total e cupom impresso;
3. **se a sessão de caixa, a autenticação ou o ambiente impedirem o passo 2,
   parar antes do commit e informar o bloqueio** — compilar e passar no teste não
   prova que o balcão funciona.

### O plano B do sábado (decisão 26)

O caminho de desconto por item do PDV **nunca rodou na loja**: zero descontos em
1.957 itens vendidos nos últimos 90 dias (medido em 18/09/2026). A promoção será
a primeira usuária real dele — da linha do carrinho ao rateio do cupom —, e isso
estreia num sábado.

O plano B é o método que a loja usa hoje, e continua inteiro:

1. **Encerrar a promoção** no admin ("encerrar agora");
2. **baixar o preço do produto no cadastro**, como sempre se fez.

Com a decisão 3 (tempo real), o balcão obedece em minutos, sem fechar o caixa. O
que se perde é a medição: as vendas feitas depois disso saem **sem atribuição**,
e o investimento e a nota daquela promoção ficam parciais. A tela precisa dizer
isso quando a promoção for encerrada antes do fim previsto — número parcial
apresentado como final é o tipo de mentira que ninguém percebe um ano depois.

### O que a revisão adversarial da 1a encontrou (18/09/2026)

Cinco defeitos que passaram por build, testes, typecheck e lint verdes — a razão
de a revisão existir:

| # | Defeito                                                                       | Onde estava |
| - | ------------------------------------------------------------------------------- | ----------- |
| 1 | "Dia a Dia + preço final + 0" gravava o produto a **R$ 0,00**                  | as quatro camadas só exigiam desconto positivo no Relâmpago |
| 2 | Violação da constraint virava **500** com a mensagem crua do Postgres, e o `+1s` do range divergia do serviço por uma fração de segundo | faltava o `catch` do `FinancialClosingService`; `EndNowAsync` gravava `DateTime.Now` com fração |
| 3 | Trocar o filtro na página 3 devolvia lista vazia **sem paginação para voltar**  | os setters não reiniciavam a página, como `useCoupons` faz |
| 4 | `Number("1.000")` é **1**: a meta virava investimento projetado mil vezes menor | o parser do `packages/core` entende pt-BR; o `Number` cru não |
| 5 | Preço abaixo do custo salvava com um clique, sem a confirmação que o §4.2 exige | havia só um `Alert` na coluna da direita |

Os cinco foram corrigidos antes do commit, com teste para cada um.

### Freios

1. **Script de esquema** — a parte aditiva é rotina; `CREATE EXTENSION` e
   `EXCLUDE` **não são** (ver 2.3). Rodar contra banco descartável antes do
   commit; promover para produção **para e pergunta**, com o `btree_gist`
   conferido lá.
2. **`DATABASE_VERSION` do PDV** — recria a base local; o caixa precisa de
   internet no primeiro acesso depois do deploy. Paro e mostro antes.
3. Contrato público (`PdvSnapshotDto`, `SaleItemDto`, DTOs do Storefront) atinge
   admin, PDV e loja ao mesmo tempo: rodar os testes dos três apps, não só o do
   app alterado.

---

## 13. O que NÃO entra nesta versão

- Promoção por categoria, por departamento, por tag ou "leve 3 pague 2".
- **Cliente novo ou recorrência como retorno da promoção**: a maioria das vendas
  não identifica o consumidor (`sales.customer_id` é anulável e quase sempre
  nulo), então qualquer número sobre "trouxe gente nova" seria inventado.
- Geração da imagem pela IA dentro do admin: o prompt é sugerido, a arte é feita
  fora e volta por upload.
- Legenda pronta para o grupo de WhatsApp (o prompt cobre a arte, não o texto do
  disparo).
- Total investido no período no topo da listagem — é uma soma trivial em cima do
  que a fase 2 entrega, e entra quando a primeira temporada de promoções der
  série para comparar.
- **"Queridinhos"** (pedido do dono em 18/09/2026): identificar os produtos mais
  vendidos e destacá-los no site e na loja física. É coisa **diferente** de
  promoção — fala de preferência do cliente, não de preço —, e por isso não entra
  como um terceiro `PromotionType`. Enquanto ela não existe, a isca de desconto
  zero segue usando a etiqueta "Promoção": para o cliente, o pote de R$ 2,00 na
  porta **é** preço promocional, ainda que nunca tenha sido mais caro. O risco de
  a palavra se gastar continua de pé e é assumido conscientemente.
- Etiqueta de gôndola com preço promocional — a tela de etiquetas existe e é a
  candidata natural da sequência.
- Filtro de preço da vitrine usando o preço promocional: ele continua filtrando
  pelo preço de tabela.
- Agendamento recorrente ("toda sexta das 14h às 18h"): a relâmpago é criada uma
  a uma. Repetir é copiar a anterior, e isso é uma ação de tela, não um campo.
