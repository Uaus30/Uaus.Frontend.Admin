# BI › Anomalias — anomalias de cadastro (plano técnico)

> **Estado: decisões fechadas com o dono em 23/09/2026, implementado na `dev`
> no mesmo dia.** Este arquivo é o contrato da feature: toda camada codifica
> contra ele, e divergência se corrige aqui primeiro. A proposta de 22/09/2026
> está preservada abaixo; onde a decisão do dono mudou a recomendação, vale a
> tabela "Fechadas em 23/09/2026" da seção 0.
>
> Salvo indicação, os números foram medidos no **banco de produção em
> 22/09/2026**, só com leitura, pelo helper `TEMP/psql_prod_ro.sh` (transação
> somente leitura forçada). As consultas estão em `C:\Projects\Uaus\TEMP\_anom_*.sql`.

---

## 0. Decisões

### Fechadas (pedido do dono, 22/09/2026)

| #  | Decisão | Consequência |
| -- | ------- | ------------ |
| 1  | Tela nova no grupo **BI** do admin, chamada **"Anomalias"** | rota `/bi/anomalias`, `SO_ADMIN` (mostra custo), primeira do grupo pela ordem alfabética |
| 2  | A tela **varre o catálogo inteiro a cada consulta** e lista o que está errado **agora** | nada é persistido: nem a anomalia, nem a lista, nem a resolução |
| 3  | A correção é **manual, no cadastro do produto** | a linha tem um link para o produto em nova aba; a tela não edita nada |
| 4  | Um ícone **recarrega** a lista | quem corrige volta e confere se a anomalia sumiu |
| 5  | Um produto pode ter **N anomalias** | uma linha por cadastro, com N etiquetas (ver 2.3) |
| 6  | **Estoque baixo** = saldo **menor que o maior** entre 5 e 10% da última entrada | vale para o estoque fantasma (seção 3) |
| 7  | **Descontinuado não é anomalia**: produto inativo com saldo zero é o que acontece quando a loja para de trabalhar com um produto | fica fora de **todos** os critérios (ver 2.1) |
| 8  | A lista deve ser **a menor possível** | cada critério só acende quando há correção a fazer; o que é normal fica de fora |

### Fechadas em 23/09/2026 (resposta do dono às perguntas abaixo)

| #  | Decisão | O que foi feito |
| -- | ------- | --------------- |
| D1 | **Ignorar a contagem física**: a regra olha só o estado atual | sem tabela `stock_counts`. O silêncio recomeça só com **venda** ou **entrada de compra**; ajuste manual, baixa de inventário e conferência não entram. Contagem que zera o saldo tira o produto da lista pelo próprio saldo; contagem que confirma não tira |
| D2 | **Corrigir o custo da ÚLTIMA entrada pela tela**, no detalhe da entrada; quantidade e o resto continuam sem edição. "Itens Recebidos" vira **Recebimento**, com link para a compra | `PUT /PurchaseEntries/{id}/items/{itemId}/unit-cost` (`PurchaseEntryCostCorrectionService`), a mesma cadeia do script da JARRA; lápis no custo do item cujo lote é o mais recente e que é o único item do produto na nota (`canEditUnitCost` — a nota da importação com um lote por custo histórico, a da ESPÁTULA DE SILICONE, fica de fora, como no script da JARRA); link "Compra #N" (`purchaseId`) em nova aba |
| D3 | Ok | publicação única por script de boot, `2026-09-23_publica_na_vitrine_cadastros_prontos.sql` (critério idêntico ao da anomalia); roda na `dev` no deploy e em produção na promoção |
| D4 | Ok — limiar **3** | `ProductAnomalyRules.PhantomMinExpectedSales = 3` |
| D5 | **Todas as sugestões** (S1 a S5) | as nove etiquetas da seção 2.2 |
| D6 | Ok — sem foto **só com estoque** | `MissingPhoto` exige produto não inativo com saldo |
| D7 | **Preço abaixo do custo só com estoque** (dono, 23/09/2026, depois das perguntas): sem saldo pode ter sido queima de estoque | `PriceBelowCost` exige saldo > 0. A única ocorrência de produção, a JARRA MARACATU 1,560ML, está sem saldo e saiu da lista |

### Em aberto em 22/09/2026 (com recomendação)

| #  | Pergunta | Recomendação |
| -- | -------- | ------------ |
| D1 | A contagem física que **confirma** o saldo hoje não grava nada. Como o produto sai da lista do estoque fantasma nesse caso? | gravar **toda** contagem (tabela `stock_counts`, script aditivo). Ver 3.7 |
| D2 | O **custo zerado** não tem correção pela tela: o custo só entra por entrada de estoque. Qual caminho? | corrigir o passivo **uma vez, por script**, com os custos informados pelo dono. Tela de correção de custo, só se voltar a acontecer. Ver seção 4 |
| D3 | **Fora do site** (128 grupos prontos e ocultos) entra na lista? | sim, **depois** de uma publicação única que zere o passivo. Ver S4 |
| D4 | Limiar do estoque fantasma: **3** ou **5** vendas esperadas no silêncio? | **3** (acende em ~2,5 dias no exemplo do dono; ~1 em cada 4 alarmes é falso, e o falso custa uma contagem). Ver 3.5 |
| D5 | Quais sugestões extras (seção 5) entram na primeira versão? | S1, S2, S3 e S5 na V1. S4 depois da publicação única |
| D6 | "Sem foto": só cadastro **com estoque** (52) ou todos (137)? | só com estoque. A foto vende o que está na prateleira, e o esgotado volta à lista quando for reposto |

