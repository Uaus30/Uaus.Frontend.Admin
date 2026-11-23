# Financeiro — saldo do mês, faixa de compras, aportes e painel

> **Estado: plano revisto em 23/11/2026 (terceira versão do dia: o dono
> respondeu as decisões 13 e 14), nada implementado.** Entrega única: tudo é feito
> e testado na `dev`, e sobe para produção de uma vez (seção 8). Contrato desta
> feature: toda camada codifica contra este arquivo. Divergiu daqui, corrija aqui
> primeiro.

A loja compra com o dinheiro do mês corrente e não quer controle diário de
caixa. O controle é **mensal**: o fechamento de cada mês confirma o saldo que
fica para a loja, e esse saldo abre o mês seguinte. Durante o mês, a **faixa de
compras** (verde, amarelo, vermelho) diz, na hora de comprar, se o mês aguenta a
compra. Os **aportes** dos sócios entram como saldo disponível. Um **painel**
junta tudo.

---

## 0. Decisões

### 0.1 Fechadas com o dono (23/11/2026)

| #   | Decisão                                                                                                                                      | Consequência                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **Controle mensal, nada diário.** Sem abertura e fechamento de caixa; o saldo é conferido uma vez por mês, no fechamento                    | o caixa do PDV continua como está (nunca foi usado: zero sessões)                                                 |
| 2   | **O fechamento do mês confirma o saldo que fica para a loja**, e esse saldo é o **saldo inicial do mês seguinte**                           | o fechamento ganha o bloco de caixa e o campo "saldo confirmado" (seção 3)                                        |
| 3   | O fechamento é feito **no começo do mês seguinte**, e o financeiro do mês corrente **fica aguardando** o do mês anterior                     | até lá, a faixa do mês corrente aparece como **provisória**, sem saldo inicial (seção 2)                          |
| 4   | **Verde**: compras pagas no mês ≤ custo das vendas do mês + saldo disponível                                                                 | comprar o que se vendeu, a custo, repõe a prateleira                                                              |
| 5   | **Amarelo**: passou do verde, mas as vendas do mês + saldo disponível, depois das compras, ainda cobrem os custos fixos do mês               | alerta: o estoque cresce, mas o mês se paga                                                                      |
| 6   | **Vermelho**: depois das compras, não sobra para cobrir nem os custos fixos                                                                  | o mês vai precisar de dinheiro de fora                                                                           |
| 7   | **O verde é testado primeiro** e vale sozinho                                                                                                | no começo do mês as vendas ainda não cobrem os fixos; sem isso, comprar dentro do custo vendido daria vermelho     |
| 8   | **Saldo disponível = saldo inicial + aportes do mês.** O aporte entra como saldo e pode levar o mês de amarelo ou vermelho para verde; o saldo inicial vale do mesmo jeito | é o que tira do vermelho o começo do mês (seção 1.2) |
| 9   | **Aporte não é dívida** da loja com o sócio                                                                                                  | sem saldo devedor nem devolução; o painel mostra só quanto cada sócio já aportou                                   |
| 10  | **Baixas (perda, doação, consumo, inventário) entram no fechamento e no painel**, como despesa a custo                                       | o lucro líquido e o rateio passam a descontá-las (seção 3)                                                        |
| 11  | **Os descontos concedidos entram, todos, no fechamento e no painel**: no item, na venda, de promoção e de cupom                              | hoje o fechamento mostra só o desconto dado na venda (seção 1.3)                                                  |
| 12  | **Entrega única**: tudo na `dev` e, depois, tudo junto para produção                                                                         | seção 8                                                                                                          |
| 13  | **Compra que leva o mês ao vermelho só pede confirmação**, não é bloqueada (por enquanto)                                                    | o mesmo padrão da margem negativa: o dono decide, mas a tela pergunta antes (seção 7.3)                          |
| 14  | **Os custos fixos ficam como estão.** A loja é MEI, sem contador e sem controle fiscal rígido por enquanto                                  | a linha do vermelho usa o cadastro atual (R$ 865/mês); o pagamento dos sócios é a retirada no fechamento (seção 3.2), não custo fixo. Se o boleto mensal do MEI sair do caixa da loja, ele entra como mais um custo fixo, pela tela |

A decisão 8 tem uma leitura minha que o dono precisa confirmar: o saldo inicial
conta como o aporte, inclusive na linha do verde. Com saldo, o mês pode comprar
mais que o custo vendido e continuar verde. O texto "verde com saldo" e o cartão
de estoque a custo do painel existem para isso não passar despercebido.

### 0.2 Em aberto, com a recomendação

| #   | Pergunta                                                                                       | Recomendação                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| C   | Quem tem login vê o painel, os aportes e as retiradas de cada sócio                            | É a regra atual: não existe perfil de usuário desde 03/10/2026. Se não servir, controle por perfil é feature nova.                     |
| D   | As **sobras** de estoque (entrada de ajuste manual) entram no resultado?                       | **Sim, somando.** Senão a contagem que acha o produto em outra prateleira vira prejuízo que não houve (outubro: R$ 244 de sobra).       |
| E   | O Painel substitui o Resumo Financeiro?                                                        | **Não.** O Painel abre o grupo Financeiro; o Resumo continua como o resultado de um período livre, mas com a mesma conta do fechamento. |
| F   | Retirada maior que o lucro do mês e saldo confirmado negativo                                  | **Aceitos, com aviso.** O fechamento registra o que aconteceu; ele não impede.                                                         |

