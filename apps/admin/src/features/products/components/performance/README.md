# Aba Desempenho (`products/components/performance`)

A quarta aba da tela do produto. Duas perguntas, nesta ordem:

1. **Como este produto está hoje** — o velocímetro e a decisão sugerida.
2. **O que eu fiz funcionou** — o gráfico da nota dia a dia.

A segunda é a razão de tudo isso existir. Até a apuração diária, tomar a decisão
("queimei o estoque", "subi o preço") e medir o efeito eram coisas separadas por
um vazio: nenhuma tela do sistema guardava o antes.

Dados: `GET /ProductPerformance/produto/{id}` — a foto e a série numa chamada só,
porque as duas leem a mesma tabela e separá-las faria a aba abrir em dois tempos,
com o velocímetro pulando quando o gráfico chegasse.

---

## Por que a aba lê, e não calcula

A nota depende de **cinco réguas da loja inteira** (giro, margem, lucro médio por
produto vendido, custo de prateleira médio, cobertura). Calculá-la aqui custaria
varrer o catálogo a cada produto aberto — medido em 13/09/2026: ~1.190 ms com 888
produtos.

A aba lê a apuração guardada, que já veio pronta. É por isso que ela abre
instantânea, e é a mesma razão pela qual **produto ainda não apurado mostra uma
frase, e não um velocímetro em zero**: nota zero seria um juízo que ninguém fez.

---

## O velocímetro

`ScoreGauge.tsx`. A geometria e o estilo vêm do **velocímetro do Prisma**
(`C:\Projects\Wagner\Prisma`, `app/src/componentes/graficos/Velocimetro.tsx`), a
pedido do dono. O que foi trazido de lá:

- Trilha em degradê apagado (16%) mostrando a escala inteira, trecho aceso com
  brilho por cima.
- **Marcador correndo POR CIMA do arco**, em vez de agulha presa no centro. A
  decisão é do Prisma e o motivo é concreto: a agulha clássica risca o número —
  em 58 ela passa exatamente por cima dos dois dígitos, e encurtá-la só empurra o
  problema para as pontas, onde bate na palavra.
- A palavra da faixa dentro do arco ("Parado", "Regular", "Destaque").
- SVG puro, sem Recharts: um arco e um marcador não justificam a biblioteca.

A **única** adaptação é o disparo da animação: o Prisma usa
`requestAnimationFrame`, e aqui é `setTimeout`. O navegador embutido do app não
roda `rAF` nem com a aba visível — com ele o medidor ficaria parado em zero,
**mostrando o número errado**, e não apenas sem animação.

Degradê (vermelho–âmbar–verde em 0/50/100) e marcas (20, 40, 60, 80) são os do
Prisma. A cor é contínua e **não afirma a faixa** do produto; quem afirma é a
palavra dentro do arco, que sai dos cortes do backend (40 e 70). Fosse a cor a
dizer a faixa, ela teria que saltar nos cortes e o medidor perderia o degradê
que o torna legível de relance.

---

## Armadilha que custou uma rodada

**As variáveis de cor do tema são triplas HSL sem a função.** `--muted` é
`222 47% 13%`, e não uma cor. Em SVG, `stroke="var(--muted)"` resolve para
`none`: o arco simplesmente não aparece, **sem erro nenhum no console**. O certo
é `hsl(var(--muted))`, como nos gráficos do painel.

---

## O gráfico

`ScoreHistoryChart.tsx`, Recharts (já estava no admin).

- **Eixo de 0 a 100 fixo.** Escala automática faria uma variação de dois pontos
  parecer um tombo — o jeito mais rápido de um gráfico mentir.
- **As duas linhas horizontais são os cortes das faixas**, e não grade
  decorativa: sem elas, subir de 38 para 44 e de 50 para 56 têm a mesma cara,
  quando a primeira mudou a situação do produto e a segunda não.
- `isAnimationActive={false}` pelo mesmo motivo do velocímetro.