---

## 1. O que a produção mostrou

| Medida (22/09/2026) | Valor |
| ------------------- | ----- |
| Produtos vivos (Ativo ou Sem estoque) / grupos | 1.081 / 913 |
| Situações | 817 Ativo, 264 "Sem estoque", 21 Inativo (19 com saldo zero = descontinuados), 4 Rascunho |
| Grupos sem foto | 137 (52 com estoque) |
| Produtos com custo zero | 46 (37 com saldo, em 32 grupos). **1.334 unidades** paradas em lotes de custo zero. 83 unidades já vendidas a custo zero, R$ 226,47 de faturamento contado como lucro integral |
| Origem do custo zero | 45 itens de entrada com custo zero, **todos da importação do Mais PDV**. Nenhum lançado depois dela |
| Preço abaixo do custo | 1: JARRA MARACATU 1,560ML (R$ 14,90 contra R$ 15,42), situação "Sem estoque", 0 un. Nenhum lote em estoque com custo acima do preço |
| Candidatos a estoque fantasma (regra da seção 3) | 29 produtos |
| Ritmo da loja | cerca de 12 vendas por dia aberto. Sábado 18,9. **Fecha aos domingos** |
| Conferência de produtos | aberta hoje às 13:43 em produção: 18 de 933 grupos conferidos, 4 com diferença |

O item "Anormalidades do catálogo" de `Uaus.Docs/pendencias.md`, medido em
15/09/2026, é exatamente o que esta tela resolve. Os números mudaram desde
então: o custo zero caiu de 55 para 46, e o preço abaixo do custo continua sendo
a mesma jarra.

---

## 2. As anomalias

### 2.1 Universo — o que a tela olha

- **Fora de tudo:**
  - produto ou grupo excluído;
  - **produto descontinuado** (Inativo com saldo zero, decisão 7). Hoje são 19.
- **Inativo com saldo** é o único caso em que a tela olha produto inativo, e só
  pelo critério S3. Ele é o avesso do descontinuado: a loja parou de trabalhar
  com o produto, mas ainda há unidades.
- Estoque é `products.stock`, a mesma coluna do relatório de estoque baixo.
  Ela bate com a soma dos lotes em 100% do catálogo (conferido hoje: zero
  divergências).

### 2.2 O catálogo de anomalias

A ordem da tabela é a **prioridade** (ver 7.4). Cor segue o vocabulário fixo de
`Uaus.Docs/dominio/convencoes-de-interface.md`: vermelho é "perde dinheiro ou
está bloqueado", âmbar é "atenção". **Cor nunca sozinha**: toda etiqueta leva
ícone e texto.

| # | Etiqueta | Regra | Hoje | Cor | Como resolver (no cadastro) |
| - | -------- | ----- | ---- | --- | --------------------------- |
| 1 | **Preço abaixo do custo** | produto não inativo **com saldo** (D7) com `price < cost_price`, **ou** preço abaixo do custo de algum lote ainda com saldo (a próxima venda consome esse lote por FIFO) | 0 (a JARRA MARACATU está sem saldo) | vermelho | ajustar o preço. Se o custo é que está errado, corrigir o custo da última entrada (D2) |
| 2 | **Rascunho com estoque** *(S1)* | situação Rascunho e saldo > 0. O PDV só vende Ativo e Sem estoque (`PdvService.cs:73-74`) | 1 grupo (4 variações, 40 un.) | vermelho | mudar a situação para Ativo |
| 3 | **Estoque fantasma** | ver seção 3 | 29 | âmbar | aba Estoque, Contagem Física. Prateleira vazia gera a baixa de inventário, e o produto sai da lista |
| 4 | **Marcado "Sem estoque"** *(S2)* | situação "Sem estoque" com saldo > 0. O site só mostra Ativo (`StorefrontService.cs:308,403,473`) | 4 | âmbar | mudar a situação para Ativo |
| 5 | **Custo zerado** | produto não inativo, saldo > 0, e `cost_price = 0` **ou** lote com custo zero ainda com saldo | 32 grupos (37 produtos) | âmbar | **não há caminho na tela hoje**. Ver seção 4 (D2) |
| 6 | **Inativo com estoque** *(S3)* | situação Inativo com saldo > 0 | 2 | âmbar | reativar, ou lançar a baixa (Perda, Doação ou Consumo) se as unidades não existem ou não serão vendidas |
| 7 | **Sem foto** | grupo sem nenhuma imagem viva, com ao menos um produto não inativo com saldo (D6). É o mesmo predicado da conferência (`InventoryCountService.cs:136-137`) | 52 | âmbar | pôr a foto na galeria do produto |
| 8 | **Fora do site** *(S4)* | grupo com foto e produto Ativo com saldo, mas "Exibir no site" desligado | 128 | âmbar | ligar "Exibir no site" |
| 9 | **Nome repetido** *(S5)* | dois ou mais grupos vivos com o mesmo nome normalizado (sem contar descontinuados) | 9 grupos (4 nomes) | âmbar | diferenciar os nomes (ref., volume, cor). No balcão, as duas linhas são idênticas |

Tamanho da lista no primeiro dia, contando **grupos**:

| Recorte | Grupos |
| ------- | ------ |
| só as quatro pedidas (1, 3, 5, 7) | 111 (110 com a D7) |
| + S1, S2, S3, S5 | 126 |
| + S4 (fora do site) | 250 |

Sem contar o estoque fantasma, **só 3 grupos têm duas ou mais anomalias**.

### 2.3 Uma linha por cadastro (grupo), com N etiquetas

Recomendação: **uma linha por grupo**, com uma etiqueta por anomalia. É a
mesma decisão da conferência de produtos ("a linha é o GRUPO"), por três
motivos:

- o cadastro que se corrige é o grupo, e o link do admin é por grupo
  (`productDetailPathname(productGroupId)`);
- foto e "Exibir no site" são do grupo;
- anomalia combinada é rara (3 grupos). Linhas distintas repetiriam o produto
  sem ganhar nada.

Quando a anomalia é de **uma variação** (preço, custo, estoque), a etiqueta diz
qual. Por exemplo: "Estoque fantasma · AZUL, G: 2 un.". O nome da variação é
composto pelo `IProductVariationNameResolver`, como em toda tela de BI.

---

## 3. Estoque fantasma — a inteligência

### 3.1 O nome

**Estoque fantasma** é o termo de varejo para saldo que existe no sistema e não
existe na prateleira. A tela o apresenta como **suspeita**, e a etiqueta diz de
onde ela vem. Ela não afirma que o produto acabou; afirma que o silêncio de
vendas ficou improvável para o ritmo dele.

### 3.2 A regra — as quatro condições

Vale para produto vivo **vendável** (Ativo ou Sem estoque) com saldo > 0:

1. **Saldo baixo** (decisão 6): `saldo < max(5, 10% da quantidade da última
   entrada do tipo Compra)`.
   - A entrada de Ajuste Manual (sobra de contagem) não é lote de compra e não
     entra nesta conta.
   - Sem nenhuma entrada de compra, o limiar é 5.
2. **Vinha vendendo**: ao menos **3 vendas** do produto na janela de
   referência. A janela vai de `max(última entrada de compra, última venda −
   90 dias)` até a última venda.
3. **Parou**: desde o último evento que zera a dúvida (3.7), o número de vendas
   **da loja** sem o produto ficou improvável:
   `esperado = (vendas do produto na janela ÷ vendas da loja na janela) ×
   vendas da loja desde o último evento`. Acende com `esperado ≥ 3`.
4. Venda cancelada não conta, nem como venda do produto nem no relógio da loja.
   É o mesmo critério das outras telas de BI.
5. **Entrada lançada como DATA conta como o fim daquele dia** (revisão
   adversarial, 23/09/2026). O admin grava `aaaa-mm-ddT00:00:00`; lida ao pé da
   letra, a reposição que chegou às 17h mediria o ritmo pelas vendas da manhã
   (do lote que acabou) e seria acusada de fantasma por mercadoria recém-chegada.
   Entrada com hora de verdade (a importação) fica como está
   (`ProductAnomalyRules.EntryInstant`).

Por que 3: se o produto estivesse na prateleira vendendo no ritmo de sempre, a
chance de passar por um silêncio desses sem nenhuma venda seria de
`e^(−3)`, cerca de 5% (conta de Poisson). O que se conta é **venda (cupom)**, e
não unidade: unidades vêm em rajadas (um cliente leva 10), cupons não.

### 3.3 Por que o relógio é "vendas da loja", e não dias

- **A loja fecha aos domingos e em feriados.** Contando dias, todo domingo e
  todo 07/09 seriam silêncio falso.
- **O movimento muda.** O sábado tem 18,9 vendas, contra 9,8 da segunda-feira
  (90 dias), e dezembro terá outro patamar. Contando cupons da loja, a
  expectativa acompanha o movimento sozinha.

O texto da etiqueta fica explicável: "vendia em 1 de cada 10 vendas da loja;
desde a última venda, a loja fez 31 vendas sem ele; no ritmo, ele teria
aparecido em ~3".

### 3.4 O exemplo do dono: grupo 851, produto 1021

"CUMBUCA TIGELA BACIA DE PLÁSTICO 1L 2 REAIS". O **851 é o id do grupo** (o
número da URL do admin), e o produto é o **1021**.

- **Histórico:** lote de 100 un. em 18/08/2026, a R$ 1,34. Foram 97 un.
  vendidas em 39 vendas, em 17 dos 30 dias de loja aberta. A **última venda foi
  hoje, 22/09, às 10:32**, e levou 2 un.
- **Saldo baixo:** 3 un. no sistema contra um limiar de max(5, 10) = 10. Passa.
- **Ritmo:** o produto aparece em 39 de 401 vendas da loja (9,7%).
- **Hoje:** desde a última venda, a loja fez **9 vendas**. O esperado é 0,9, e
  a regra **não acende**.
- **Quando acende:** com **31 vendas da loja** sem ele, cerca de 2,5 dias de
  loja aberta. Sem outra venda, isso cai **por volta de quinta, 24/09**.

A regra não enxerga mais cedo porque o produto vendeu hoje. Enquanto há venda,
não existe silêncio a medir. Quem viu a prateleira vazia sabe antes do sistema.
Para esse caso, o caminho continua sendo a Contagem Física. Ela lança a baixa,
e o produto passa a entrar no relatório de estoque baixo como "esgotado que
vende", com o botão **Comprar**.