---

## 1. Os números que calibram (produção, só leitura, 23/11/2026)

### 1.1 A faixa sem saldo inicial, de setembro a novembro

| Mês           | Vendas (V) | Custo das vendas (C) | Compras pagas (K) | Faixa no fim do mês                                                  | Dias (seg–sáb)                                   |
| ------------- | ---------- | -------------------- | ----------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| setembro      | R$ 6.967   | R$ 4.173             | R$ 8.803          | **vermelho**: R$ 2.701 além da linha                                 | verde de 1 a 8; vermelho de 9 a 30               |
| outubro       | R$ 12.204  | R$ 7.309             | R$ 7.612          | **amarelo**: R$ 303 acima do custo; folga de R$ 3.727 até o vermelho | verde de 1 a 21 e no 30; amarelo de 22 a 29 e 31 |
| novembro (23) | R$ 5.358   | R$ 3.220             | R$ 2.782          | **verde**: dá para comprar mais R$ 439 no verde                      | vermelho de 2 a 13; amarelo de 14 a 18; verde de 19 a 23 |

Setembro virou vermelho num dia só: a compra de R$ 2.183 em 09/09. É o momento
exato em que a tela de Compras precisa avisar (seção 7.3).

### 1.2 O saldo inicial tira o começo do mês do vermelho

Em novembro, R$ 991 de compras nos dias 1 e 2 (o dia 2 foi feriado, sem venda)
deixaram o mês vermelho até o dia 13, sem saldo inicial. Outubro gerou R$ 3.727
de caixa (vendas − compras − fixos). Se, depois de uma retirada de R$ 2.000,
tivessem ficado R$ 1.727 para a loja, **novembro teria ficado verde todos os
dias**: a compra do dia 2 cabe no saldo (R$ 991 ≤ R$ 0 + R$ 1.727), e o mês nunca
passa da linha verde.

### 1.3 Descontos: o fechamento mostra menos da metade

| Mês           | No item (promoção) | Na venda (cupom) | Total concedido | % das vendas brutas | O que o fechamento mostra |
| ------------- | ------------------ | ---------------- | --------------- | ------------------- | ------------------------- |
| setembro      | R$ 23 (R$ 16)      | R$ 109 (R$ 0)    | R$ 132          | 1,9%                | R$ 109                    |
| outubro       | R$ 236 (R$ 181)    | R$ 214 (R$ 0)    | R$ 450          | 3,6%                | R$ 214                    |
| novembro (23) | R$ 55 (R$ 55)      | R$ 153 (R$ 0)    | R$ 207          | 3,7%                | —                         |

- O lucro já está certo: o desconto no item já sai do preço unitário, e o da
  venda sai do lucro. O que falta é **mostrar**: o "Descontos" do fechamento é só
  o da venda (`sales.discount`).
- O desconto no item é **por unidade** (`sale_items.discount`, coluna de
  auditoria): o total da linha é `discount × quantity`. A promoção e o cupom são
  **parcelas**, nunca somas (`promotion_discount` dentro de `discount`,
  `coupon_discount` dentro de `sales.discount`).
- Antes de setembro não há desconto registrado: as vendas vieram do Mais PDV.

### 1.4 Baixas e sobras

| Mês      | Baixas a custo | Sobras (ajuste manual de entrada) | Efeito no lucro líquido |
| -------- | -------------- | --------------------------------- | ----------------------- |
| setembro | R$ 235         | R$ 75                             | −R$ 160                 |
| outubro  | R$ 175         | R$ 244                            | +R$ 69                  |

### 1.5 De onde vem o dinheiro das compras

- Desde setembro, **93% do valor** das entradas de compra veio de uma compra da
  tela de Compras. As entradas diretas somam R$ 1.224 em setembro, R$ 71 em
  outubro e R$ 30 em novembro.
- A entrada chega em média **4,1 dias depois** da data da compra. O dinheiro sai
  na data da compra, e é ela que a régua usa.

---

## 2. A faixa de compras

Para o mês M, até o momento da consulta:

| Símbolo | O quê                                                                                         |
| ------- | --------------------------------------------------------------------------------------------- |
| S       | saldo inicial: o saldo confirmado no fechamento de M−1 (zero enquanto M−1 não for fechado)   |
| A       | aportes com data no mês                                                                       |
| V       | vendas líquidas do mês (não canceladas, já sem os descontos)                                  |
| C       | custo das vendas do mês (pelos lotes consumidos)                                              |
| K       | compras pagas no mês (seção 4)                                                                |
| F       | custos fixos vigentes no mês, pelo valor mensal cheio                                         |

```
saldo disponível = S + A
linha verde      = C + S + A
linha vermelha   = V + S + A − F

faixa = verde     se K ≤ linha verde
        amarelo   se K ≤ linha vermelha
        vermelho  nos demais casos
```

