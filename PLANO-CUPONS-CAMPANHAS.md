# Cupons de desconto e Campanhas — especificação de implementação

> **Estado: implementado em 15/08/2026, não commitado.** Backend, banco,
> api-client, admin (cupons, campanhas, relatório comparativo), PDV, offline e
> comprovante. Verificação: `dotnet build` 0 erro/0 aviso, `dotnet test` **450
> passando, 0 falhas**; `build:types`, `typecheck:admin` e `typecheck:pdv`
> limpos, `npm test` **1074 passando**, `npm run lint` 0 erros.
>
> **O que NÃO foi verificado, e precisa ser antes de subir:**
> 1. **Os scripts SQL rodaram à mão, não pelo runner.** Eles são aplicados no
>    boot por `SqlScriptRunner`, em ordem de nome (16 → 17 → 18), e
>    `Report()` LANÇA — um erro de DDL derruba a subida e é retentado a cada
>    restart, porque script que falha não é registrado em `schema_migrations`.
>    Suba a API contra um banco de desenvolvimento e confira
>    `SELECT script_name FROM schema_migrations WHERE script_name LIKE '2026-08-1%'`.
> 2. **A atomicidade do `UPDATE` condicional do contador não tem teste** — não é
>    coberto por InMemory, que não simula concorrência. Está declarado aqui em
>    vez de fingido lá.
>
> `SwaggerTest.SwaggerDoc_ShouldGenerateWithoutExceptions` falhava desde antes
> desta feature: usava `.Start()`, que executa `Startup.Configure` e portanto o
> `EnsureDatabaseCreated()`, exigindo um Postgres vivo para gerar um documento
> que só depende do contêiner de serviços. Trocado por `.Build()`. O teste agora
> de fato gera o documento — é ele que pega rota ambígua e DTO homônimo, e nada
> mais no projeto pega.

> Contrato único desta feature. Decisões fechadas em 15/08/2026.
> **Toda camada codifica contra este arquivo.** Divergiu daqui, está errado.
> Referências `arquivo:linha` foram conferidas no código real; linhas andam,
> arquivos não.

---

## 0. Decisões fechadas

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Cupom tem tipo:** `Percentage` ou `Amount` (valor fixo em reais) | `computeDiscount` do core já aceita `"percent" \| "value"` — nada novo a calcular |
| 2 | **Rateio do cupom por item, proporcional ao valor do item** | `sale_items.coupon_discount` novo; margem por produto passa a ser real |
| 3 | **Venda pode ser zerada** por cupom, nunca negativa | pagamento vazio aceito quando total = 0 |
| 4 | **Campanha é entidade separada**, 1:N com cupom, **na v1** | 5 tabelas, editor de questionário, relatório comparativo |
| 5 | **Campanha e cupom controlados por data e hora** (`timestamp`, não `date`) | campanha de 1 dia ou atravessando meses; mata a armadilha do `.Date` |
| 6 | **Cupom e campanha vão para a base offline** do PDV | campanha é encontrada pelo código do cupom, offline inclusive |
| 7 | **Limite de uso offline é controlado pelo cache do PDV**; a loja se organiza para um caixa offline por vez | sync é tolerante e carimba `over_limit`, nunca recusa venda paga |
| 8 | **Cupom só pode ser excluído enquanto não tiver uso** | com resgate, só desativar |
| 9 | Questionário vinculado ao CPF é aceitável (decisão do produto) | respostas **continuam fora do comprovante impresso** |

---

## 1. A regra que sustenta o modelo

**`sales.discount` continua sendo o desconto TOTAL. `sales.coupon_discount` é
uma PARCELA dele, nunca uma adição.**

Se o cupom virasse abatimento separado, seria preciso editar nove pontos que
não quebram compilação nem teste quando esquecidos — `SalesPeriodTotalsService`,
`DashboardService.Breakdowns/.Monthly/.Today`, `CashRegisterSessionService`
(vai impresso na bobina), `FinancialClosingService` (2 pontos, rateio 75/25) e
as duas fórmulas duplicadas de total (`ComputedTotal()` e
`EnsureTotalMatchesItems()`) — **inflando o lucro em silêncio**.

A aritmética permite: `computeSaleTotals` (`packages/core/src/discount.ts:106`)
clampa etapa a etapa, então enquanto `global + cupom ≤ subtotal`,
`subtotal − (global + cupom)` e `subtotal − global − cupom` são o mesmo número.

**O único ponto que precisa saber da separação:**

```csharp
// PdvService.ExceedsDiscountLimit:436-453 — hoje divide o Discount inteiro
var manualDiscount = request.Discount - (request.Coupon?.DiscountAmount ?? 0m);
if (subtotal > 0 && Math.Round(manualDiscount / subtotal * 100, 2) > limit) return true;
```

Sem isso, **todo cupom de 10% passa a exigir login e senha de administrador no
balcão.** Não quebra compilação, não quebra teste, quebra a loja.

---

## 2. Rateio do cupom por item

### 2.1 O algoritmo

Proporcional ao `Subtotal` de cada item, arredondado a 2 casas, **resíduo no
item de maior `Subtotal`** (desempate pelo menor `ProductId`, para ser
determinístico e reproduzível em teste):

```
share_i    = round2(couponDiscount * subtotal_i / sum(subtotal))
residual   = couponDiscount - sum(share_i)
share_max += residual
```