**É esse o dano que o fantasma causa, além do site anunciar o que não existe.**
O saldo falso **tira o produto da porta "esgotado que vende"** do estoque
baixo. No produto lento, ele também tira da porta "dura menos de 30 dias",
conforme o ritmo cai. A compra deixa de ser sugerida justamente para o item que
acabou.

### 3.5 Teste retroativo: a regra rodada no passado

A regra foi rodada "como se hoje fosse" quatro datas passadas, com o saldo
daquele dia reconstruído pelos lotes, vendas e baixas. Depois, olhou-se o que
aconteceu com cada acusado.

- **Alarme falso** = o produto voltou a vender **sem nenhuma entrada no meio**,
  ou seja, o saldo existia.
- "Nunca mais vendeu" é compatível com o fantasma, mas não é prova. Nenhuma
  contagem foi feita nesse período (a conferência começou hoje).

**Com limiar 3:**

| Corte | Avaliados (saldo baixo com fluxo) | Acusados | Alarme falso | Nunca mais vendeu |
| ----- | --------------------------------- | -------- | ------------ | ----------------- |
| 25/07 | 45 | 15 | 5 (33%) | 10 |
| 08/08 | 54 | 17 | 3 (18%) | 14 |
| 22/08 | 60 | 25 | 5 (20%) | 20 |
| 05/09 | 67 | 31 | 6 (19%) | 25 |

**Com limiar 5:** 10, 11, 12 e 19 acusados, com 2, 2, 1 e 2 alarmes falsos
(cerca de 13%).

Recomendação (D4): **3**. O alarme falso custa uma contagem de prateleira.
Esperar dois dias a mais custa a compra que não foi feita e o site anunciando o
que não existe. Os falsos da amostra (MEIA SOQUETE FINA, PORTA DETERGENTE
JAGUAR, CABO USB V8) têm cara de produto guardado fora da gôndola, que a
contagem também resolve.

### 3.6 Sensibilidade hoje

Produtos acusados hoje, por mínimo de vendas na janela (linhas) e limiar de
vendas esperadas (colunas):

| Mínimo de vendas na janela | ≥ 2 | **≥ 3** | ≥ 4 | ≥ 5 |
| --------------------------- | --- | ------- | --- | --- |
| **3** | 35 | **29** | 25 | 22 |
| 4 | 28 | 23 | 19 | 16 |
| 5 | 18 | 16 | 14 | 11 |

Os três números (5 un., 10% e 3 vendas) ficam como **constantes nomeadas** no
backend e são devolvidos no DTO. Assim, o manual da tela fala com os números
que a regra usou.

### 3.7 O que zera o relógio (D1)

> **Decidido em 23/09/2026: a contagem física não entra.** Valem só a venda e a
> entrada de COMPRA. O texto abaixo é a análise que levou à pergunta.

O silêncio conta a partir do **evento mais recente** entre:

| Evento | Por quê | Existe hoje? |
| ------ | ------- | ------------ |
| venda do produto | a prateleira provou que tinha | sim |
| entrada de estoque (qualquer tipo) | chegou mercadoria, ou uma sobra foi contada | sim |
| baixa de inventário (`reason = 4`, efetivada) | a contagem achou falta, e o saldo foi acertado | sim |
| grupo marcado "conferido" na conferência (`inventory_count_items.reviewed_at`) | alguém olhou o estoque do cadastro | sim |
| **contagem física que bateu com o sistema** | alguém contou e confirmou o saldo | **não: não grava nada** (`InventoryCountService.cs:257-258`) |

A última linha é a lacuna. Se a contagem confirma "tem 3 mesmo", nada fica
registrado, e o produto **não sai da lista** até vender de novo. Isso quebra a
premissa de que a correção é sempre possível.

- **Opção A (recomendada): gravar toda contagem física**, inclusive a que bate,
  numa tabela nova `stock_counts`:
  - colunas: produto, instante, contado, saldo anterior, usuário, e o id da
    baixa ou da entrada quando houver diferença;
  - gravada pelo `RegisterStockCountAsync` nos três ramos;
  - vem por **script aditivo** de boot.

  Isso **não é persistir a anomalia nem a resolução** (decisão 2). É gravar um
  fato do estoque que hoje se perde. O produto sai da lista e só volta se
  ficar **outro** silêncio improvável. De bônus, nasce o histórico de
  acuracidade do estoque ("a última contagem conferiu").
- **Opção B: nenhuma mudança de banco.** Só a conferência e as contagens com
  diferença zeram o relógio. Uma contagem que bate, feita fora de uma
  conferência aberta, deixa o produto na lista.

### 3.8 O que a regra não sabe

- **Queda real de procura** (moda que passou, sazonal) parece fantasma. A
  contagem confirma o saldo, e, com a opção A, o produto sai da lista.
- **Produto guardado fora da gôndola** também acende. É o alarme falso típico
  da amostra, e a contagem resolve do mesmo jeito.
- **Produto que nunca vendeu** não tem ritmo, e a regra não o julga. Parado é
  assunto do Desempenho de Produtos.

---

## 4. Custo zerado — a correção não existe na tela (D2)

> **Decidido em 23/09/2026: a correção passou a existir na tela**, restrita à
> última entrada de cada variação (seção 0). O texto abaixo é a análise de
> 22/09/2026; a opção B virou a entrega, sem a restrição de "projeto próprio".

O que o código diz:

- `products.cost_price` só é escrito pela entrada de estoque, com o custo do
  lote mais recente (`PurchaseEntryService.RecalculateProductsStockAndCostAsync`).
- Nenhuma requisição de produto aceita custo.
- Entrada com estoque consumido não se edita.
- A regra da casa é que "custo errado de entrada se corrige por script, e a
  correção desce a cadeia inteira": nota, lote, `sale_item_stock_lots`,
  `sale_items.total_cost/profit`, baixas, `products.cost_price` e o cache
  `dashboard_sales_hourly`.

**Custo zero pode ser legítimo.** O código aceita de propósito, para
bonificação e brinde (`ReceivePurchaseEntryItemRequest.cs:34-36`). Hoje não há
nenhum caso desses: **os 45 itens de entrada com custo zero vieram todos da
importação**.

- **Opção A (recomendada agora):** correção **única**, por script, com os
  custos informados pelo dono.
  - Eu gero a planilha dos 46 produtos (37 com saldo), com uma coluna "custo
    real".
  - O dono preenche.
  - O script segue o molde `2026-09-13_corrige_custo_jarra_de_plastico_2l.sql`.
    Fechamento financeiro assinado não é reescrito: o script avisa.
  - Resolvido o passivo, a etiqueta passa a ser rara.
- **Opção B (depois, se voltar a acontecer):** uma tela "Corrigir custo da
  entrada" na aba Estoque do produto, com a mesma cadeia como serviço. É
  dinheiro congelado em seis lugares, então é projeto próprio, com plano e
  revisão adversarial próprios.
- **Na V1, a etiqueta mostra a origem**, por exemplo "37 un. com custo R$ 0,00 ·
  veio da importação do Mais PDV" ou "entrada de 22/09 por eduardo". Assim, a
  bonificação legítima se reconhece de relance. Ela sai da lista quando essas
  unidades forem vendidas.

---

## 5. Sugestões para enriquecer (todas corrigíveis no cadastro)

| #  | Anomalia | Hoje | Por que importa | Achado |
| -- | -------- | ---- | --------------- | ------ |
| S1 | **Rascunho com estoque** | 1 grupo: CALCINHA INFANTIL LISA ALGODÃO (grupo 897), 4 variações × 10 un. | o balcão **não vende** rascunho | cadastrado em 12/09 e esquecido em rascunho há 10 dias |
| S2 | **Marcado "Sem estoque"** com saldo | 4: BALDE PRETO 5L (**95 un.**), FORMA REDONDA, ROBO TRANSFORMER, ADAPTADOR T DOBRÁVEL | o **site esconde**: só mostra Ativo | o ADAPTADOR foi contado hoje (0 → 1) e continuou "Sem estoque". Nem a entrada nem a sobra da contagem devolvem a situação para Ativo (achado A1) |
| S3 | **Inativo com estoque** | 2: VAZINHO DE GESSO (**44 un.**, inativado em 06/09), TAÇA DIAMOND (12 un., inativado em 11/09) | unidades que ninguém vende, contadas no valor do estoque | é o avesso do descontinuado (decisão 7). Pode ser de propósito: reativar ou baixar decide |
| S4 | **Fora do site** | **128 grupos**, 1.304 un., 84 deles venderam em 90 dias | venda online perdida | **126** ganharam foto na sessão de 06/09 (175 fotos enviadas à mão). Pôr foto não liga "Exibir no site" (achado A3) |
| S5 | **Nome repetido** | 4 nomes, 9 grupos (ESCORREDOR DE LOUÇA ×3, O PEQUENO PRÍNCIPE, PISTOLA LANÇA DARDOS, TOALHA DE ROSTO EXTRA MACIA) | no balcão, duas linhas idênticas | quase todos nasceram das separações das variações "UNDEFINED" (grupos 931 e 933 a 936) |

**S4 precisa de uma publicação única antes de entrar.** Com os 128, ela sozinha
seria metade da lista. O `publicar_vitrine.py` faz exatamente isso: só liga,
nunca desliga. Mas ele **ainda procura a foto em `product_images`**, a tabela
aposentada em 12/09/2026 (achado A2), e precisa ser adaptado a
`product_group_images` antes. Rodar em produção é escrita no banco da loja, e
só com o OK explícito do dono.

**Medidas e descartadas** (não entram, e o motivo):

| Ideia | Hoje | Por que não |
| ----- | ---- | ----------- |
| Margem entre 0 e 10% | 10 | é decisão de preço, não erro de cadastro. Criaria uma régua nova além da faixa de 30% |
| Margem ≥ 85% | 4 | legítimas: livros de R$ 2,50 e xuxinha de R$ 0,03 |
| Grupo com variações e uma variação só | 2 | a correção (desagrupar) é script, não tela |
| **Parou de vender com saldo ALTO** | 34 (mesmo limiar) | não é cadastro: é gôndola ou exposição. Candidata a outra tela ("sumiu da prateleira?"), não a esta |

---

## 6. Backend (`Uaus.Backend.Api`)

### 6.1 Endpoint e contrato

- `GET /ProductAnomalies`, com `[Authorize(Role.Admin)]`, sem parâmetros. O
  molde é o `ProfitLeadersController`.
- Serviço `IProductAnomalyService` / `ProductAnomalyService`, registrado em
  `Uaus.Api/Extensions/DependencyExtensions.cs` (ordem alfabética).
