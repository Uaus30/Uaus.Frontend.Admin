# O que trouxe lucro (`/bi/o-que-trouxe-lucro`)

Os produtos que **sozinhos compõem metade do lucro** do período, com o motivo da
posição de cada um e o que fazer a respeito.

Só Admin (`SO_ADMIN`): a tela expõe custo, lucro e margem item a item.

---

## A pergunta, e por que a curva ABC não a responde

A Curva ABC corta em **80%** e descreve a _forma_ da distribuição — quantos por
cento do catálogo a loja precisou. É diagnóstico. Esta corta em **50%** e
descreve **o que fazer** com quem está dentro: medido em produção em 21/09/2026,
são 61 produtos de 538 em 90 dias, contra 208 no corte de 80%. Uma lista de 208
não decide nada.

**As duas medem o mesmo lucro** (`sale_items.Profit`, venda cancelada de fora), e
há teste no backend travando os totais das duas telas na mesma janela. Se
divergirem, é defeito — não diferença de método.

Difere do **painel** pelo desconto de cabeçalho, que o painel rateia e as telas
de produto não: R$ 61,45 em 90 dias, 0,26% do faturamento.

---

## As duas réguas

O ranking ordena por **lucro total**, mas cada linha se lê pela multiplicação que
o produziu: **peças × lucro por peça**. É o pedido central do dono, e existe
porque o agregado esconde o que decide:

|                  | Lucro     | Peças | Por peça | O que pede                 |
| ---------------- | --------- | ----- | -------- | -------------------------- |
| POTE OVAL        | R$ 222,75 | 275   | R$ 0,81  | reposição e ponto de venda |
| MANTA MICROFIBRA | R$ 150,48 | 14    | R$ 10,75 | variação e exposição       |

Os dois pesam quase igual no ranking. A mediana do corte (R$ 4,98 em 90 dias) é a
régua contra a qual cada linha é alta ou baixa — `readPerUnit` só fala quando a
linha está ao dobro ou à metade dela.

---

## Arquétipo e alerta são coisas diferentes

O **arquétipo** diz o que o produto é neste período; o **alerta** diz o que olhar
nele. O backend decide os dois (`ProfitLeaderRules`); o front só traduz em cor e
palavra.

| Arquétipo              | Quando                                                      |
| ---------------------- | ----------------------------------------------------------- |
| `Newcomer`             | primeira venda da história na **segunda metade** do período |
| `Rising` / `Declining` | ritmo diário do **último quarto** contra o do resto, ±30%   |
| `Workhorse`            | vendeu em ≥60% das **semanas**, sem tendência               |
| `Steady`               | o resto                                                     |

Três decisões que parecem detalhe e não são — as três vieram de rodar contra a
dev, com os testes verdes:

- **Estreia contra o MEIO do período, não contra o início.** Em "desde a
  inauguração" a janela começa na primeira venda da loja, então _todo_ produto
  estreou dentro dela: os cinco primeiros saíam como achado novo, inclusive a
  camiseta da Copa, que já tinha morrido.
- **Constância medida em SEMANAS, não nos intervalos do gráfico.** O intervalo
  muda com o período (dia, semana, mês) e levaria a definição junto — "vendeu em
  60% dos dias" quase ninguém cruza; "60% dos meses" quase todos.
- **Tendência pelo último quarto, não por metades.** Metade contra metade quebra
  em sete meses: as metades têm 100 dias cada e o pico de junho cai na segunda, e
  a camiseta da Copa saía como "em ascensão".

Alerta, por precedência: caindo **com** saldo → `ParkedStock` (investigar a
procura); caindo **sem** saldo → `StockOut` (comprar, não investigar); não
caindo com cobertura < 45 dias → `LowCoverage`.

---

## Cor: aqui não existe produto ruim

Todo item chegou ao corte. Os selos não julgam o produto — apontam o que olhar.

- **Âmbar** é o padrão de todo ponto de atenção.
- **Vermelho** só quando **queda forte e dinheiro parado se somam**
  (`HEAVY_DROP` −50% e `HEAVY_PARKED_COST` R$ 300). Se tudo que preocupa fosse
  vermelho, nada seria.