O resíduo existe sempre que a divisão não fecha em centavos e é da ordem de
1–2 centavos. Jogá-lo num item **escolhido por regra** e não "no último do
laço" é o que faz o teste ser estável quando a ordem dos itens muda.

Vive em `packages/core/src/discount.ts` como `allocateCouponByItem(...)` — é
regra de negócio que os dois apps e o backend precisam calcular igual, e o
backend a reimplementa em C# com **o mesmo algoritmo e o mesmo desempate**,
coberto por um teste de paridade com os mesmos casos numéricos.

### 2.2 Onde o rateio entra nos relatórios

Três consumidores, três comportamentos diferentes hoje:

| Consumidor | Hoje | Depois |
|---|---|---|
| Cabeçalho (`Breakdowns.cs:90`, `Monthly.cs:140`) | `GrossProfit − Discount` | **não muda** — já está correto, o cupom está dentro de `Discount` |
| Por produto (`CatalogReportService.cs:141`) | `sum(SaleItem.Profit)` cru, **sem desconto nenhum** | subtrai `sum(sale_items.coupon_discount)` do produto |
| Fatias do dashboard (`Breakdowns.cs:132`, `:266`) | `allocation.Profit(...)` — ratio agregado do período aplicado a todas as fatias | numerador do ratio vira **`discount − coupon_discount`**, e cada fatia subtrai o próprio `coupon_discount` exato |

**A mudança no numerador do `GetDiscountAllocationAsync` é obrigatória.** Sem
ela o cupom é descontado duas vezes nas fatias: uma pelo rateio agregado, outra
pelo rateio exato.

`SaleItem.Profit` **não muda de semântica** (`Subtotal − TotalCost`, bruto de
desconto de cabeçalho). Mexer nele tocaria 20+ consumidores.

`SaleItemService.UpdateAsync` hoje **não copia `Discount`** ao atualizar um
item — passará a copiar `Discount` e `CouponDiscount`, senão editar um item
apaga o rateio e o `CHECK` do banco passa a mentir.

---

## 3. Banco

Postgres. Scripts em `Uaus.Data/Scripts/AAAA-MM-DD_nome.sql`, embutidos pelo
glob do `Uaus.Data.csproj`, aplicados no boot pelo `SqlScriptRunner` com
controle em `schema_migrations`. **Não há EF Migrations.** Idempotente
(`IF NOT EXISTS`), `BEGIN`/`COMMIT` próprio, `COMMENT ON COLUMN` em coluna não
óbvia, FK dentro de `DO $$ ... pg_constraint`. **Não acrescentar nada em
`SqlScriptRunner.BaselineScripts`** — a lista é fechada.

**Três scripts, não um.** `SqlScriptRunner.Report()` lança
`InvalidOperationException`: script que falha **derruba o boot da API**, e como
não é registrado em `schema_migrations`, é retentado a cada subida.

1. `2026-08-16_create_coupons.sql` — `coupons`, colunas em `sales` e `sale_items`
2. `2026-08-17_create_campaigns.sql` — `campaigns`, `campaign_questions`, `campaign_question_options`
3. `2026-08-18_create_coupon_redemptions.sql` — `coupon_redemptions`, `coupon_redemption_answers`

Convenções: `snake_case`; dinheiro `numeric(18,2)`; percentual `numeric(5,2)`;
enum `smallint` (padrão de `stock_write_offs.reason` e `sales.payment_status`);
instante `timestamp without time zone`; auditoria `created_at`, `updated_at`,
`created_by varchar(150)`, `updated_by varchar(150)`.

### 3.1 `coupons`

| coluna | tipo | regra |
|---|---|---|
| `id` | bigserial PK | |
| `code` | varchar(30) NOT NULL | `^[A-Z0-9-]{3,30}$`, normalizado no service |
| `description` | varchar(150) NULL | sai impresso no comprovante |
| `discount_type` | smallint NOT NULL | 1 = Percentage, 2 = Amount |
| `discount_value` | numeric(18,2) NOT NULL | percentual (1–100) ou reais, conforme o tipo |
| `valid_from` | timestamp NOT NULL | inclusiva |
| `valid_until` | timestamp NULL | inclusiva; nulo = sem prazo |
| `usage_limit` | int NOT NULL DEFAULT 0 | **`<= 0` = ILIMITADO**, nunca "zero usos" |
| `redeemed_count` | int NOT NULL DEFAULT 0 | cache; a verdade é o livro-razão |
| `is_active` | boolean NOT NULL DEFAULT true | |
| `campaign_id` | bigint NULL | FK `campaigns(id) ON DELETE SET NULL`; nulo = cupom sem perguntas |
| `is_deleted` | boolean NOT NULL DEFAULT false | **nome literal obrigatório** |
| auditoria | 4 colunas | |

`is_deleted` não é convenção: `BaseRepository` liga soft delete **por reflexão**
(`typeof(T).GetProperty("IsDeleted")`). Com a propriedade, toda leitura filtra
e todo `Delete` marca; sem ela, o DELETE é físico. Não há interface marcadora.

