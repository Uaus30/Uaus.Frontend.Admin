# BI › Desempenho de Produtos (`features/product-performance`)

Os dois extremos do catálogo, lado a lado — e a decisão que cada produto está
pedindo.

Rota: `/bi/produtos` (`pages/product-performance.tsx`), `SO_ADMIN` porque a
resposta traz custo, lucro e margem item a item.

Dados: `packages/api-client/src/hooks/product-performance.ts`. São **dois
caminhos para o mesmo relatório**:

| Endpoint                         | Quando                   | Medido em 13/09/2026 |
| -------------------------------- | ------------------------ | -------------------- |
| `GET /ProductPerformance/ultima` | período padrão (90 dias) | ~340 ms              |
| `GET /ProductPerformance`        | qualquer outro período   | ~1.190 ms            |

O primeiro lê a **apuração diária guardada** (tirada às 19h pelo worker do
backend); o segundo calcula ao vivo. A conta é a mesma dos dois lados — a
apuração é produzida pelo mesmo serviço —, então eles **não podem divergir por
implementação, só por idade**. É por isso que a tela mostra uma tarja dizendo de
quando é a foto (`snapshotAt`) ou "ao vivo", em vez de esconder a diferença:
quem acabou de receber uma entrada precisa saber que o saldo é o de ontem às 19h
antes de mandar queimar alguma coisa.

**Só o preset de 90 dias usa a foto**, porque é a janela que o worker apura.
Trocar para 30 dias muda as réguas da loja e reclassifica todo mundo — não há
foto que sirva.

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

Média ponderada de seis componentes, cada um de 0 a 100. **Cinco medem o produto
contra a loja no período**, e não contra um alvo escrito à mão:

| Componente   | Peso | Régua                                             |
| ------------ | ---- | ------------------------------------------------- |
| Giro         | 22%  | o sell-through da loja no período                 |
| Margem       | 18%  | a margem média da loja                            |
| Resultado    | 18%  | o lucro médio por produto que vendeu              |
| Constância   | 14%  | 60% das semanas do período (alvo fixo)            |
| **Capital**  | 16%  | o custo de prateleira médio por produto com saldo |
| **Liquidez** | 12%  | os dias que o estoque da loja inteira cobre       |

As quatro primeiras somam **72%** e mantêm entre si a proporção calibrada
original (30/25/25/20). Esse bloco tem nome — `SaleWeight`, no backend — porque
ele é usado duas vezes: para compor a nota e para renormalizar a **nota de
venda**, que é o que pesa o capital em risco.

A loja escoou **23,17%** do que tinha em noventa dias. Um alvo fixo de 25% ou de
50% decidiria, por fora, que a loja inteira vai bem ou vai mal — e a nota
deixaria de separar os produtos entre si, que é a única coisa que um ranking
precisa fazer.

A **constância** é a exceção, com alvo fixo, e é deliberado: numa loja de
variedades a maior parte do catálogo vende em uma ou duas semanas do trimestre, e
a média da loja arrastaria o alvo para tão baixo que "vendeu uma vez" viraria
nota cheia. O que se quer saber é se dá para **repor por média**, e isso não é
relativo aos vizinhos.

### Capital e liquidez existem para DESEMPATAR

Os dois entraram em 13/09/2026, quando a nota virou a ordem dos rankings. Antes,
quem não vendia no período recebia zero por atalho: **390 produtos parados com a
mesma nota**, e nenhuma maneira de dizer qual é o pior.

Hoje o atalho não existe. Quem não vendeu chega às quatro medidas de venda com
valores que já valem zero — a conta por extenso continua honesta —, e o que o
posiciona são capital e liquidez:

```
capital  = 100 × média / (média + custo na prateleira)
liquidez = 100 × cobertura da loja / (cobertura da loja + dias que o saldo dura)
```

A forma é hiperbólica, e não uma razão cortada em 0 e 100, por duas razões:

- **Não satura.** Um corte em 100 empataria todo mundo que prende pouco; um corte
  em 0 empataria todo mundo que prende muito — as duas pontas que a lista precisa
  separar. R$ 800 e R$ 810 numa loja de média R$ 25 valem 3,03 e 3,00.
