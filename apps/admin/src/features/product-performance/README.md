# BI › Desempenho de Produtos (`features/product-performance`)

Os dois extremos do catálogo, lado a lado — e a decisão que cada produto está
pedindo.

Rota: `/bi/produtos` (`pages/product-performance.tsx`), `SO_ADMIN` porque a
resposta traz custo, lucro e margem item a item.

Dados: `GET /ProductPerformance` em
`packages/api-client/src/hooks/product-performance.ts`.

---

## O que ela responde que a curva ABC não responde

A curva ABC ordena por peso: **quem não vendeu não entra nela**, porque não há o
que acumular. Só que o produto que não vendeu e tem prateleira ocupada é
justamente o que custa dinheiro todo mês — medido em 07/09/2026, eram **390
produtos e R$ 9.653** parados, quase um terço do capital em estoque da loja.

Por isso o universo aqui é outro: **vendeu no período _ou_ tem saldo em casa**.
É essa diferença que faz existir uma lista dos piores.

A pergunta da tela é a seguinte à do ABC: não "quanto este produto pesa", mas
**"em qual produto eu mexo, e no quê"**.

---

## A nota, e por que ela mede contra a própria loja

Média ponderada de quatro componentes, cada um de 0 a 100. **Três medem o produto
contra a loja no período**, e não contra um alvo escrito à mão:

| Componente | Peso | Régua                                  |
| ---------- | ---- | -------------------------------------- |
| Giro       | 30%  | o sell-through da loja no período      |
| Margem     | 25%  | a margem média da loja                 |
| Resultado  | 25%  | o lucro médio por produto que vendeu   |
| Constância | 20%  | 60% das semanas do período (alvo fixo) |

A loja escoou **23,17%** do que tinha em noventa dias. Um alvo fixo de 25% ou de
50% decidiria, por fora, que a loja inteira vai bem ou vai mal — e a nota
deixaria de separar os produtos entre si, que é a única coisa que um ranking
precisa fazer.

A **constância** é a exceção, com alvo fixo, e é deliberado: numa loja de
variedades a maior parte do catálogo vende em uma ou duas semanas do trimestre, e
a média da loja arrastaria o alvo para tão baixo que "vendeu uma vez" viraria
nota cheia. O que se quer saber é se dá para **repor por média**, e isso não é
relativo aos vizinhos.

Quem não vendeu no período fica com zero, e as quatro parciais zeram junto — a
tela mostra a conta por extenso, e uma parcial sobrevivente ali seria uma
contradição na cara de quem lê.

---

## Os piores saem por dinheiro, não por nota

**Capital em risco** = custo na prateleira × (100 − nota) / 100 + prejuízo já
realizado.

Ordenar os piores pela nota empilharia no topo centenas de itens de cinco reais
que não venderam — todos com zero — e empurraria para a quarta página os
oitocentos reais parados num produto só. A pergunta desta lista é **onde está o
dinheiro**, e ela se responde em reais.

Duas consequências que valem estar escritas:

- **Produto `Destaque` nunca entra** na lista dos piores, por mais estoque que
  tenha. Uma lista chamada "piores" com o campeão de vendas dentro perde o leitor
  na primeira linha. O dinheiro dele continua contado no KPI de capital em risco.
- **Prejuízo entra em reais**, não como nota negativa. As parciais são de 0 a 100
  e a média ponderada precisa continuar sendo lida como percentual; o prejuízo
  não se perde, ele muda de coluna.

---

## As quatro decisões, e a ordem entre elas

Cada produto recebe **uma só** ação (`ProductScoreRules.ActionOf`, no backend).
Duas sugestões na mesma linha não são recomendação, são menu.

| Ação                    | Quando                                                             | O valor do card mede   |
| ----------------------- | ------------------------------------------------------------------ | ---------------------- |
| **Queimar estoque**     | prende dinheiro, gira abaixo da loja e o saldo dura mais de um ano | custo parado           |
| **Subir preço**         | nota ≥ 60 com margem abaixo de 30%                                 | lucro deixado na mesa  |
| **Repor**               | nota ≥ 60 e cobertura de até 21 dias (ou estoque zerado)           | faturamento do período |
| **Comprar semelhantes** | nota ≥ 60, margem ≥ 40% e giro acima do da loja                    | lucro já produzido     |

A ordem é escolhida. **Queimar** vem primeiro porque é o único caso com dinheiro
parado agora. **Subir o preço vem antes de repor**: um produto bom que vai faltar
_e_ vende com margem apertada precisa do preço corrigido antes da próxima compra
— repor primeiro compra mais do mesmo problema, e o preço maior ainda alivia a
falta.

"Queimar" não é só o produto parado. Um item que vendeu duas unidades em noventa
dias com R$ 800 na prateleira gira abaixo da loja e prende o mesmo dinheiro que o
parado; ficar de fora por ter vendido alguma coisa deixaria os casos caros sem
recomendação. O corte é **um ano de cobertura**: o esmalte com 92 unidades e oito
vendas leva 1.035 dias para acabar, tem nota 65 (margem e lucro ótimos) e sairia
como "manter" sem essa regra.

---

## Produto novo não é julgado

Quem entrou há menos de 21 dias e nunca vendeu fica **fora dos dois rankings** —
condená-lo mandaria queimar o estoque que acabou de chegar. O KPI diz quantos
são, para a exclusão não ser silenciosa.

"Há quantos dias está na loja" é a **mais antiga** entre a data de cadastro e a
primeira entrada de lote. As duas sozinhas erram para o mesmo lado: a reimportação
de 31/08/2026 carimbou 281 produtos com a mesma data de lote, e só por ela o
catálogo inteiro pareceria ter nascido naquele dia.

---

## Regras de tela

- **O período vai ao servidor.** Ele muda as réguas da loja e, com elas, a nota
  de todo mundo. Recortar depois deixaria a nota da tela sendo a nota de outro
  período.
- **Busca e ação em foco são locais.** Só estreitam as duas listas já pontuadas.
  Clicar de novo no mesmo card desfaz.
- **O recorte por ação usa a ação gravada na linha**, e não uma lista de ids
  devolvida junto com o card. Os dois caminhos dariam o mesmo resultado hoje e
  divergiriam no dia em que a regra mudasse de um lado só — o card dizendo "23
  produtos" e a tabela mostrando 19.
- **Os cards contam a loja inteira; as tabelas mostram os cem primeiros.** Por
  isso a tabela pode trazer menos linhas do que o card anuncia, e o manual da
  tela avisa isso.
- **Venda cancelada não conta.** Ela não tirou nada da prateleira, e contá-la
  faria um produto parado parecer que girou — o erro que a tela existe para não
  cometer.
- **Cor sempre com ícone ou texto.** A paleta é a comum das telas de BI
  (`@/lib/bi-tone`); o vocabulário está em
  `Uaus.Docs/dominio/convencoes-de-interface.md`.