- O serviço injeta o `UausDbContext` e o `IProductVariationNameResolver`. É o
  precedente das telas de BI: projeção de leitura sem regra de escrita, com a
  justificativa em `LowStockService.cs:21-23`.
- Regras puras em `Services/ProductAnomalies/ProductAnomalyRules.cs` (estático,
  testado sem banco), no molde de `ProfitLeaderRules`.
- DTOs em `DTOs/ProductAnomalies/ProductAnomaliesDtos.cs`. Enum sai como texto,
  e nulo é omitido (`WhenWritingNull`).

```text
ProductAnomaliesReportDto
  GeneratedAt
  Rules          { LowStockMinUnits = 5, LowStockEntryShare = 0.10,
                   PhantomMinWindowSales = 3, PhantomMinExpectedSales = 3,
                   PhantomWindowDays = 90 }
  Counts[]       { Type, Groups }
  Items[]        ProductAnomalyRowDto

ProductAnomalyRowDto
  ProductGroupId, Name, ImageUrl?, CategoryName?, HasVariations, Stock (soma do grupo)
  Anomalies[]    ProductAnomalyDto

ProductAnomalyDto
  Type           MissingPhoto | PriceBelowCost | ZeroCost | PhantomStock | DraftWithStock
                 | MarkedOutOfStock | InactiveWithStock | HiddenFromStorefront | DuplicateName
  ProductId?, ProductName?        (a variação, com nome composto)
  Price?, CostPrice?, Stock?
  LotCost?                        (lote antigo com saldo acima do preço)
  LastEntryId?, LastEntryDate?    (a entrada mais recente — a única que a tela corrige)
  ZeroCostUnits?, ZeroCostEntryId?, ZeroCostEntryDate?
                                  (unidades de custo zero com saldo, e a entrada do
                                   lote zerado mais recente; ≠ LastEntryId = só script)
  Phantom?       { LowStockThreshold, LastPurchaseQuantity?, LastPurchaseAt?, LastSaleAt,
                   SilenceSince, WindowSales, WindowStoreSales,
                   StoreSalesSinceSilence, ExpectedSales }
  DuplicateGroupIds?
```

> Implementado assim em 23/09/2026. O esboço de 22/09 previa `ZeroCostOrigin`
> e `SilenceReason`; o primeiro virou `ZeroCostEntryId` (a tela mostra a entrada
> e diz se ela é a última), e o segundo saiu com a D1 — sem contagem física, o
> silêncio só recomeça com venda ou compra.

### 6.2 Consultas: por conjunto, sem N+1

São sete idas ao banco, todas com `AsNoTracking`, sem consulta por linha:

1. Catálogo: produto com grupo, situação, saldo, preço, custo, "tem foto" (o
   mesmo predicado da conferência), capa, "Exibir no site" e categoria.
2. Lotes com saldo por produto: unidades com custo zero, maior custo unitário e
   origem do lote de custo zero.
3. Última entrada do tipo Compra por produto: data e quantidade.
4. Vendas (cupom) dos **candidatos** a fantasma, que são só os de saldo baixo.
5. Instantes das vendas da loja desde o início da janela mais antiga. São cerca
   de 2.200 hoje; a contagem por janela é busca binária em memória.
6. Eventos que zeram o relógio: última entrada, baixa de inventário, conferência
   e, com D1-A, contagem.
7. Nomes repetidos: agrupados pelo nome normalizado.

Derivado (esperado, razões) se calcula **depois de materializar**, nunca num
`Select` do EF (`docs/projecoes-ef-e-avaliacao-no-cliente.md`). A meta é menos
de 1 s em produção. O protótipo em SQL, rodado daqui contra produção, levou
~2 s com a rede no meio, e a medição local exagera cerca de 8 vezes. O número
real sai do teste temporário na dev e é citado na entrega.

### 6.3 D1-A: `stock_counts` — NÃO implementado (D1 decidida em 23/09/2026)

- Entidade `StockCount`, mapeamento e **linha no `UausDbContext.OnModelCreating`**.
  O registro é manual, e esquecê-lo não quebra build nem teste: é o
  `MappingRegistrationTests` que pega.
- Script `AAAA-MM-DD_stock_counts.sql`: idempotente, dentro de `BEGIN/COMMIT`,
  com o índice `(product_id, counted_at)`.
- `RegisterStockCountAsync` grava a linha nos três ramos: igual, falta e sobra.

### 6.4 Testes (mesmo commit)

- **Regras puras**:
  - limiar `max(5, 10%)` e o "menor que" estrito;
  - sem entrada de compra, o limiar é 5;
  - esperado 2,99 não acende e 3,00 acende;
  - janela com menos de 3 vendas não acende;
  - divisor zero (a loja sem vendas na janela) não acende nem estoura.
- **Serviço**, com cada anomalia positiva e negativa, e ainda:
  - descontinuado fora de tudo, e inativo com saldo só em S3;
  - imagem excluída conta como sem foto;
  - grupo excluído fica fora;
  - venda cancelada não conta, nem no produto nem no relógio da loja;
  - cada evento de 3.7 zera o relógio;
  - dia sem venda na loja (domingo) não avança o relógio;
  - lote de custo zero escondido por um custo novo no cadastro ainda acende;
  - lote com custo acima do preço acende "preço abaixo do custo";
  - uma linha por grupo com N etiquetas;
  - nome composto da variação;
  - catálogo vazio.