A ordem dos testes **é** a regra (decisão 7).

**Provisória.** Enquanto M−1 não foi fechado no fluxo novo, S fica fora (zero) e
a faixa aparece como provisória, com o aviso "Feche outubro para começar
novembro com o saldo" e o botão que leva ao fechamento.

O que a tela mostra, em reais:

- **Pode comprar no verde:** linha verde − K, quando positivo.
- **Até o vermelho:** linha vermelha − K, quando positivo.
- **Fora do verde:** "volta ao verde com R$ X de aporte" (X = K − linha verde).
- **"Com saldo" ou "com aporte":** quando a faixa só é aquela por causa de S + A
  (K passou de C), o texto diz. O estoque cresce do mesmo jeito.

Bordas (todas com teste, seção 9):

- Mês sem venda e sem compra: verde.
- K igual à linha verde: verde. Igual à linha vermelha: amarelo.
- Compra **Pendente** não conta: é "preciso comprar isto". Ela aparece como
  **planejada** e simula a faixa ("se fizer as pendentes, vai para amarelo").
- Compra com data em mês já fechado: conta no mês da data, e a tela avisa que ela
  não muda o fechamento (o dinheiro dela aparece como diferença de saldo).
- Compra paga a prazo (cartão parcelado, boleto) conta inteira na data da compra.
- Baixa e desconto não mexem na faixa: a baixa não tira dinheiro do caixa (ele
  saiu na compra), e o desconto já está fora de V.
- Datas são de calendário de Brasília: `purchase_date`, a data do aporte e o
  `created_at` da venda já chegam no horário da loja, sem fuso (armadilhas 2 e 8
  do `CLAUDE.md`).

---

## 3. O fechamento do mês

Continua sendo feito no começo do mês seguinte, pela competência (mês e ano).
O diálogo passa a ter três passos: **competência → resultado e caixa → retiradas
e saldo**, e a confirmação congela tudo.

### 3.1 O resultado (o lucro, que é rateado)

```
  Vendas brutas                     (vendas líquidas + descontos)
− Descontos concedidos              (no item e na venda; promoção e cupom aparecem como parcelas)
= Vendas líquidas (V)
− Custo das vendas (C)
= Lucro bruto
− Baixas a custo                    (perda, doação, consumo, inventário — por motivo)
+ Sobras de estoque                 (entrada de ajuste manual; decisão D)
− Custos fixos (F)
− Custos variáveis                  (digitados no fechamento, como hoje)
= Lucro líquido                     → rateio entre os sócios, pelos percentuais
```

**Por que a baixa entrar no lucro não repete o erro do sistema anterior.** O Mais
PDV lançava a baixa como **venda**, com forma de pagamento "PERDA" ou "CONSUMO", e
ela sujava faturamento, lucro e o caixa do turno (`StockWriteOff.cs`,
`docs/baixas-de-estoque.md`). Aqui a baixa continua não sendo venda: não entra no
faturamento, nem no caixa, nem na faixa. Ela entra só no resultado, numa linha
própria, pelo custo FIFO que já é congelado no lançamento. É o produto que saiu
da loja sem virar dinheiro.

### 3.2 O caixa (o saldo, que abre o mês seguinte)

```
  Saldo inicial (S)                 ← saldo confirmado no fechamento anterior
+ Vendas líquidas (V)
+ Aportes (A)
− Compras pagas (K)
− Custos fixos (F)
− Custos variáveis
− Retiradas dos sócios              ← digitadas no fechamento, por sócio
= Saldo calculado
  Saldo confirmado                  ← digitado: dinheiro + conta + Pix (+ cartão a receber, se quiser)
  Diferença = confirmado − calculado
```

- O **saldo confirmado** é o saldo inicial do mês seguinte.
- Diferença acima de R$ 1,00, para mais ou para menos, pede observação. Ela
  costuma ser taxa de cartão, venda no cartão que ainda não caiu, despesa que não
  passou pelo sistema ou erro de lançamento.
- As **retiradas** são digitadas por sócio, ao lado do que o rateio dá a cada um
  ("a distribuir R$ X · retirado R$ Y"). Retirar menos deixa o dinheiro na loja;
  retirar mais que o lucro é aceito com aviso (decisão F).
- **Aviso quando as retiradas passam do caixa do mês** (V + A − K − F −
  variáveis). Em outubro, por exemplo, o lucro rateado foi R$ 4.029 e o mês gerou
  R$ 3.727 de caixa.

### 3.3 As regras da corrente de saldos

- **Só se fecha M com M−1 fechado no fluxo novo.** A exceção é o primeiro
  fechamento do fluxo novo (a implantação): ali o saldo inicial é **opcional**.
  Sem ele, o fechamento registra só o saldo confirmado, sem a conferência do
  calculado.
- **Só o último fechamento pode ser excluído.** Hoje qualquer um pode. Com a
  corrente, excluir um do meio deixaria o seguinte com um saldo inicial que não
  existe mais. Excluir o último devolve o mês seguinte ao estado "aguardando".
