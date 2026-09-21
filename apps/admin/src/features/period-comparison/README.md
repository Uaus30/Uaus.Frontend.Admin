# BI › O que mudou (`features/period-comparison`)

A quarta tela do menu BI, e a única que **subtrai um período do outro**. Consome
`/PeriodComparison` e não tem dado simulado.

---

## Por que ela existe

As outras três telas de BI descrevem **um** período: quanto do resultado vem de
quantos produtos, de quem vale continuar comprando, em qual produto mexer.
Nenhuma responde por que o mês fechou diferente do anterior — e **abrir duas
execuções da mesma tela lado a lado não responde**, porque as réguas do BI são
medidas contra a própria loja no período: trocar o período reclassifica todo
mundo (`Uaus.Docs/dominio/bi-e-decisoes.md`).

Aqui a régua é o período de referência, e tudo sai em **reais**. A pergunta é "de
onde vieram os R$ 2.800 que faltaram", e nota de 0 a 10 não soma.

---

## Os quatro blocos

Cada um reparte a **mesma** diferença por um corte diferente, e cada corte leva a
uma ação diferente.

| Bloco        | Componente      | O que reparte                                    |
| ------------ | --------------- | ------------------------------------------------ |
| A ponte      | `RevenueBridge` | entre os 4 fatores que multiplicam o faturamento |
| Mix ou preço | `MixPricePanel` | a variação do valor por peça, em duas causas     |
| Itens-evento | `EventItems`    | o que um único item fez com o período            |
| Quem mudou   | `ChangeTable`   | entre as linhas da dimensão escolhida            |

---

## Regras de negócio

### 1. Faturamento é o mesmo número do painel

`Σ sales.total`, já líquido do desconto de cabeçalho, pela mesma conta oficial
que o painel e o fechamento financeiro usam. Vendas canceladas ficam fora dos
dois lados.

As quebras nascem dos **itens**, e por isso o backend rateia o desconto de
cabeçalho antes de dividir: sem isso a soma das fatias fica maior que o
faturamento, e uma tela que promete "a soma das linhas é a diferença" perde o
direito de prometer.

### 2. Os quatro fatores multiplicam, e por isso repartem

```
faturamento com item = dias abertos × cupons por dia × peças por cupom × valor por peça
faturamento          = faturamento com item + faturamento sem item
```

É uma identidade, não um modelo: cada denominador é o numerador do fator
anterior. Se o faturamento mudou, pelo menos um dos quatro mudou.

**A base dos quatro fatores é o faturamento COM ITEM**, e o que foi cobrado sem
item entra como quinta parcela, somada — sem peça não há "por peça". A tela só
desenha essa quinta barra quando ela não é zero. Com os quatro medindo o
faturamento inteiro, um período com faturamento e zero peças zerava o produto dos
fatores e o arredondamento despejava a diferença na maior barra: a tela chegou a
creditar **+R$ 77,60 de crescimento a "peças por cupom"** com a cesta caindo de
10 para 0.

**A repartição é a média de todas as 24 ordens possíveis de substituição** (valor
de Shapley), calculada no backend. A ponte sequencial — trocar um fator por vez
numa ordem fixa — é mais fácil de conferir na mão, mas entrega ao último fator
trocado todo o efeito combinado, e a mesma realidade muda de causa conforme a
ordem escolhida. Em agosto de 2026 a cesta cresceu 22% enquanto o valor da peça
caía 39%: conforme a ordem, a mesma medição atribuiria de R$ 800 a R$ 1.200 a
mais ou a menos para cada um dos dois.

O preço disso é que o número não se refaz na calculadora. Por isso **o valor cru
de cada fator aparece ao lado da barra** (13,56 → 12,77 cupons por dia): é o fato
que se confere, e é dele que sai a decisão.

### 3. "Dias abertos" é o dia em que a loja vendeu

Não existe registro de expediente no sistema. Um dia aberto que não vendeu nada
conta como fechado — numa loja de doze cupons por dia, a aproximação é segura, e
é a única que o banco permite.

É o denominador certo para o movimento: comparar um mês de 26 dias com um recorte
de 17 por "cupons no período" mede calendário, não loja.

### 4. Mix e preço pedem ações opostas — e a régua é FIXA