```sql
CREATE UNIQUE INDEX ux_coupons_code ON coupons (code) WHERE is_deleted = false;
CREATE INDEX ix_coupons_campaign_id ON coupons (campaign_id) WHERE campaign_id IS NOT NULL;
ALTER TABLE coupons ADD CONSTRAINT ck_coupons_code_upper CHECK (code = upper(code));
ALTER TABLE coupons ADD CONSTRAINT ck_coupons_discount_value CHECK (
  discount_value > 0 AND (discount_type <> 1 OR discount_value <= 100));
ALTER TABLE coupons ADD CONSTRAINT ck_coupons_validity CHECK (
  valid_until IS NULL OR valid_until >= valid_from);
```

Índice único **parcial** (molde de `ux_products_barcode`): sem o filtro, um
cupom excluído logicamente impediria recriar o mesmo código para sempre.

### 3.2 `sales` e `sale_items`

```sql
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS coupon_discount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS coupon_id bigint;          -- FK ON DELETE SET NULL
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS coupon_discount numeric(18,2) NOT NULL DEFAULT 0;

ALTER TABLE sales ADD CONSTRAINT ck_sales_coupon_discount
  CHECK (coupon_discount >= 0 AND coupon_discount <= discount);
```

`COMMENT ON COLUMN sales.coupon_discount`: *"Parcela de sales.discount atribuída
ao cupom. JÁ ESTÁ INCLUÍDA em discount — NÃO SOMAR. Existe para discriminar a
origem do abatimento e para excluir o cupom do limite de desconto do vendedor."*

`COMMENT ON COLUMN sale_items.coupon_discount`: *"Parte do cupom da venda rateada
neste item, proporcional ao subtotal. A soma dos itens reproduz
sales.coupon_discount. NÃO participa do subtotal — existe para a margem por
produto dos relatórios."*

Em `sales` (tabela grande, com vendas migradas) o `ADD COLUMN NOT NULL DEFAULT 0`
é instantâneo no Postgres moderno; os índices novos **não são** — criar
`CONCURRENTLY` fora do script se a tabela já estiver grande.

### 3.3 `campaigns`

`id`; `name varchar(120) NOT NULL`; `description varchar(300) NULL`;
`starts_at timestamp NOT NULL`; `ends_at timestamp NULL`;
`is_active boolean NOT NULL DEFAULT true`; `is_deleted boolean NOT NULL DEFAULT
false`; auditoria.

```sql
CREATE INDEX ix_campaigns_period ON campaigns (starts_at, ends_at) WHERE is_deleted = false;
ALTER TABLE campaigns ADD CONSTRAINT ck_campaigns_period CHECK (ends_at IS NULL OR ends_at >= starts_at);
```

`starts_at`/`ends_at` são **instantes**, não datas: a campanha pode durar um dia
ou atravessar meses, e o relatório compara com o faturamento do **mesmo
intervalo**, hora a hora.

### 3.4 `campaign_questions` e `campaign_question_options`

- `campaign_questions` — `campaign_id` (CASCADE), `label varchar(150)`,
  `sort_order int`, `is_required boolean`, `is_deleted boolean`, auditoria.
- `campaign_question_options` — `campaign_question_id` (CASCADE),
  `label varchar(80)`, `sort_order int`, `is_deleted boolean`, auditoria.

**Conjunto fechado de opções, nunca texto livre** — é o que torna o relatório
uma agregação por id em vez de um `GROUP BY` em string que quebra na primeira
correção de digitação.

Máximo de **6 perguntas** por campanha e **8 opções** por pergunta: é caixa, não
formulário de pesquisa.

### 3.5 `coupon_redemptions` — o evento imutável

| coluna | tipo | regra |
|---|---|---|
| `id` | bigserial PK | |
| `coupon_id` | bigint NOT NULL | FK `coupons(id) ON DELETE RESTRICT` |
| `sale_id` | bigint NOT NULL | FK `sales(id) ON DELETE CASCADE` |
| `campaign_id` | bigint NULL | **snapshot** da vinculação no momento da venda |
| `code_snapshot` | varchar(30) NOT NULL | |
| `description_snapshot` | varchar(150) NULL | |
| `discount_type_snapshot` | smallint NOT NULL | |
| `discount_value_snapshot` | numeric(18,2) NOT NULL | |
| `base_amount` | numeric(18,2) NOT NULL | subtotal menos desconto global |
| `discount_amount` | numeric(18,2) NOT NULL | reais efetivamente abatidos |
| `applied_at` | timestamp NOT NULL | o `occurredAt` da venda, **nunca** a hora do sync |
| `applied_by_user_id` | bigint NULL | FK `users(id) ON DELETE SET NULL` — quem aplicou |
| `over_limit` | boolean NOT NULL DEFAULT false | entrou acima do limite (só pela fila offline) |
| `definition_drift` | boolean NOT NULL DEFAULT false | snapshot não bate com a definição atual |
| `reversed_at` | timestamp NULL | cancelamento |
| `reversed_reason` | varchar(200) NULL | |
| auditoria | 4 colunas | |

```sql
CREATE UNIQUE INDEX ux_coupon_redemptions_sale_id ON coupon_redemptions (sale_id);
CREATE INDEX ix_coupon_redemptions_coupon_id ON coupon_redemptions (coupon_id);
CREATE INDEX ix_coupon_redemptions_campaign_applied
  ON coupon_redemptions (campaign_id, applied_at)
  WHERE reversed_at IS NULL AND campaign_id IS NOT NULL;
ALTER TABLE coupon_redemptions ADD CONSTRAINT ck_coupon_redemptions_amounts
  CHECK (base_amount >= 0 AND discount_amount >= 0 AND discount_amount <= base_amount);
```