- **Tradução**: `ToQueryString` com `UseNpgsql` em cada consulta (padrão de
  `LowStockServiceTests.cs:563-612`), mais um teste **temporário** contra o
  Postgres da dev, que também mede o tempo. Ele é removido depois.
- **DI**: um teste temporário que resolve o escopo. O boot em Production não
  valida registro faltando.

---

## 7. Admin (`Uaus.Frontend.Admin`)

### 7.1 Rota e menu

- `apps/admin/src/routes.ts`: `{ path: "/bi/anomalias", label: "Anomalias",
  group: "BI", component: ProductAnomalies, roles: SO_ADMIN }`, **antes** de
  `/bi/curva-abc`, porque o BI é alfabético.
- `apps/admin/src/__tests__/routes.test.ts` trava nomes, ordem e papel. Ganha a
  entrada nova e um teste de `SO_ADMIN`.

### 7.2 Camada de dados

- `packages/api-client/src/hooks/product-anomalies.ts`: tipos,
  `getProductAnomaliesQueryKey = () => ["product-anomalies"]`,
  `getProductAnomalies()` e `useGetProductAnomalies()`.
- Export em `hooks/index.ts`.
- Campo anulável se declara `campo?: T | null`, e a fixture omite o campo.

### 7.3 Feature `apps/admin/src/features/product-anomalies/`

- `README.md`: a regra de negócio da tela.
- `hooks/useProductAnomalies.ts`: filtro por tipo, busca, contagens derivadas e
  `refetch`.
- `lib/anomalies.ts`: o catálogo das etiquetas (rótulo, ícone, cor, prioridade,
  "como resolver" e texto da evidência). Todo mapa por enum tem `?? FALLBACK`:
  valor desconhecido vira "Anomalia" neutra em vez de derrubar a rota.
- `components/`: `AnomalyFilters` (chips com contagem, busca e recarregar),
  `AnomalyTable` / `AnomalyRow`, `AnomalyTag` e `AnomaliesHelp`
  (`BiHelpDialog`).
- `__tests__/fixtures.ts`, com testes em `hooks/`, `lib/` e `components/`.
- Página: `apps/admin/src/pages/product-anomalies.tsx`. Ela não renderiza o
  `AppLayout`.

### 7.4 A tela

```text
Anomalias                                                   [Como ler esta tela]
Atualizado às 18:42 · 111 cadastros para corrigir                          [⟳]

[Todas 111] [Estoque fantasma 29] [Custo zerado 32] [Sem foto 52] [Preço abaixo do custo 1] …
[ Buscar produto… ]

 foto  Produto                                    Anomalias                                  Estoque
 [▣]   JARRA MARACATU 1,560ML ↗                   ● Preço abaixo do custo                          0
                                                    R$ 14,90 · custo R$ 15,42 (−R$ 0,52/un.)
 [▣]   PACOTE XUXINHA 50 UNIDADES ↗               ● Estoque fantasma                               1
                                                    parou em 25/03 · a loja fez 1.916 vendas
                                                    sem ele; no ritmo, seriam ~69 · Contar ↗
```

- **Chips por tipo** com a contagem. Clicar filtra; "Todas" limpa. Filtro e
  busca são locais: a lista inteira vem numa resposta só, com cerca de 130
  linhas e sem paginação.
- **Etiqueta**: `<span>` com `BI_TONE_PILL[tom]`, ícone e texto. É o padrão de
  `ProfitBadges.tsx`; o `Badge` do `packages/ui` não tem âmbar nem verde.
  - Ícones: `ImageOff` (sem foto), `TrendingDown` (preço), `CircleDollarSign`
    (custo), `Ghost` (fantasma), `FilePen` (rascunho), `PackageX` (marcado sem
    estoque), `Archive` (inativo), `EyeOff` (fora do site) e `Copy` (nome).
  - Abaixo de cada etiqueta vai uma linha de **evidência com os números**.
- **Link**: o ícone `ExternalLink` ao lado do nome abre
  `productDetailPathname(grupo)` em nova aba, como no `ProfitRow.tsx`.
  - A etiqueta de estoque fantasma tem um "Contar ↗" que abre
    `productStockTabPathname(grupo, produto)`: a aba Estoque, já na variação,
    onde está a Contagem Física.
- **Recarregar**: botão `RefreshCw` que gira enquanto busca, no padrão do
  `ProfitFilters.tsx`, com "Atualizado às HH:MM" (`GeneratedAt`).
  - O hook liga explicitamente `refetchOnWindowFocus`. Quem corrige na outra aba
    e volta vê a lista refeita sozinha, desde que o dado tenha mais de 30 s
    (`staleTime` do admin). O botão continua para o "agora".
- **Ordem**: prioridade da etiqueta mais grave (tabela 2.2), depois unidades
  em estoque (maior primeiro), depois nome. Clicar no cabeçalho de "Estoque"
  ordena localmente (`BiColumnHeader`).
- **Estados**:
  - lista vazia: verde, com ícone e "Nenhuma anomalia no catálogo";
  - erro: a faixa vermelha das outras telas de BI;
  - carregando: `Spinner`.
- **Foto**: `ImageHoverZoom`, como no estoque baixo.
- **Tela estreita**: a coluna Estoque sai antes das etiquetas
  (`hidden 2xl:table-cell`). Etiqueta e link nunca saem.