- **Mês fechado não aceita aporte** (criar, editar nem excluir).
- **Os fechamentos antigos (março a outubro) não são recalculados.** Ficam com
  `calculation_version = 1`, e a tela diz "fechado com a conta antiga: baixas
  fora do lucro e só o desconto da venda", com "—" nos campos novos.
- A confirmação continua recalculando tudo no servidor e recusando o que a prévia
  só avisava, como hoje (`docs/financeiro.md`).

---

## 4. De onde vem cada número

| Número                  | Fonte                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V                       | `ISalesPeriodTotalsService.GetTotalsAsync(...).Revenue` (a mesma conta do Dashboard)                                                                                                                                          |
| C                       | o mesmo serviço, `.Cost`                                                                                                                                                                                                      |
| Desconto no item        | `Σ sale_items.discount × quantity`; dele, a promoção é `Σ promotion_discount × quantity`                                                                                                                                      |
| Desconto na venda       | `Σ sales.discount`; dele, o cupom é `Σ sales.coupon_discount`                                                                                                                                                                 |
| K                       | `purchases` não excluídas, situação **A caminho** ou **Lançado**, pela `purchase_date`, valor `final_total` (o bruto, se faltar o final) **mais** `purchase_entries` tipo Compra, não excluídas e **sem compra ligada** (`purchases.purchase_entry_id`), pela `entry_date`, valor `total` |
| Planejado               | `purchases` **Pendente** com valor (as sem valor aparecem contadas à parte)                                                                                                                                                   |
| Baixas                  | `stock_write_offs` efetivadas, pela `occurred_at`, `total_cost`, por motivo                                                                                                                                                   |
| Sobras                  | `purchase_entries` tipo Ajuste Manual, não excluídas, pela `entry_date`, `total`                                                                                                                                              |
| F                       | `IFixedCostService.GetPeriodFixedCostsAsync(mês)`                                                                                                                                                                             |
| A                       | aportes (seção 5.1)                                                                                                                                                                                                           |
| S                       | `closing_balance` do fechamento de M−1                                                                                                                                                                                        |
| Estoque a custo         | `Σ stock × cost_price` dos produtos ativos ou sem estoque; dias de estoque = estoque ÷ (custo das vendas dos últimos 90 dias ÷ 90)                                                                                              |

O "Compras" que o Resumo e o fechamento mostram hoje soma **entradas** pela data
de entrada, inclusive o ajuste manual. Ele passa a se chamar "Entradas de
estoque", ao lado das "Compras pagas" (K).

---

## 5. Modelo de dados