`ux_coupon_redemptions_sale_id` **é** a regra "não cumulativo, um cupom por
venda": invariante estrutural que nenhum caminho de escrita novo consegue
furar, em vez de convenção que o próximo endpoint esquece.

`applied_by_user_id` tem precedente exato em `sales.discount_authorized_by_user_id`.
Sem ele, funcionário aplicando cupom nas próprias compras é indetectável.

### 3.6 `coupon_redemption_answers`

`coupon_redemption_id` (CASCADE); `campaign_question_id` (**RESTRICT**);
`campaign_question_option_id` (**RESTRICT**); `question_label_snapshot
varchar(150)`; `option_label_snapshot varchar(80)`; auditoria.

```sql
CREATE UNIQUE INDEX ux_coupon_redemption_answers_question
  ON coupon_redemption_answers (coupon_redemption_id, campaign_question_id);
CREATE INDEX ix_coupon_redemption_answers_agg
  ON coupon_redemption_answers (campaign_question_id, campaign_question_option_id);
```

**FK para agregar, snapshot para exibir.** O `GROUP BY` roda sobre ids estáveis
e indexados; o rótulo exibido no histórico é o que o operador de fato leu na
tela. Remover pergunta é `is_deleted = true`; o RESTRICT torna o hard delete
fisicamente impossível.

---

## 4. Contador de uso — consumo atômico

```csharp
Task<bool> TryConsumeAsync(long couponId, bool enforceLimit);
Task ReleaseAsync(long couponId);
```

```sql
UPDATE coupons SET redeemed_count = redeemed_count + 1
 WHERE id = {couponId} AND is_deleted = false AND is_active = true
   AND ({enforceLimit} = false OR usage_limit <= 0 OR redeemed_count < usage_limit)

UPDATE coupons SET redeemed_count = redeemed_count - 1
 WHERE id = {couponId} AND redeemed_count > 0
```

Uma instrução, um lock de linha, zero janela TOCTOU — resolve N caixas sem
`rowversion`, que não existe neste banco.

**Não pode passar pelo `BaseRepository`:** o `UpdateAsync` dele faz
`DbSet.Update(entity)` sobre leitura `AsNoTracking()`, reescrevendo todas as
colunas e perdendo incremento concorrente por construção.
`ExecuteSqlInterpolatedAsync` participa da transação corrente do `UnitOfWork`,
então venda que falha devolve o contador pelo rollback.

**Ordem de lock, obrigatória em todos os caminhos:** a transação da venda já faz
UPDATE em `stock_lots` (FIFO). Consumir o cupom **sempre depois** dos lotes.
Ordens diferentes entre caminhos formam ciclo, e deadlock do Postgres vira 500
sem mensagem útil no balcão, com o operador reenviando.

---

## 5. Backend — contratos

Rotas minúsculas (`LowercaseUrls = true`). `[Authorize(Role.Admin)]` em **cada
action**, nunca na classe — padrão dos 138 usos existentes. Molde
`FixedCostsController` (PUT com id na rota, um único `SaveXRequest`), não
`CustomersController`.

### 5.1 Uma exceção de negócio que não vira log de erro

`ExceptionMiddleware.LogErrorAsync` grava `LogType.Error` com stack trace e a
autenticação serializada **antes** de responder, para **toda** exceção —
inclusive `ValidationException` (400) e `NotFoundException` (404).

Um panfleto vencido em circulação geraria centenas de linhas de erro por dia,
afogando erros reais, inflando `logs` e vazando identidade do operador em cada
linha.

**`ExpectedBusinessException : BusinessException`** — mesmo 400, mesma mensagem,
sem log. O middleware ganha uma guarda antes de `LogErrorAsync`. Toda recusa de
cupom ("expirado", "esgotado", "inativo", "não encontrado") usa essa exceção.
**É pré-requisito de tudo que responde recusa de cupom.**

### 5.2 Cupons — `CouponsController`

```
GET    /coupons?search=&campaignId=&onlyActive=&page=1&size=20  → PagedResult<CouponDto>
GET    /coupons/{id:long}                                       → CouponDto
POST   /coupons          SaveCouponRequest                      → 201 CreatedAtAction
PUT    /coupons/{id:long} SaveCouponRequest (request.Id = id)   → 200 CouponDto
DELETE /coupons/{id:long}                                       → 204
```

`SaveCouponRequest : IRequest`, `EnsureIsValid()` chamado pelo **service** na
primeira linha. `UsageLimit` negativo normalizado para 0 — uma representação só.
Unicidade do código conferida no service, para virar 400 legível em vez de
`DbUpdateException` 500.

**Regras de edição, impostas no service:**

| edição | vendas passadas | permitido |
|---|---|---|
| tipo, valor, descrição, validade, ativo, campanha | nenhum (snapshots) | sim |
| `usage_limit` abaixo de `redeemed_count` | nenhum; o UPDATE condicional para de aceitar | sim — é o "encerrar agora" |
| `code` com `redeemed_count > 0` | — | **não** |
| **excluir com qualquer resgate** | — | **não** — `"Um cupom que já foi utilizado não pode ser excluído. Desative-o."` |