- **Manual ("Como ler esta tela")**:
  - o que cada etiqueta quer dizer e como resolver;
  - a regra do fantasma com os números devolvidos em `Rules`;
  - a diferença para a Conferência de produtos: a conferência é a varredura com
    estado, feita aos poucos; a Anomalias é o radar sem estado;
  - o que a tela não sabe: bonificação com custo zero, queda real de procura.

### 7.5 Testes (mesmo commit)

- `lib`: todo tipo tem rótulo, ícone, cor e "como resolver"; enum desconhecido
  cai no fallback sem quebrar; a evidência sai com os números em pt-BR.
- Hook: chips, busca sem acento e sem caixa, contagens, campo omitido pela API.
- Componentes: etiqueta com ícone e texto; `href`, `target="_blank"` e
  `rel="noreferrer"` do link; recarregar gira quando busca; estado vazio verde;
  faixa de erro.
- Rotas: "Anomalias" primeira do BI e `SO_ADMIN`.

---

## 8. Base de conhecimento (`Uaus.Docs`), no fim

- `dominio/bi-e-decisoes.md`:
  - a sexta tela na tabela, na posição alfabética;
  - uma seção sobre a regra do fantasma: por que o relógio é a venda da loja, o
    teste retroativo e o que zera o relógio;
  - "descontinuado não é anomalia".
- `dominio/estoque-e-compras.md`: se D1-A, "toda contagem física fica
  registrada".
- `historico/2026-09-XX-bi-anomalias.md`, com link no índice do `README.md`.
- `pendencias.md`:
  - "Anormalidades do catálogo" sai para o histórico, riscada;
  - "Fotos faltando" passa a apontar para a tela;
  - os achados da seção 10 que o dono mandar anotar.

---

## 9. Entrega, verificação e freios

1. **Backend na `dev`**: regras, serviço, controller, DTOs e testes, com D1-A se
   aprovada.
   - Gates: `dotnet build` e `dotnet test`.
   - Teste temporário contra a dev: tradução e tempo.
   - O script aditivo entra no commit normal da `dev` e é listado no resumo.
2. **Admin na `dev`**: `api-client`, feature, página, rota e testes.
   - Gates: testes, typecheck, lint, `format:check` e build.
   - Este `PLANO-ANOMALIAS.md` sobe junto, formatado pelo Prettier.
3. **Smoke** no navegador embutido com a API apontada para a dev (config
   `admin-api-dev`). **O login é do dono**: o agente não digita senha.
   - O navegador embutido abre `target="_blank"` na mesma aba. O "nova aba"
     fica provado pelo teste de componente.
4. **Verificação adversarial independente** antes dos commits: subagente com o
   plano e os dois diffs. Os ataques são borda de tempo, contrato
   (nulo omitido), teste tautológico, tradução de LINQ e as armadilhas do
   `CLAUDE.md`. Cada achado é conferido no código e corrigido com teste de
   regressão.
5. **Docs**: commit e push no `Uaus.Docs`.
6. **Promoção para a `main`**: só quando o dono pedir (`git push origin
   dev:main`). **Ela carrega uma escrita em produção**, e o pedido de promoção
   precisa dizer isso (freio 2 do `CLAUDE.md` do backend): o script de boot
   `2026-09-23_publica_na_vitrine_cadastros_prontos.sql` roda sozinho no primeiro
   boot de produção e liga o "Exibir no site" de ~128 cadastros da loja no ar (só
   liga, nunca desliga; uma linha no histórico de cada um). O dono aprovou a
   publicação (D3, 23/09/2026); a promoção é o momento em que ela acontece.
   - O script de custo (D2-A) saiu do plano: a correção virou tela (D2).

Freios que valem aqui:

- gate vermelho não sobe;
- script destrutivo, promoção e configuração de deploy param e perguntam;
- `git add` só dos arquivos tocados, nominalmente.

---

## 10. Achados paralelos: ajusto agora ou deixo em pendências?

| #  | Achado | Repositório | Tamanho |
| -- | ------ | ----------- | ------- |
| A1 | Entrada e sobra de contagem **não devolvem "Sem estoque" para Ativo** quando o saldo volta. O ADAPTADOR T foi contado hoje (0 → 1) e o site continua escondendo | backend (`PurchaseEntryService`) | pequeno, com teste |
| A2 | `publicar_vitrine.py` lê `product_images`, aposentada em 12/09/2026 | backend (script de migração) | pequeno |
| A3 | Pôr a primeira foto num grupo com saldo **não liga "Exibir no site"**. É a origem dos 128 | admin (editor de produto) | pequeno: marcar o interruptor ao entrar a 1ª foto, e o operador desmarca se quiser |
| A4 | MINI PENDRIVE USB 16GB FIT (grupo 853): custo no cadastro R$ 14,38 contra R$ 11,49 no lote mais recente. Os lotes vieram do script manual de 06/09 sem recálculo | dados de produção | script de uma linha, ou a próxima entrada corrige sozinha |

---

## 11. O que NÃO entra nesta versão

- Persistir anomalia, lista ou resolução (decisão 2).
- Tela de correção de custo (D2-B), a não ser que o dono escolha.
- Contador de anomalias no painel ou no menu. A tela é consultada, não empurra
  alerta.
- Exportação XLSX. Se D2-A for a escolhida, a planilha dos custos sai de um
  script uma vez só.
- "Parou de vender com saldo alto" (seção 5, descartadas).