- **Mix** — a loja passou a vender outras linhas. Corrige-se comprando diferente.
- **Preço** — a mesma linha saiu por outro valor. Corrige-se precificando
  diferente, ou olhando desconto e promoção.

Somados, reproduzem exatamente a variação do valor por peça. Linha que não
existia no período de referência entra **inteira no mix**: ela não encareceu nem
barateou, a loja é que passou a vendê-la.

**O bloco mede sempre por categoria**, mesmo quando a tabela está quebrada por
outra dimensão. A fronteira entre mix e preço _é_ a granularidade: o que numa
régua grossa aparece como preço (o departamento Casa ficou mais barato) numa
régua fina vira mix (vendi outros produtos dentro de Casa), e no limite do
produto quase tudo é mix, porque o preço de um produto quase não varia. Medido na
dev em jul→ago/2026: **por produto, mix −R$ 2.612 e preço +R$ 37; por fornecedor,
mix −R$ 74 e preço −R$ 2.501** — a mesma loja, no mesmo período. Se a régua
seguisse o seletor da tabela, a recomendação se inverteria quando o usuário
trocasse o seletor para olhar _outro_ bloco.

Os valores em reais (`mixAmount`/`priceAmount`) respondem "quanto custou **se
todo o resto tivesse ficado igual**". Eles **não somam** com a barra "valor por
peça" da ponte, que reparte também o efeito cruzado com os outros três fatores.

### 5. A tabela soma a diferença inteira

É o que separa esta tabela de um ranking. O que não cabe nas primeiras 60 linhas
vira "outras N linhas" em vez de sumir — com participação e situação **somadas
das linhas que entraram**, não zeradas: um balde com 58% do faturamento exibido
como "0,0% → 0,0%" e etiquetado "Estável" sobre uma queda real é a tela afirmando
o contrário do que mediu.

A linha **"Sem item identificado"** mostra o faturamento cobrado sem item
correspondente no banco — sete vendas migradas do Mais PDV, entre março e junho
de 2026. Ela repete exatamente o número da barra "venda sem item" da ponte: sai
de `unattributedRevenue`, e não da diferença entre duas somas arredondadas, que
fazia a linha nascer valendo R$ 0,01 em período sem defeito nenhum e reportar
92,21, 92,22 ou 92,23 para o mesmo dinheiro conforme a dimensão.

Na dimensão fornecedor há um balde irmão, **"Sem fornecedor no lote"**, para o
item vendido sem lote atribuído (2 itens em produção, R$ 16): antes ele era
pulado no rateio e reaparecia como se a venda não tivesse item.

**Os baldes nomeados ficam fora do corte** (`isBucket` no contrato). Eles
disputavam vaga por módulo do Δ como qualquer linha e perdiam justamente onde há
linhas demais — Categoria, que é o padrão do endpoint, e Produto: a ponte nomeava
o faturamento sem item logo acima e a tabela o escondia dentro de "Outras N
linhas".

A ordem padrão é **crescente pelo Δ**, com a maior perda no topo. É o contrário
de todo ranking do sistema, e de propósito: a pergunta que traz alguém aqui quase
sempre é sobre o que faltou. **Com a busca ativa o cabeçalho para de prometer a
soma** — filtrada, a coluna soma um subconjunto.

### 6. Item-evento é o que não se repete

Produto que passou de **5%** do faturamento de um dos lados **e ficou abaixo de
2% no outro**. Os dois limiares importam: só "cresceu mais que o dobro e agora
pesa" rotulava de "Apareceu e carregou" um item que já valia 6,25% antes. O que
só acelerou ou só desacelerou não entra — esse já aparece na tabela como qualquer
linha que mudou.

O bloco nasceu de um caso concreto: `CAMISETA DO BRASIL` fez R$ 2.092 em junho de
2026 (20,4% do mês) e R$ 47 em agosto (0,6%). O painel mostrou o mês caindo;
nenhuma tela disse que a queda tinha nome, e sobraram **24 peças** na prateleira
(mais 59 da versão infantil). **O estoque que sobrou aparece junto** porque é a
única parte do evento sobre a qual ainda dá para agir.

### 7. O que a tela não sabe