- **Lê-se direto.** Quem está na média da loja tira 50; o dobro tira 33; a metade
  tira 67. É a mesma filosofia das outras quatro: medir contra a própria loja.

**Quem não vendeu no período não tem cobertura** — não há ritmo para dividir — e
aí a liquidez responde pelo outro lado: **há quanto tempo o produto está
parado**, com teto em 50, para nenhum parado passar à frente de quem vendeu.
Quem nunca vendeu na vida fica com zero de verdade: dele não há evidência
nenhuma.

---

## Os dois rankings saem pela nota

Os melhores descem da maior para a menor; os piores sobem da menor para a maior.
A posição é **sempre** a nota — foi o pedido que originou a mudança: com a ordem
por dinheiro, a coluna "situação" descia embaralhada, e um `Regular` de R$ 400
aparecia acima de um `Parado` de R$ 30.

A tela mostra a nota com **uma casa decimal**, e a casa não é enfeite: é ela que
torna a ordem legível. Arredondada para inteiro, meia dúzia de parados seguidos
aparece como "4, 4, 4" quando o que os separa é 4,1 · 3,9 · 3,6.

**Capital em risco** = custo na prateleira × (100 − **nota de venda**) / 100 +
prejuízo já realizado.

Ele deixou de ordenar a lista e continua respondendo **quanto**, em reais, depois
que a ordem já respondeu **quem**. O peso é a nota de venda, e não a nota cheia,
porque esta já desconta o capital parado — usá-la aqui contaria o mesmo dinheiro
duas vezes e mudaria o patamar de um número que o dono já conhece.

Três consequências que valem estar escritas:

- **Produto `Destaque` nunca entra** na lista dos piores, por mais estoque que
  tenha. Uma lista chamada "piores" com o campeão de vendas dentro perde o leitor
  na primeira linha. O dinheiro dele continua contado no KPI de capital em risco.
- **Não há mais filtro por capital em risco.** O antigo (`> 0`) tirava da lista,
  em silêncio, o produto com saldo e nenhum lote cadastrado — o custo dele sai
  zero, e ele podia estar parado havia meses.
- **Prejuízo entra em reais**, não como nota negativa. As parciais são de 0 a 100
  e a média ponderada precisa continuar sendo lida como percentual; o prejuízo
  não se perde, ele muda de coluna.

---

## Ordenar clicando na coluna

`lib/ranking-sort.ts`. Respondem ao clique: **Produto, Nota, Em risco, Vendidos,
Faturamento, Margem, Estoque e Dura**; clicar de novo inverte. Situação, giro,
lucro e ação sugerida ficam de fora — as três primeiras não acrescentam ângulo
que as outras já não deem, e ação é rótulo, não medida.

- **A ordenação é local**, sobre as cem linhas que já chegaram classificadas.
  Pedir outra ordem ao servidor traria outras cem linhas e trocaria o conjunto
  debaixo do leitor: quem clica em "Em risco" quer o dinheiro **dos cem piores**,
  não os cem maiores capitais em risco da loja.
- **O desempate é a posição de origem.** É o que faz "Nota" na direção padrão
  devolver exatamente a ordem que o servidor numerou, inclusive entre linhas de
  mesma nota — que o servidor já desempatou por capital em risco e por nome.
- **A coluna `#` continua sendo a posição por nota**, mesmo com a tabela ordenada
  por outra coisa. É informação: um `#47` no topo da ordem por estoque diz que
  aquele produto não está entre os piores, mas é o que mais ocupa prateleira.
- **Cada valor ordena pelo número que a célula mostra.** Duas exceções, e as duas
  são leitura da própria célula: em "Dura", `esgotado` vale zero (já acabou) e
  `sem giro` vale infinito (não acaba nunca); em "Margem", quem não vendeu mostra
  "—" e vai para o fim nas duas direções — "não se aplica" não é 0%.

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
- **Busca, ação em foco e ordenação são locais.** Só estreitam ou reordenam as
  duas listas já pontuadas. Clicar de novo no mesmo card desfaz.
- **As duas tabelas ordenam separado.** O estado da ordenação vive em
  `ProductRankingTable`, e não no hook da tela: olhar os piores por estoque não
  tem por que mexer na lista dos melhores, que está respondendo outra pergunta na
  mesma rolagem.
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
