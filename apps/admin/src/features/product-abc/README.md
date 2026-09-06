# BI › Curva ABC de Produtos (`features/product-abc`)

Aplica o Princípio de Pareto ao catálogo — **medindo, e não presumindo**.

Rota: `/bi/curva-abc` (`pages/product-abc.tsx`), `SO_ADMIN` porque a resposta traz
lucro e margem item a item.

Dados: `GET /ProductAbc` em `packages/api-client/src/hooks/product-abc.ts`.

---

## A pergunta que a tela responde

Não "quais são os 20% que fazem 80%", que é a regra presumida, mas **quantos por
cento dos produtos esta loja precisou** para chegar a 80%. Na loja, medido em 90
dias, esse número é **38%** — quase o dobro do previsto. Presumir 20 faria a tela
mentir sobre o próprio estoque, e a decisão que sai daí ("corte a cauda") seria
tomada sobre um número que ninguém verificou.

Por isso a manchete é `38/80` e não "80/20", e a régua ao lado marca onde a regra
clássica cairia.

---

## Duas classificações, não uma

Cada produto recebe classe **por faturamento** e **por lucro**. O cruzamento das
duas é a matriz — e é o que a curva sozinha não mostra: ordenada por faturamento,
a lista exibe como campeão o item que vende muito e lucra pouco, porque o número
que o classificou nunca olhou para a margem.

Fora da diagonal as duas leituras discordam:

- **acima** (fatura melhor do que lucra) — as _armadilhas de faturamento_
- **abaixo** (lucra melhor do que fatura) — as _joias escondidas_

Trocar o critério no filtro reordena a curva, mas **não muda** `revenueClass` e
`profitClass`: elas são a base da matriz, e mudar junto faria a matriz depender
do filtro em vez de descrever a loja.

---

## O gráfico não é o Pareto clássico

O gráfico de Pareto tradicional põe barras em reais e a linha acumulada em
porcentagem em **dois eixos**, e o alinhamento entre as duas escalas é arbitrário
— o desenho passa a sugerir uma relação que não está no dado.

Aqui os dois eixos são percentuais acumulados: X é a fatia do catálogo, Y é a
fatia do resultado. Um eixo só, duas séries na mesma escala, mais a diagonal de
referência (onde todo produto venderia igual). É a leitura de **Lorenz**, a mesma
de que sai o índice de concentração (**Gini**) do cabeçalho.

O Gini existe porque "80/20" é a leitura de UM ponto da curva: duas lojas podem
cruzar os 80% no mesmo lugar com caudas completamente diferentes.

---

## Os quatro achados

Nenhum cabe numa coluna da tabela — todos comparam o produto com outra coisa.

| Achado                    | O que é                                                         |
| ------------------------- | --------------------------------------------------------------- |
| Armadilhas de faturamento | classe A em faturamento, fora da classe A de lucro              |
| Joias escondidas          | fora da classe A de faturamento, classe A em lucro              |
| **Cauda que puxa cesta**  | itens da cauda que só aparecem em compras acima do ticket médio |
| Capital na cauda          | quanto do estoque está imobilizado em produtos classe C         |

O terceiro é a defesa da cauda longa e o motivo de a coluna `cesta` existir:
cortar um item que aparece em cestas 60% maiores que a média **não economiza o
que ele custa** — a cesta inteira vem junto. Sem esse número, "classe C" vira
sinônimo de "cortar", e a decisão sai errada.

---

## Regras de tela

- **Período e critério vão ao servidor.** Os dois reclassificam todo mundo;
  recortar depois deixaria a classe A da tela sendo a classe A de outro recorte.
- **Célula, classe, achado e busca são locais.** Só estreitam a lista já
  classificada. Clicar de novo no mesmo alvo desfaz o recorte.
- **Prejuízo entra como zero na curva de lucro.** Um valor negativo faria o
  acumulado andar para trás, e a classe deixaria de acompanhar a ordem — um item
  pior que o anterior poderia sair com classe melhor.
- **A cor das classes é uma matiz só, em três passos.** A/B/C têm ordem: é escala
  ordinal, não identidade. Três matizes diferentes gastariam o canal de cor para
  recodificar o que o próprio rótulo já diz.
- **A curva vem amostrada em até 160 pontos.** Uma linha de 700px não ganha nada
  com mil pontos, e a resposta triplicaria; as duas pontas entram sempre.