Scripts aditivos e idempotentes em `Uaus.Data/Scripts/`
(`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Seguem em commit
normal na `dev` e rodam no boot da API.

### 5.1 Aportes — `capital_contributions` (nova)

| Coluna                                                       | Tipo                             | Regra                                                     |
| ------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------- |
| `id`, `created_at`, `updated_at`, `created_by`, `updated_by` | padrão da base                   |                                                           |
| `partner_id`                                                 | bigint, FK `partners` (Restrict) | obrigatório: de quem veio; sócio ativo na hora de lançar  |
| `contribution_date`                                          | date                             | a data do aporte, escolhida pelo operador (hoje, por padrão) |
| `amount`                                                     | numeric(18,2)                    | maior que zero                                            |
| `notes`                                                      | varchar(300)                     | opcional: para quê                                        |
| `is_deleted`                                                 | boolean                          | exclusão lógica, com Log de alerta     |

Índice em `contribution_date`. Nenhuma coluna de saldo, devolução ou dívida
(decisão 9). Sócio com aporte não é excluído, só desativado.

### 5.2 Fechamento — colunas novas em `financial_closings`

| Coluna                                                     | O quê                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `calculation_version` smallint, default 1                  | 1 = conta antiga; 2 = esta                                |
| `item_discounts_total`, `promotion_discounts_total`, `coupon_discounts_total` | os descontos por origem (o `discounts` atual continua sendo o da venda) |
| `stock_surplus_total`                                      | as sobras                                                 |
| `purchases_paid_total`                                     | K                                                         |
| `contributions_total`                                      | A                                                         |
| `withdrawals_total`                                        | a soma das retiradas                                      |
| `opening_balance`, `calculated_balance`, `closing_balance` | numeric, **nulos** nos fechamentos antigos                 |
| `balance_notes` varchar(300)                               | a explicação da diferença                                 |
| `purchase_band` smallint, nulo                             | a faixa do fim do mês                                     |

E em `financial_closing_partner_shares`: `withdrawn_amount` numeric(18,2),
default 0 — o que cada sócio retirou, ao lado do que o rateio dava.

---

## 6. API

| Método | Rota                                          | O quê                                                                                                                                   |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/CapitalContributions?month=yyyy-MM&page&size` | aportes do mês, com o total                                                                                                           |
| GET    | `/CapitalContributions/totals-by-partner`     | o acumulado por sócio desde a abertura (informativo)                                                                                    |
| POST   | `/CapitalContributions`                       | `{ partnerId, contributionDate, amount, notes }`                                                                                        |
| PUT    | `/CapitalContributions/{id}`                  | o mesmo corpo                                                                                                                           |
| DELETE | `/CapitalContributions/{id}`                  | exclusão lógica + Log                                                                                                                   |
| GET    | `/PurchaseBudget?month=yyyy-MM`               | S, A, V, C, K (pago e planejado, e quantas pendentes sem valor), F, as duas linhas, as folgas, a faixa, "provisória", "com saldo/aporte", estoque a custo e dias de estoque |
| POST   | `/FinancialClosings/preview`                  | corpo novo: `variableCosts` (como hoje), `openingBalance?` (só na implantação), `withdrawals: [{ partnerId, amount }]`, `confirmedBalance?`, `balanceNotes?`; resposta com o resultado e o caixa das seções 3.1 e 3.2 |
| POST   | `/FinancialClosings`                          | o mesmo corpo; recusa sem M−1 fechado (fora da implantação), sem saldo confirmado e com diferença sem observação                          |
| DELETE | `/FinancialClosings/{id}`                     | só o último; os outros devolvem a mensagem dizendo qual excluir antes                                                                    |
| GET    | `/FinancialClosings/next`                     | o mês que aguarda fechamento e se ele é a implantação                                                                                   |

- A faixa mora **no domínio**, pura e testada: `PurchaseBudgetRules.Classify(...)`
  devolve `PurchaseBand` (Green = 1, Yellow = 2, Red = 3). Molde: `SalePriceLimit`.
- O front compara a compra simulada com as duas linhas numa função de
  `packages/core` (`purchaseBandFor(spent, greenLimit, redLimit)`), usada pela tela
  de Compras e pelo Painel. É o mesmo par backend/core do `SalePriceLimit` com o
  `MAX_SALE_PRICE`.
- O **Resumo Financeiro** (`/FinancialReports/summary`) passa a usar a mesma conta
  do resultado (3.1): baixas e sobras no lucro, e os descontos por origem. Sem
  isso, o resumo e o fechamento do mesmo mês dariam lucros diferentes.
- Controller sem `[Authorize]` (o filtro global já exige sessão). Path, DTO,
  chave de cache e hook nascem em `packages/api-client` (`hooks/financial.ts`).
- Consulta com `AsNoTracking` e SQL provado com `ToQueryString()`: o InMemory não
  prova a tradução.

### 6.1 Contrato — nomes exatos

JSON em camelCase, enum pelo nome (`JsonStringEnumConverter`), nulo omitido
(`WhenWritingNull`: campo anulável **some** da resposta). Data de calendário
entra como `"yyyy-MM-dd"` e sai como `"yyyy-MM-ddT00:00:00"`. Mês é `"yyyy-MM"`.
No front, enum é `EnumValue`, como no resto do `models.ts`.

**Enum** `PurchaseBand` (`Uaus.Domain/Values/Enums`): `Green = 1`, `Yellow = 2`,
`Red = 3`.

**Aportes**

- `SaveCapitalContributionRequest { partnerId, contributionDate, amount, notes? }`
- `CapitalContributionDto { id, partnerId, partnerName, contributionDate, amount, notes?, createdAt, createdBy? }`
- `GET /CapitalContributions?month=yyyy-MM` (sem mês: o corrente) →
  `CapitalContributionsMonthDto { month, isClosed, total, items: CapitalContributionDto[] }`
- `GET /CapitalContributions/totals-by-partner` →
  `CapitalContributionPartnerTotalDto[] { partnerId, partnerName, total, count }`
- `GET /CapitalContributions/{id}`; `POST` → 201 (`CreatedAtAction`) com o DTO;
  `PUT /{id}` → 200 com o DTO; `DELETE /{id}` → 204.
- Mensagens: "Informe o sócio do aporte!", "Sócio não encontrado ou inativo!",
  "Informe a data do aporte!", "O valor do aporte deve ser maior que zero!",
  "O mês de {mês/ano} já foi fechado: aporte nele não pode ser lançado, alterado
  nem excluído!". Observação até 300 caracteres. Exclusão lógica com Log
  `LogType.Alert`, como a exclusão de fechamento.

**Faixa** — `GET /PurchaseBudget?month=yyyy-MM` (sem mês: o corrente, no fuso
da loja) → `PurchaseBudgetDto`:

| Campo                                                  | O quê                                                    |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `month`, `periodStart`, `periodEnd`                    | o mês consultado                                         |
| `isCurrentMonth`, `isClosedMonth`                      | se é o mês corrente; se já tem fechamento                |
| `isProvisional`, `pendingClosingMonth?`                | M−1 sem fechamento no fluxo novo, e qual é               |
| `openingBalance`                                       | S (zero quando provisória)                               |
| `contributions`, `availableBalance`                    | A; S + A                                                 |
| `revenue`, `costOfSales`                               | V; C                                                     |
| `purchasesPaid`                                        | K                                                        |
| `purchasesPlanned`, `plannedWithoutValueCount`         | pendentes com valor; quantas pendentes sem valor         |
| `fixedCosts`                                           | F                                                        |
| `greenLimit`, `redLimit`                               | C + S + A; V + S + A − F                                 |
| `greenRoom`, `redRoom`                                 | limite − K (negativo quando já passou)                   |
| `band`, `bandIfPlannedBought`                          | a faixa; a faixa se as pendentes forem compradas          |
| `reliesOnBalance`                                      | sem S + A a faixa seria pior ("com saldo/aporte")        |
| `stockValueAtCost`, `stockDays?`                       | estoque de hoje; dias (nulo sem custo vendido em 90 dias) |

**Fechamentos**

- `PreviewFinancialClosingRequest` ganha `openingBalance?` (só vale na
  implantação; fora dela, o servidor usa o saldo do fechamento anterior),
  `withdrawals: [{ partnerId, amount }]` (amount ≥ 0, um por sócio ativo),
  `closingBalance?` (o saldo confirmado) e `balanceNotes?` (até 300).
  `CreateFinancialClosingRequest` herda; na confirmação, `closingBalance` é
  obrigatório, e `balanceNotes` também quando |closingBalance − calculatedBalance|
  passa de R$ 1,00.
- `FinancialClosingPreviewDto` e `FinancialClosingDto` ganham:
  `calculationVersion` (2 nos novos, 1 nos antigos); `grossSales` (revenue +
  discountsTotal); `discountsTotal` (discounts + itemDiscountsTotal);
  `itemDiscountsTotal`, `promotionDiscountsTotal`, `couponDiscountsTotal`;
  `stockSurplusTotal`; `purchasesPaidTotal` (K; `purchasesTotal` continua sendo
  as entradas); `contributionsTotal`; `withdrawalsTotal`; `monthCash` (V + A − K −
  F − variáveis); `openingBalance?`, `calculatedBalance?`, `closingBalance?`,
  `balanceDifference?`, `balanceNotes?`; `purchaseBand?`.
  Só a prévia: `isImplantation` e `writeOffsByReason` (a mesma lista do resumo).
  Só o documento: `isLatest` (pode ser excluído).
- `FinancialClosingShareDto` ganha `withdrawnAmount`.
- `netProfit` (versão 2) = `grossProfit − writeOffLossesTotal + stockSurplusTotal
  − fixedCostsTotal − variableCostsTotal`; o rateio sai dele.
- `GET /FinancialClosings/next` → `FinancialClosingNextDto { month, periodStart,
  periodEnd, isImplantation, previousClosingBalance? }`.
- `DELETE /FinancialClosings/{id}`: só o último. Os outros → 400 "Só o último
  fechamento pode ser excluído: exclua antes o de {mês/ano}."
- A confirmação recusa: período que não começa depois do último fechamento; M−1
  sem fechamento no fluxo novo fora da implantação ("Feche {mês/ano} antes!");
  saldo confirmado ausente; diferença sem observação. A prévia só avisa.

**Resumo** — `FinancialReportSummaryDto` ganha `grossSales`, `discountsTotal`,
`itemDiscountsTotal`, `promotionDiscountsTotal`, `couponDiscountsTotal`,
`stockSurplusTotal`, `purchasesPaidTotal` e `contributionsTotal`, e `netProfit`
passa à fórmula da versão 2 (sem os variáveis, que só existem no fechamento).

**Uma conta só no backend.** Descontos por origem, K, pendentes, baixas, sobras e
aportes de um período saem de **um** serviço, usado pelo resumo, pelo fechamento e
pela faixa. Três cópias da mesma soma divergem em silêncio.

**Front** (`packages/api-client`): o espelho em camelCase. Chaves de cache
`["CapitalContributions"]`, `["PurchaseBudget"]` e `["FinancialClosings", "next"]`.
Mutação de aporte invalida aportes e faixa; mutação de compra invalida a faixa;
fechamento criado ou excluído invalida fechamentos, `next`, faixa e aportes.

---

## 7. Telas

Cores: o vocabulário da base (`dominio/convencoes-de-interface.md`). Verde
(`emerald`) é dentro da meta, âmbar (`amber`) é atenção, vermelho
(`destructive`) é negativo. Nada de quinto significado, e sempre com ícone e
palavra junto da cor. Tudo pensado primeiro para o celular.

### 7.1 Painel Financeiro — `/financeiro/painel`, abre o grupo Financeiro

Feature `features/financial-dashboard`.

1. **Faixa do mês.** Seletor de mês (o atual por padrão), cor, ícone e frase:
   - verde ✓ "Compras dentro do custo do que foi vendido" (ou "…com saldo")
   - âmbar ⚠ "Compras acima do custo vendido; os custos fixos ainda estão cobertos"
   - vermelho ⛔ "Com estas compras, o mês não cobre os custos fixos"

   Embaixo: "Pode comprar R$ X no verde · R$ Y até o vermelho"; fora do verde,
   "Volta ao verde com R$ Z de aporte". Provisória: o aviso e o botão do
   fechamento (seção 2).
2. **O mês em números:** saldo inicial, aportes, vendas brutas, descontos (por
   origem), vendas líquidas, custo das vendas, compras pagas (com as planejadas
   ao lado), custos fixos, baixas e sobras. Cada um leva à tela de origem.
3. **Estoque a custo** e dias de estoque (hoje R$ 34,4 mil e 195 dias). É o
   contrapeso do saldo e do aporte: verde com saldo ainda é estoque crescendo.
4. **Aportes:** os do mês e o acumulado por sócio, com o atalho "Lançar aporte".
5. **Histórico dos meses fechados:** uma linha por fechamento, com vendas
   líquidas, descontos, compras pagas, baixas, lucro líquido, retiradas, saldo
   final e a faixa. Os fechamentos antigos mostram "—" no que não tinham.

### 7.2 Aportes — `/financeiro/aportes`

Feature `features/capital-contributions`, no molde canônico de
`features/fixed-costs`.

- Filtro de mês. Tabela com data, sócio, valor, observação e quem lançou, mais o
  total do mês e o acumulado por sócio.
- Modal com data (hoje), sócio (os ativos), valor e observação. Ao gravar, a
  faixa é refeita na hora: a chave de cache do `PurchaseBudget` é invalidada, e
  o toast diz o efeito ("Novembro passou de amarelo para verde").
- Excluir com `ConfirmDialog` citando data, sócio e valor. Em mês fechado, os
  botões ficam travados e dizem o motivo.

### 7.3 Compras — `/estoque/compras`

- **A faixa no topo da listagem**, no lugar e no estilo do `OpenPurchasesAlert`:
  "Novembro está verde: pode comprar R$ 439 no verde, R$ 1.712 até o vermelho",
  com link para o Painel. Com pendentes que têm valor: "Se fizer as pendentes
  (R$ 600), o mês vai para amarelo". Provisória: diz que é provisória.
- **No editor da compra**, quando ela passa a valer dinheiro (criada já como "A
  caminho", mudada de Pendente para "A caminho" ou com o total final alterado
  numa compra que já conta): a linha "Esta compra mantém novembro no verde",
  "leva para o amarelo" ou "leva para o vermelho", com as folgas que sobram.
- **Levar para o vermelho pede confirmação, sem bloquear** (decisão 13): "Com
  esta compra, novembro não cobre os custos fixos. Comprar mesmo assim?" É o
  padrão da confirmação de margem negativa. Atenção à armadilha do smoke de
  22/10/2026: um clique logo depois de fechar um diálogo cai nele durante a
  animação de saída.
- Data da compra em mês fechado: a linha avisa que a compra não muda o fechamento.

### 7.4 Dashboard

Um cartão pequeno com a faixa do mês e o "pode comprar", que abre o Painel.

### 7.5 Fechamentos Mensais — `/financeiro/fechamentos`

- **Passo 1, competência:** o select de meses continua; o mês sugerido é o que
  `/FinancialClosings/next` aponta. Mês com o anterior aberto aparece travado,
  com o motivo.
- **Passo 2, resultado e caixa:** as contas das seções 3.1 e 3.2, com os custos
  variáveis editáveis como hoje. Descontos por origem; baixas por motivo.
- **Passo 3, retiradas e saldo:** retirada por sócio, ao lado do que o rateio dá
  a cada um; saldo confirmado, que já vem preenchido com o calculado; e a
  observação, exigida quando há diferença. Na implantação, o campo opcional
  "saldo no início do mês".
- **Detalhe do fechamento:** o documento congelado com os três blocos. A
  exclusão só aparece no último, e o aviso diz que o mês seguinte volta a
  aguardar.

### 7.6 Resumo Financeiro — `/financeiro/relatorios`

A mesma conta do resultado (3.1): baixas e sobras no lucro, descontos por origem,
e o "Compras" renomeado para "Entradas de estoque", com as "Compras pagas" ao lado.

### 7.7 Menu Financeiro

Nesta ordem: Painel Financeiro · Resumo Financeiro · Vendas · Baixas · Aportes ·
Fechamentos Mensais · Custos Fixos · Sócios · Formas de Pagamento. O `routes.ts`
é a fonte única do menu.

---

## 8. A entrega — uma só

Tudo entra na `dev` e só sobe para produção quando o ciclo inteiro funcionar lá.

### 8.1 Na dev

1. **Backend**, nesta ordem: scripts (aportes, colunas do fechamento, retirada no
   rateio) → regra da faixa no domínio → serviços (aportes, faixa, fechamento,
   resumo) → controllers → testes.
2. **Front**, nesta ordem: `packages/api-client` (DTOs e hooks) →
   `packages/core` (`purchaseBandFor`) → telas (Painel, Aportes, Compras, cartão
   do Dashboard, Fechamentos, Resumo, menu) → testes.
3. **Verificação**, pelo fluxo do `CLAUDE.md` da pasta Uaus: `gates.sh rapido`
   durante o trabalho; **um revisor adversarial por repositório**;
   `gates.sh completo` (inclui o contrato front × back, porque há DTO novo);
   commit nos dois repositórios e push na `dev`.
4. **Smoke no `admin-dev`** com o usuário `agente.dev`, o ciclo inteiro (a dev é
   cópia de produção, e dado de teste pode ser gravado e excluído):
   - excluir o fechamento de outubro (é o último) e refazê-lo no fluxo novo,
     como implantação, com retiradas e saldo confirmado;
   - ver novembro usar esse saldo; lançar um aporte e ver a faixa mudar;
   - criar uma compra que leva ao amarelo e outra ao vermelho (linha e
     confirmação);
   - fechar novembro parcial, ver dezembro "aguardando", excluir novembro e ver
     voltar;
   - conferir descontos por origem e baixas no resultado, no fechamento e no
     Resumo;
   - Painel e diálogo do fechamento em 375 px.
5. **Base de conhecimento:** `Uaus.Backend.Api/docs/financeiro.md` (a fórmula
   muda: baixas e sobras entram no lucro, descontos por origem, a corrente de
   saldos, só o último fechamento sai) e uma entrada em `Uaus.Docs/historico/`,
   com o link no índice.

### 8.2 Para produção, de uma vez

- Com o "pode subir" do dono, porque a `main` é produção.
- **A API primeiro** (`git push origin dev:main`, depois de conferir o
  fast-forward com `git merge-base --is-ancestor`): os scripts rodam no boot e o
  `schema_migrations` confirma. **Depois o front.** Ao contrário, o admin chamaria
  rotas que ainda não existem.
- **O primeiro fechamento no fluxo novo é o de novembro**, no começo de dezembro,
  como implantação. Para isso, a subida tem que acontecer antes dele. Se novembro
  já tiver sido fechado na conta antiga, basta excluí-lo (é o último) e refazê-lo.

---

## 9. Testes — as bordas que valem

Backend:

- **A faixa:** K igual a C dá verde; um centavo acima, com folga até a linha
  vermelha, dá amarelo; começo do mês com V − F negativo e K ≤ C dá verde
  (decisão 7); K > C + S + A com V + S + A − F < K dá vermelho; o aporte e o saldo
  levam vermelho → amarelo → verde; "com saldo" quando K > C e K ≤ C + S + A;
  provisória quando M−1 não está fechado no fluxo novo.
- **K:** Pendente fora; compra excluída fora; A caminho e Lançado contam pelo
  final, ou pelo bruto se faltar o final; entrada direta dentro; entrada ligada a
  uma compra não conta duas vezes; ajuste manual fora; compra do último dia às 23h
  e do dia 1 à 0h caem no mês certo.
- **Descontos:** item por unidade × quantidade; promoção e cupom como parcelas,
  sem somar duas vezes; venda cancelada fora.
- **Resultado:** baixas efetivadas descontam e as estornadas não; sobras somam;
  o rateio sai do lucro novo; o resíduo de centavos continua indo para o maior
  percentual.
- **Corrente de saldos:** M sem M−1 é recusado fora da implantação; implantação
  sem saldo inicial registra só o confirmado; diferença acima de R$ 1,00 sem
  observação é recusada; excluir um fechamento que não é o último é recusado;
  excluir o último devolve o mês seguinte a "aguardando"; fechamentos de
  `calculation_version = 1` não são recalculados.
- **Aporte:** valor zero ou negativo recusado; sócio inativo recusado; mês fechado
  recusa criar, editar e excluir; a exclusão é lógica e grava Log.
- O SQL das consultas provado com `ToQueryString()`.

Front:

- `purchaseBandFor` em `packages/core`, com as mesmas bordas da faixa.
- Hooks do Painel, dos Aportes e do fechamento, na cerimônia do `vi.mock` com
  `importOriginal`.
- Editor da compra: a linha da faixa muda com a situação e com o total; a
  confirmação aparece só quando a compra leva ao vermelho; Pendente não mexe na
  faixa.
- Fechamento: o passo 3 exige observação quando há diferença; a implantação
  mostra o saldo inicial opcional; a exclusão só no último.
- Os testes de data rodados também com `TZ=UTC` (armadilha 8).

---

## 10. Riscos

- **A linha do vermelho usa só os custos fixos cadastrados** (R$ 865/mês,
  decisão 14). O que sair do caixa fora deles aparece como diferença no
  fechamento.
- **Verde com saldo ou com aporte esconde estoque crescendo.** Daí o texto "com
  saldo/aporte" e o cartão de estoque a custo.
- **Saldo confirmado chutado** faz a corrente carregar o erro para todos os meses
  seguintes. A diferença com observação obrigatória é o que mostra o chute.
- **Fechamento atrasado** deixa a faixa provisória por mais dias. O aviso no
  Painel e em Compras empurra para fechar cedo.
- **A conta do lucro muda** para os fechamentos novos (baixas e sobras). Os
  antigos ficam como estão e dizem por quê.
- **Quem tem login vê tudo** (decisão C).

## 11. Fora do escopo

- Abertura e fechamento de caixa diários (decisão 1).
- Aporte como dívida, devolução ou juros (decisão 9).
- Controle fiscal (decisão 14).
- Compra parcelada contada mês a mês, contas a pagar e boletos.
- Conciliação bancária e projeção do fim do mês.
- Orçamento por categoria, departamento ou fornecedor.
- Bloqueio de compra: a faixa avisa e confirma, nunca impede (decisão 13).