Trocar o código depois do primeiro resgate mata todo panfleto em circulação.
Alterar `valid_until` de cupom já resgatado **pede confirmação na tela** com o
número de resgates, e grava `LogType.CouponDefinitionChanged`.

### 5.3 Campanhas — `CampaignsController`

```
GET    /campaigns?search=&activeAt=&page=&size=   → PagedResult<CampaignDto>
GET    /campaigns/{id:long}                       → CampaignDto (com questions[] e options[])
POST   /campaigns         SaveCampaignRequest     → 201
PUT    /campaigns/{id:long} SaveCampaignRequest   → 200
DELETE /campaigns/{id:long}                       → 204 (soft)
GET    /campaigns/{id:long}/report                → CampaignReportDto
GET    /campaigns/comparison?ids=1,2,3&from=&to=  → List<CampaignComparisonRowDto>
```

`SaveCampaignRequest` traz `Questions[] { Id?, Label, SortOrder, IsRequired,
Options[] { Id?, Label, SortOrder } }`. O service faz **upsert por Id** dentro
de `ExecuteInTransactionAsync`: com Id atualiza, sem Id cria, ausente da lista
vira `is_deleted = true`. **Nunca `Adapt` por cima da entidade inteira** —
zeraria `CreatedAt`/`CreatedBy`. **Nunca hard delete** de pergunta ou opção.

`EnsureIsValid()`: nome obrigatório; `EndsAt == null || EndsAt >= StartsAt`;
toda pergunta com ≥2 opções ativas; rótulos distintos dentro da pergunta;
≤6 perguntas; ≤8 opções por pergunta.

### 5.4 Relatório de campanha

`CampaignReportService(UausDbContext)` — fora do `BaseRepository`, que tem
ordenação `Id desc` chumbada e não agrega. Precedente: `DashboardService`,
`InventoryCountService`.

**Atenção:** acesso direto ao `DbSet` **não aplica o filtro de soft delete** —
`!x.IsDeleted` tem que ser escrito à mão nas consultas de `campaigns`/`coupons`.

**Toda agregação filtra `PaymentStatus != Cancelled`**, como já fazem seis
pontos do repo. Sem isso o relatório da campanha nunca fecha com o Dashboard e
ninguém descobre por quê.

```jsonc
// CampaignReportDto
{
  "campaignId": 3, "campaignName": "Setembro 2026",
  "startsAt": "...", "endsAt": "...",
  "redemptions": 143, "reversed": 4, "overLimit": 0, "definitionDrift": 0,
  "campaign": { "salesCount": 143, "revenue": 18420.50, "profit": 5210.10,
                "couponDiscount": 1842.05, "averageTicket": 128.81, "marginPercentage": 28.3 },
  // mesmo intervalo [startsAt, endsAt], TODAS as vendas da loja — o denominador
  "period":   { "salesCount": 980, "revenue": 121300.00, "profit": 38900.00,
                "averageTicket": 123.77, "marginPercentage": 32.1 },
  "share":    { "salesPercentage": 14.6, "revenuePercentage": 15.2, "profitPercentage": 13.4 },
  "daily":    [ { "day": "2026-09-01", "redemptions": 12, "campaignRevenue": 1520.00, "periodRevenue": 9800.00 } ],
  "coupons":  [ { "couponId": 12, "code": "10OFFSET26", "redemptions": 143, "revenue": 18420.50, "couponDiscount": 1842.05 } ],
  "questions":[ { "questionId": 7, "label": "Sexo", "answered": 140,
                  "options": [ { "optionId": 21, "label": "F", "count": 96, "percentage": 68.6,
                                 "revenue": 12800.00, "averageTicket": 133.33 } ] } ]
}
```

`period` é o pedido explícito: **comparar o faturamento e o lucro da campanha
com o faturamento e o lucro totais do mesmo intervalo**. `share` é a leitura que
responde "quanto da loja essa campanha moveu".

`profit` da campanha usa o rateio da §2: `sum(sale_items.profit) −
sum(sale_items.coupon_discount)` das vendas com resgate não estornado, menos a
parcela manual do desconto de cabeçalho.

`CampaignComparisonRowDto` é a mesma linha achatada, uma por campanha, para o
gráfico comparativo.

### 5.5 PDV — consulta do cupom

```
GET /pdv/coupons/{code}   [Authorize(Roles = "Admin,Seller")]
```

`CouponLookupDto`: `couponId`, `code`, `description`, `discountType`,
`discountValue`, `validUntil`, `remainingUses` (**`null` = ilimitado**),
`requiresAnswers`, `questions[]`.

Três regras não óbvias:

1. **Nunca diz de onde as perguntas vieram.** Sem `campaignId` no DTO, no
   payload da venda ou na fila offline. O servidor faz o snapshot da campanha na
   gravação. Isso mantém a camada mais cara de mexer — offline, fila,
   idempotência, comprovante — estável a qualquer evolução do modelo.
2. **Não reserva nada.** O gate real é o UPDATE condicional na gravação.
   Escrever isso em maiúsculas no XMLDoc.
3. **Não devolve valor em reais.** O abatimento sai de `computeDiscount` do
   `@workspace/core`; o servidor **audita** na gravação, como já faz com o total.

