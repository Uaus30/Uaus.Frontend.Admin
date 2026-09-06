# BI › Desempenho de Fornecedores (`features/supplier-performance`)

Ranking de fornecedores por nota, com a análise de cada um em tela própria. É a
primeira tela do grupo **BI** do menu.

Duas rotas, declaradas em `apps/admin/src/routes.ts`:

- `/bi/fornecedores` — o ranking (`pages/supplier-performance.tsx`)
- `/bi/fornecedores/:id` — o detalhe (`pages/supplier-performance-detail.tsx`)

As duas são `SO_ADMIN`: a resposta traz custo, margem e lucro por fornecedor, que
não é assunto de operador de caixa. O backend recusa de qualquer forma — a
restrição na rota evita a tela abrir só para mostrar 403.

---

## De onde vêm os números

`GET /SupplierPerformance` e `GET /SupplierPerformance/{id}` moram em
`packages/api-client/src/hooks/supplier-performance.ts` e chegam aqui como
`useGetSupplierPerformance` e `useGetSupplierPerformanceDetail`.

**A atribuição não é estimativa.** Faturamento e lucro chegam ao fornecedor pelo
caminho `venda → item → lote de estoque → fornecedor`: o lote consumido em cada
venda está gravado, com o custo daquele lote. O mesmo produto comprado de dois
fornecedores rende a cada um o que saiu do lote dele.

Por isso o denominador da participação é a soma do que foi **atribuído**, e não
`Sale.Total`: com desconto de cabeçalho ou cupom os dois divergem, e os
percentuais não fechariam 100%.

---

## A nota, e por que ela é comparativa

Média ponderada de quatro componentes, todos de 0 a 100:

| Componente            | Peso | Régua                                                        |
| --------------------- | ---- | ------------------------------------------------------------ |
| Aproveitamento do mix | 30%  | produtos que vendem com margem ≥ 40%, contra a média da loja |
| Margem                | 25%  | quanto da margem média da loja o fornecedor alcança          |
| Giro                  | 25%  | quanto do estoque saiu no período (alvo 25%)                 |
| Resultado             | 20%  | lucro contra o lucro médio por fornecedor ativo              |

Os pesos e as réguas **vêm do servidor** dentro de `parameters`, e a tela usa
esses valores para explicar cada nota. Repetir os números aqui criaria duas
verdades sobre a mesma regra, e a primeira a divergir em silêncio seria a
explicação — não o cálculo.

### Todas as réguas são a própria loja

Margem e resultado já foram medidos contra um alvo fixo (50%) e contra o melhor
fornecedor. Os dois saíram:

- **Alvo fixo de margem** dava nota 75 a um fornecedor com 28,9% de margem numa
  loja que gira 41,7%. Ninguém consegue defender esse número olhando para os dois
  lados da tela. Hoje a linha se lê sozinha: 28,9 sobre 41,7 é 69% da média,
  nota 69.
- **Melhor fornecedor** como régua do resultado condenava todo mundo numa loja em
  que um deles faz 75% do lucro — por um motivo que não é desempenho dos outros.

Consequência a saber: com a régua na média, a margem passa a **punir quem está
abaixo** em vez de premiar quem está acima. Quem alcança a média bate no teto.

### Amostra pequena não vira primeiro lugar

O aproveitamento é puxado para a nota média da loja pela confiança que a amostra
merece — `julgados / (julgados + 8)`. Sem isso, um fornecedor com um único
produto julgado que por acaso vendeu bem marca 100% e sobe ao topo.

Somar produtos fictícios à média (o encolhimento clássico) não resolvia sozinho:
um acerto em uma tentativa continua sendo evidência forte contra uma média baixa,
e 1/1 ainda batia 90/300. O que separa os dois é a **confiança**, e é ela que o
fator mede. O teste `SupplierScoreRulesTests` no backend guarda essa propriedade.

**Quem não vendeu no período fica com zero**, no fim da lista — os ajustes
dariam nota de média a quem não vendeu nada.

---

## Regras de tela

### O filtro decide o que o servidor calcula

Período e "somente recorrentes" vão na **consulta**. A nota é comparativa: filtrar
depois, sobre a resposta já pronta, deixaria cada nota medida contra uma loja que
a tela não está mostrando. Ordenação e "mostrar quem não vendeu" são locais — não
mexem em número nenhum.

### O detalhe carrega o conjunto inteiro

`GET /SupplierPerformance/{id}` calcula todos os fornecedores e devolve o mix de
um só. Sem isso, os componentes comparativos dariam valores diferentes no detalhe
e no ranking, para o mesmo fornecedor e o mesmo período.

### Motivos em texto, notas parciais no detalhe

A listagem mostrava as quatro notas parciais como números soltos (`margem 58`) ao
lado da margem real (`42,2%`) — duas coisas com o mesmo nome e valores diferentes.
Hoje a linha traz até **três frases** (`lib/reasons.ts`), escolhidas pelo quanto o
fato destoa da loja, com os dois lados garantidos quando os dois existem. As notas
parciais ficaram no detalhe, onde cabe dizer de onde saem.

### Cor da nota nunca é o único canal

A rampa percorre exatamente o par vermelho/verde que a deficiência de cor mais
comum não distingue. Por isso o anel sempre traz o **número** e o **rótulo**
(`lib/score.ts`); a cor só acelera a leitura de quem enxerga.

---

## Classificação de produto

| Classe       | Regra                              | Entra no aproveitamento? |
| ------------ | ---------------------------------- | ------------------------ |
| Bom          | vendeu no período com margem ≥ 40% | sim, a favor             |
| Margem baixa | vendeu com margem < 40%            | sim, contra              |
| Parado       | tem estoque e não vendeu           | sim, contra              |
| Novo         | entrou há ≤ 21 dias e nunca vendeu | **não**                  |
| Inativo      | sem estoque e sem venda            | **não**                  |

Os dois últimos ficam fora porque o percentual mentiria: produto novo ainda não
teve chance de vender, e produto sem estoque não tinha como vender.

---

## O que NÃO está aqui

**Alerta de concentração de faturamento.** Existiu na primeira versão e saiu: o
fornecedor concentrador da loja é um marketplace, com vários vendedores atrás do
mesmo nome, e chamar aquilo de "risco de depender de um fornecedor só" é falso. A
marca `isMarketplace` no cadastro é o que separa os dois casos — ela também é o
que faz a **compra exigir o link do anúncio** fora de Pendente
(`features/purchases`).