A primeira venda do sistema é de **05/03/2026**, então ainda não há o mesmo
período do ano anterior. Uma queda sazonal aparece aqui igual a uma estrutural, e
só o calendário da loja distingue as duas. O rodapé da página diz isso — esconder
a limitação faria a tela afirmar mais do que mediu.

---

## Estado

O hook `usePeriodComparison` guarda os dois períodos, a dimensão, a ordenação e a
busca.

**Vão ao servidor:** os dois períodos e a dimensão — trocar qualquer um refaz a
subtração inteira, e recortar no cliente devolveria linhas de um recorte com os
totais de outro.

**Ficam no cliente:** ordenação e busca, sobre as linhas já carregadas. Pedir
outra ordem ao servidor traria outro conjunto e trocaria a lista debaixo de quem
está lendo — a mesma regra das outras telas de BI.

Os presets de período resolvem em `lib/comparison.ts`, sempre por
`formatDateInput` e **nunca** por `toISOString()`: o backend compara datas no
horário de Brasília, e uma data em UTC joga o dia para trás (armadilha 2 do
`CLAUDE.md`). Vale para os testes também — comparar datas via `toISOString()`
produz uma asserção que só é verdadeira na faixa de fuso do Brasil.

O preset **"este mês" corta os DOIS lados no mesmo número de dias**
(`min(dia de hoje, último dia do mês anterior)`). Cortar só o lado de referência
fazia a tela comparar, em 31/03, 31 dias de março com 28 de fevereiro, e anunciar
os três dias de venda a mais como crescimento — cerca de R$ 1.000 no ritmo desta
loja, creditados a "dias abertos". Acontecia em 7 a 8 dias por ano. O preço é que
o período em análise pode não chegar até hoje; as duas datas ficam escritas no
cabeçalho por isso.

**Os dois períodos não podem se sobrepor.** A API recusa com 400, e a tela não
deixa chegar lá: `normalizeRange` acomoda o intervalo que o usuário _não_ mexeu,
preservando a duração dele. A função precisa saber qual lado foi escolhido — uma
normalização que só ordena os dois pela data transformava o período que o usuário
escolheu para **analisar** no período de **referência**, resposta correta para
outra pergunta.

**O período em análise nunca passa de hoje.** Empurrar o "Depois" sem teto criava
datas que ainda não aconteceram: escolher no "Antes" um intervalo que termina
hoje dava um "Depois" inteiramente no futuro, e a tela anunciava −100% nomeando a
causa de um período que não existiu.

Quando o "Depois" **não cabe inteiro** no espaço até hoje, os papéis **trocam**:
o intervalo escolhido é o mais recente dos dois, logo é ele o que está em análise,
e a referência recua. Encolher o "Depois" para caber seria pior — escolher um
"Antes" que termina _ontem_ produzia 30 dias contra **um** dia parcial, com a tela
anunciando −97% e a ponte creditando a queda a "dias abertos": verdadeiro, inútil,
e inventado pela normalização, não pela escolha de quem lê. Nesse caso o rótulo
vira "Períodos ajustados para caberem no calendário", porque o calendário que a
pessoa estava operando passa a mostrar outro intervalo.

O **"X"** de cada calendário volta ao preset em vez de ser ignorado. Ignorá-lo —
como o filtro da curva ABC ainda faz — deixava a consulta no intervalo antigo.
Além da `key` derivada do intervalo, o hook mantém um **`resetToken`** que muda a
cada limpeza ou troca de preset: o "X" em modo preset chama `setCustom(null)` com
`custom` **já** nulo, o React aborta o re-render, a key não muda e o gatilho fica
anunciando "Selecionar período" sobre uma consulta intacta — a mesma mentira que a
key veio corrigir, por um caminho que ela sozinha não cobria.

Os dois `DateRangePicker` levam uma **`key` derivada do intervalo**. O componente
de `packages/ui` guarda o intervalo em estado interno e só o reconcilia com
`value` ao _abrir_, então qualquer mudança vinda de fora — trocar o preset,
limpar, ou a normalização acomodar aquele lado — deixava o gatilho exibindo o
intervalo antigo ao lado de uma consulta que já usava outro. A `key` força a
remontagem e o estado interno nasce do `value` novo. A alternativa seria corrigir
o componente compartilhado, que é consumido por admin, PDV e loja — mudança de
comportamento em três apps por causa de uma tela.