`questions` vem vazio e `requiresAnswers = false` quando o cupom não tem
campanha, quando a campanha está inativa, ou quando o instante corrente está
fora de `[starts_at, ends_at]`.

> **Vigência do CUPOM decide dinheiro. Vigência da CAMPANHA decide apenas se o
> questionário é apresentado.** Cupom válido + campanha encerrada = desconto
> aplicado, nenhuma pergunta, resgate ainda atribuído à campanha. Sem essa
> regra, o cliente lê "válido até 30/09" no panfleto e o sistema recusa porque a
> campanha fechou dia 15.

Recusas usam `ExpectedBusinessException` com mensagem pronta para o balcão:
`"Cupom expirado em 30/09/2026 às 23:59!"`, `"Cupom inativo!"`, `"Cupom
esgotado!"`.

### 5.6 PDV — gravação

`RegisterPdvSaleRequest` ganha **um bloco**, não campos soltos:

```csharp
/// <summary>Cupom aplicado na venda. Um por venda — não cumulativo.</summary>
public RegisterPdvSaleCouponRequest? Coupon { get; set; }

public class RegisterPdvSaleCouponRequest
{
    public long CouponId { get; set; }
    public string Code { get; set; } = string.Empty;
    public CouponDiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal BaseAmount { get; set; }       // subtotal - desconto global
    public decimal DiscountAmount { get; set; }   // JÁ incluído em Discount
    public List<RegisterPdvSaleCouponAnswerRequest> Answers { get; set; } = [];
}
```

`ComputedTotal()` e `EnsureTotalMatchesItems()` **não mudam nenhuma linha** —
`Discount` já é o desconto total. É a economia central da §1.

`CouponRedemptionService.ApplyAsync(saleId, request, mode)` roda **dentro** da
transação da venda e **depois** do `FindByClientReferenceAsync` (gate de
idempotência), e é quem grava o rateio em `sale_items.coupon_discount`:

| origem | modo | esgotado | definição divergente |
|---|---|---|---|
| `POST /Pdv/sales`, `PUT /Pdv/sales/{id}` | **Strict** | recusa a venda | recalcula, tolerância `0.01m` |
| `POST /Pdv/sales/sync` | **Tolerant** | grava, `over_limit = true` | grava `definition_drift = true`, sem recalcular |
| `POST /Sales`, `POST /Sales/complete` | — | **sem cupom na v1** | — |

> **O backend nunca recusa uma venda por causa do cupom depois que o dinheiro
> mudou de mãos.** Estoque recusado devolve saldo e o prejuízo é de inventário;
> cupom recusado no sync não tem compensação — o cliente já pagou o valor com
> desconto e a transação do adquirente já passou. Limite de cupom é **orçamento
> de marketing**, não restrição de inventário.

Vigência conferida contra `request.NormalizedOccurredAt() ?? DateTime.Now`:
venda das 23h50 do último dia válido, sincronizada às 8h do dia seguinte, passa.

O admin fica fora da v1 de propósito: `POST /Sales` aceita `Total`/`Discount`
arbitrários sem conferir contra itens, e `CreateCompleteSaleRequest` não tem
`ClientReference` (duplo clique queimaria dois usos). **Bloquear explicitamente**
`coupon_discount` nesses caminhos — o Mapster mapeia por convenção de nome e já
mordeu antes.

**Sync mantém três desfechos e só três** (`Created`, `Duplicated`, `Rejected`):
`readSyncStatus` trata status desconhecido como recusa total e o PDV devolveria
estoque de uma venda que o servidor gravou.

### 5.7 Venda zerada

Cupom pode zerar a venda; negativa, nunca (`computeSaleTotals` já clampa em 0).

- `CreateCompleteSaleRequest.EnsureIsValid()` e o equivalente do PDV passam a
  aceitar **lista de pagamentos vazia quando `ComputedTotal() == 0`**.
  `SalePaymentRequest.EnsureListIsValid` já retorna cedo em lista vazia.
- O `CheckoutDialog` do PDV pula a etapa de pagamento quando o total é 0 e
  imprime `TOTAL R$ 0,00` sem troco.

### 5.8 Cancelamento e reedição

`SaleService.CancelAsync` chama `ReverseBySaleAsync(id, reason)` **e passa a
rodar dentro de `ExecuteInTransactionAsync`** — hoje não roda, e um terceiro
efeito parcial (estoque devolvido / cupom estornado / status não gravado)
deixaria o cupom devolvido numa venda que continua `Paid`.

Estorno auto-idempotente: `UPDATE ... WHERE sale_id = {id} AND reversed_at IS
NULL`, e `ReleaseAsync` só se `rowsAffected == 1`.

**`DELETE /Sales/{id}` passa em venda cancelada** (só recusa se tiver itens) e
o `ON DELETE CASCADE` evaporaria o resgate sem decrementar o contador. O service
passa a **recusar o delete quando existe resgate**, com a mesma mensagem do §5.2.

Reedição (`PUT /Pdv/sales/{id}`): trocar de cupom é recusado (`"Para trocar o
cupom, cancele a venda e registre outra!"`); mesmo cupom recalcula
`base_amount`, `discount_amount` e o rateio; remover o cupom estorna.
`code_snapshot` e `discount_value_snapshot` **nunca** são reescritos.