- **Verde** por **força do sinal de ascensão**, não por qualidade geral: esta já
  está codificada na POSIÇÃO, e pintá-la de novo gasta o contraste.

Vocabulário em `@/lib/bi-tone`. **Cor nunca sozinha**: toda pílula sai com ícone
e texto — esta é uma tela que se imprime para levar ao balcão.

**E isso vale para o SEGUNDO passo da escala também.** Duas linhas, uma com −20%
e R$ 100 parados e outra com −60% e R$ 500, renderizavam as mesmas pílulas, os
mesmos ícones e a mesma frase: a única diferença era o matiz. Impressa em preto e
branco, a reserva mais importante da tela desaparecia. Por isso `alertBadgeLabel`
escreve **"· urgente"** quando `isEscalated`.

**Todo acesso a mapa de enum passa por `??`.** Um membro novo no enum do backend
devolvia `undefined`, e `<Icon />` com `undefined` estoura em tempo de render: o
`ErrorBoundary` da rota troca a **tela inteira** pela de recuperação. Pelo mesmo
motivo, `leaderTone` decide o positivo por **lista** e não por exclusão — senão um
arquétipo novo e negativo nasceria pintado de verde.

---

## O que é do servidor e o que é local

- **Período** vai ao servidor como **número** (`ProfitLeadersPeriod`). Trocá-lo
  refaz o corte, e o conjunto de líderes muda com ele. `AllTime` só o banco
  resolve — a primeira venda da loja não está na tela. Manter o cálculo lá
  também evita montar data de calendário com `toISOString()` (armadilha 2).
- **Busca e filtro de arquétipo** são locais, sobre as poucas dezenas
  carregadas. **Filtrar não renumera**: a 12ª linha continua sendo a 12ª.
- **O pódio é do período, não da busca.**

---

## O gráfico por linha

SVG à mão (`ProfitSparkline`), não biblioteca de chart: são até 60 instâncias
numa página, e montar 60 gráficos de uma biblioteca é peso que a loja sente no
celular para desenhar treze pontos.

O intervalo do eixo X é escolhido pelo backend — a maior granularidade que renda
5 pontos (mês, semana, dia). Abaixo de 4, não há gráfico e a tela diz isso.

**Intervalo parcial sai tracejado e com o ponto vazado.** O último quase sempre
é: em 30 dias a quinta semana cobre dois dias. Sem a marca, o gráfico de _todo_
produto da tela termina num mergulho que não aconteceu — e é o fim da linha que
se olha para decidir se o produto ainda vende. O **primeiro** também é parcial em
"desde a inauguração" (a loja abriu em 05/03 e março começa no dia 1º), e por isso
o trecho é tracejado quando **qualquer uma** das duas pontas é parcial.

**A escala inclui o piso, não só o teto.** Com `Math.max` sozinho, um intervalo de
prejuízo — uma liquidação abaixo do custo, que o banco produz — era desenhado
_fora_ do `viewBox`, por cima da linha seguinte do ranking. E o preenchimento
desce até a linha do **zero**, não até o fundo: com prejuízo, o fundo deixa de ser
o zero, e pintar até lá afirmaria lucro onde houve perda.

---

## Fatia é sobre o lucro GERADO, não sobre o líquido

`summary.profit` é o líquido (prejuízo descontado) — o que a loja ganhou.
`summary.generatedProfit` trunca o prejuízo em zero, e **é a base de todas as
fatias**.

Os dois precisam existir porque numerador e denominador têm de vir do mesmo
conjunto: só produto com lucro positivo entra no ranking. Dividindo pelo líquido,
um período com +R$ 100 num produto e −R$ 90 em outro imprimia **"1000% do lucro
do período"**, e o número tende ao infinito conforme o prejuízo se aproxima do
lucro. Na prática os dois quase coincidem — em 90 dias na dev, R$ 8.776,12 contra
R$ 8.775,65.

---

## O que a tela não sabe

Não distingue **queda sazonal de queda estrutural**. A primeira venda do sistema
é de 05/03/2026 e não existe o mesmo período do ano anterior. A camiseta da Copa
depois da Copa e um produto que perdeu a graça desenham o mesmo gráfico — só o
calendário da loja separa os dois.