`GET /coupons/{id}/reconcile` (Admin) confere `redeemed_count == count(resgates
não estornados)`. Sem ele, divergência só se corrige com SQL manual em produção.

### 5.9 Logs de negócio

`LogType` ganha `CouponRedeemed`, `CouponReversed`, `CouponLimitOverridden`,
`CouponDefinitionChanged`. O mecanismo já existe (`ManualStockAdjustment`,
`FinancialClosingDeleted`) com tela em `/sistema/logs`. Sem isso, a trilha de um
cupom estourado são dois booleanos numa tabela, sem tela e sem busca por período.

---

## 6. Frontend

### 6.1 `packages/core`

`computeDiscount` e `computeSaleTotals` **já resolvem** a conta — `couponDiscount`
é parâmetro de primeira classe desde `discount.ts:106`, com ordem item → global
→ cupom e arredondamento por etapa. Acrescentar:

- `allocateCouponByItem(items, couponDiscount)` (§2.1), com JSDoc explicando o
  resíduo.
- Testes de meio-centavo (2,665 / 1,005 / 2,675) **contra o resultado do C#**:
  `round2` do core é half-up com epsilon; `Math.Round(x, 2)` sobre `decimal` no
  C# é banker's. A tolerância de `0.01m` absorve, mas **prevalece o valor do
  cliente** — foi o impresso no comprovante que ele levou.

### 6.2 `packages/api-client`

`src/hooks/coupons.ts` e `src/hooks/campaigns.ts`, DTOs em `src/models.ts`,
export no barrel. Enum no padrão `EnumValue` + tabela de códigos (como
`USER_ROLE`), lido com `enumCode`. Chave de cache devolvendo **só o prefixo**:

```ts
export const getGetCouponsQueryKey = (): QueryKey => ["Coupons"];
// na query: queryKey: [...getGetCouponsQueryKey(), params ?? {}]
```

`src/query-keys.test.ts` trava a regra sozinho. Mutações como funções puras; o
`useMutation` fica no hook da feature. `npm run build:types` antes de qualquer
typecheck de app.

Campos de instante viajam como `DateTime` serializado
(`"2026-09-30T23:59:59"`), **nunca** como `"2026-09-30"` — `new Date("2026-09-30")`
parseia como UTC e volta um dia no Brasil (armadilha 2 do CLAUDE.md).

### 6.3 `apps/admin`

`src/features/coupons/` e `src/features/campaigns/` no molde de `fixed-costs`
(seis artefatos, JSDoc em português, zero `any`, README com regra de negócio).
Rota, menu e papel `Admin` na fonte única; `routes.test.ts` cobrindo as rotas
novas como restritas.

**Teste de hook no molde de `partners`**, não no de `fixed-costs`: este último
redefine a chave de cache dentro do mock, e um teste de invalidação que valida a
chave inventada no mock não testa nada.

- **Cupons:** tabela com código, tipo, valor, vigência, usos/limite, ativo,
  campanha. Excluir só sem uso (o botão vira "Desativar" com resgates). Badge de
  usos restantes com aviso quando há fila offline pendente.
  `usageLimit` vazio → `parseAmountOrNull`, nunca `parseAmount` (que devolve
  `NaN`). Campo de fim de vigência default 23:59:59 do dia escolhido.
- **Campanhas:** período com data e hora, cupons vinculados, editor de
  questionário (arrastar ordem, ≥2 opções por pergunta, remoção lógica).
- **Relatório:** cards de campanha vs período, gráfico de barras comparando
  campanhas (faturamento, lucro, ticket médio, % da loja), série diária
  campanha × período, e distribuição de respostas por pergunta. Recharts, que já
  é dependência. Exportação CSV do comparativo.

### 6.4 `apps/pdv`

| arquivo | o que muda |
|---|---|
| `features/pdv/hooks/use-coupon.ts` (novo) | consulta, aplica, limpa; guarda **só** `{ couponId, code, description, discountType, discountValue, answers }` |
| `features/pdv/components/coupon-dialog.tsx` (novo) | código + perguntas numa tela só |
| `stores/use-pdv-store.ts` | passa `couponDiscount` a `computeSaleTotals` |
| `features/pdv/lib/build-sale-payload.ts` | acrescenta o bloco `coupon` |
| `features/pdv/lib/build-sale-receipt.ts` | acrescenta a linha do comprovante |
| `offline/` | cupons e campanhas no snapshot |

**O valor em reais nunca é congelado no store.** O cupom pode ser percentual e o
carrinho muda: bipar um item depois de aplicar tem que reajustar o abatimento.
Guardar o valor calculado deixa o desconto estagnado — é o teste que mata o
desenho errado.

Fluxo do caixa: uma tecla abre o diálogo; o código é digitado ou lido pelo
leitor do panfleto; as perguntas aparecem como botões grandes navegáveis por
número e seta (não `select`); o foco volta à busca ao fechar.

### 6.5 Offline

**`DATABASE_VERSION` fica em 2.** Cupons e campanhas vão para a store `meta`,
que está em `PRESERVED_STORES`. Store nova exigiria versão 3, e a migração
apaga `products`, `paymentMethods` e `customers` de **todo caixa da rede** —
armadilha 4 do CLAUDE.md, paga por nada.

Sobe apenas o `snapshotSchemaVersion` (formato do DTO). `PdvSnapshotDto` ganha
`coupons[]` com a definição completa **e as perguntas já resolvidas**, para que
a campanha seja encontrada pelo código do cupom sem rede.

`clearLocalCatalog` **tem que remover a chave de cupons explicitamente** — ela
não é apagada por `clearAll(CATALOG_STORES)`, e esquecer deixa dado de campanha
do operador anterior sobrevivendo ao logout.

O limite offline é conferido contra `remainingAtSnapshot` menos os resgates já
enfileirados localmente. O nome do campo é escolhido para que ninguém o leia
como saldo corrente. Estouro é aceito e carimbado no sync (§5.6).

Sanidade de relógio: se o relógio local for anterior ao `snapshotGeneratedAt`
(hora do servidor, já gravada no `installSnapshot`), recusar a validação offline.
Pega relógio atrasado — cenário de queda de energia com RTC gasto. Relógio
adiantado permanece indetectável sem servidor, e isso fica escrito.

### 6.6 Comprovante impresso

Linha entre o desconto e o `TOTAL`, com **rótulo e valor**:

```
DESCONTO CUPOM 10OFFSET26 (10%)          - 12,34
DESCONTO CUPOM BEMVINDO (R$ 20,00)       - 20,00
```

- O gate do Subtotal em `render.ts` passa de `discount > 0` para
  `discount > 0 || coupon != null` — venda só com cupom não pode imprimir
  abatimento sem Subtotal acima.
- `escapeHtml` no código **e** na descrição; `row()` interpola cru, quem escapa
  é o chamador.
- `SaleDto` ganha `couponCode`, `couponDescription`, `couponDiscountType`,
  `couponDiscountValue`, `couponDiscount` — senão a **segunda via sai diferente
  da primeira**, o que é pior que não reimprimir.
- **As respostas do questionário nunca são impressas.**
- O relatório de caixa (`sales-report.ts`) fecha porque `summary.discounts` soma
  `sales.discount`, que já inclui o cupom — consequência da §1.

---

## 7. Testes obrigatórios

**Request (unitário puro):** valor `0` / `100` / `100.01` para `Percentage`;
valor alto para `Amount`; `UsageLimit` negativo normalizado, **provando que 0 é
ilimitado e não "zero usos"**; `CouponDiscount > Discount` recusado;
`ComputedTotal()` e `EnsureTotalMatchesItems()` dando o mesmo número para a
mesma entrada com cupom — única defesa contra as duas fórmulas divergirem;
pagamento vazio aceito **só** quando o total é 0.

**Service (InMemory + repositório real, `ChangeTracker.Clear()` após semear):**
reenvio da mesma `ClientReference` **não queima segundo uso**; cupom vencido
pela data da **venda**, não do sync; **venda com cupom de Seller não exige senha
de admin** (o teste que protege o balcão); cupom + desconto manual acima do
limite exige senha e confere só o manual; excluir cupom com resgate é recusado;
cancelar duas vezes (estorno idempotente); `DELETE /Sales` recusado com resgate;
relatório de campanha **excluindo vendas canceladas**; soma do rateio por item
reproduzindo `sales.coupon_discount` **exatamente**.

**`packages/core`:** base do percentual = subtotal menos desconto global;
arredondamento por etapa (tela = payload = impresso); rateio com resíduo
determinístico; meio-centavo contra o C#.

**PDV:** cupom re-derivado ao bipar item novo; `total` do payload ==
`getTotal()` do store (bug que já aconteceu com o desconto global); venda antiga
da fila **sem** o campo sobe com `?? null` e não quebra; `holdSale`/`resume`
preservam o cupom, `finishSale`/`cancelSale` o limpam; cupom encontrado offline
pelo código, com perguntas.

**`packages/receipt`:** venda só com cupom imprime Subtotal; ordem da linha antes
de `TOTAL`; venda sem abatimento continua sem a palavra "Desconto"; código com
`<` e `"` escapado; reimpressão produz a mesma linha da primeira via.

**Admin:** payload exato enviado; `usageLimit` vazio → 0 e não `NaN`; recuo de
página ao excluir o último item; editor de perguntas barra pergunta com <2
opções; `routes.test.ts` com as rotas novas.

Concorrência do UPDATE condicional não é cobrível com InMemory. Ou testa contra
Postgres, ou **declara no README que a atomicidade não tem teste** — pior é
fingir que tem.

---

## 8. Verificação

```bash
dotnet build && dotnet test
```

```bash
npm run build:types && npm run typecheck:admin && npm run typecheck:pdv && npm test && npm run lint
```

---

## 9. Fora de escopo, declarado

- **Cupom cumulativo** — barrado por `ux_coupon_redemptions_sale_id`. Permitir
  depois é remover um índice e decidir a ordem de aplicação.
- **Limite por CPF** — `sales.customer_document` existe e o livro-razão é onde
  isso ancora, mas não agora.
- **Cupom pelo admin** (`POST /Sales`, `/Sales/complete`) — §5.6.
- **Papel de marketing** — só existem `Admin` e `Seller`; quem lê relatório de
  campanha precisa de Admin total. Dívida consciente.
- **NFC-e** — o rateio por item da §2 é exatamente o `vDesc` por item de que ela
  precisa, então o dado passa a existir a partir daqui.
