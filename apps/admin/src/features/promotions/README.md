# Módulo de Promoções (Admin)

Cadastro do preço promocional de um produto, com vigência própria. Rota
`/marketing/promocoes`, papel **Admin** (a tela expõe custo e margem item a
item, como as três telas de BI). Contrato em `PLANO-PROMOCOES.md`, na raiz do
repositório, e nos DTOs de `Uaus.Application/DTOs/Promotions`.

**Esta é a fase 1a**: cadastro e listagem. O balcão (1b), a aba Performance (2),
as artes com prompt (3) e a vitrine (4) ainda não existem.

## A regra que sustenta tudo

> **A promoção é dado; o preço promocional é DERIVADO. `products.price` nunca é
> escrito.**

Até aqui a loja fazia a relâmpago baixando o preço no cadastro e subindo de volta
depois. Duas coisas se perdiam: o "de/por" (não havia mais de onde) e a margem do
BI daquele período, que passava a mostrar o preço promocional como se fosse o
normal. Além disso, alguém precisava lembrar de restaurar.

Consequência prática: **excluir ou encerrar uma promoção não mexe no produto** —
não há o que desfazer.

## Regras de negócio

### 1. A promoção é do GRUPO, e vale para todas as variações ativas

O cartaz e a foto falam do produto, não da cor. O **percentual** respeita preços
diferentes entre variações (30% em R$ 12 e R$ 18 dá R$ 8,40 e R$ 12,60); o
**preço final** iguala todas por cima — 25 dos 894 grupos ativos tinham preços
diferentes dentro do grupo em 18/09/2026, e a prévia avisa com a faixa antes de
salvar.

### 2. Relâmpago vence Dia a Dia; duas do mesmo tipo nunca convivem

É a única precedência do domínio, e existe para o produto com preço de patamar
entrar na relâmpago de sábado **sem ninguém encerrar e recriar o Dia a Dia toda
semana**. A invariante é a constraint `ex_promotions_sem_sobreposicao`, com
`type` na chave; a checagem do serviço é a defesa primária, e é ela que devolve a
frase com a janela da promoção que colide.

Janelas que apenas se **encostam** (uma termina 11:59:59, a outra começa
12:00:00) não colidem — é o caminho "encerrar agora e emendar a próxima", que a
loja usa de verdade.

### 3. Desconto zero é válido no Dia a Dia e inválido na relâmpago

O pote de R$ 2,00 na porta já é barato de propósito: para o cliente, aquele preço
**é** promocional, ainda que nunca tenha sido mais caro. A relâmpago é o
contrário — o cartaz promete um preço, e desconto zero ali é cadastro errado.

Com preço final, a relâmpago exige um valor **menor** que o de tabela: igualar o
preço passaria pela validação de "maior que zero" e viraria cartaz prometendo o
preço de sempre.

### 4. Campo vazio não é zero

`parseAmountOrNull("")` devolve **0**, e zero é um desconto legítimo aqui. Por
isso `describeFormProblem` cobra o campo vazio **antes** de parsear: sem essa
linha, quem esquecesse de digitar salvaria uma promoção de 0% sem perceber.

### 5. A vigência é instante, e a composição não passa pelo `toISOString()`

`toISOString()` converte para UTC e, antes das 21h no Brasil, grava a promoção
começando na véspera (armadilhas 5 e 6 do `CLAUDE.md`). O dia sai de `toDateKey`
e os segundos são fixos por extremidade: `00` no início, `59` no fim — um fim às
18:00 significa "até o fim de 18:00".

A **relâmpago compõe o fim com o dia do início**. Deixar o fim sair do `endDate`
abriria a porta para uma promoção das 23h de sábado às 4h de domingo: passa pelo
teto de 24 horas e cai num dia em que a loja nem abre.

O padrão é o mesmo de `campaigns/hooks/campaignRules.ts`, repetido aqui de
propósito — são duas ocorrências, e a regra do repositório é que duas não são
duplicata. Na terceira isto sobe para o `packages/core` e campanhas migra junto.

### 6. O relógio das 18h é do site, não da vigência

A loja fecha às 18h e o site vai anunciar a contagem até lá (fase 4). A
**vigência** vai até onde o cadastro disser: se às 18h05 ainda houver fila, a
promoção continua valendo no caixa, e o preço não muda embaixo de quem já está na
loja. São dois números de propósito.

### 7. "Encerrar agora" preserva a janela

Move `validUntil` para agora em vez de desativar — desativar apagaria o período
em que a promoção realmente valeu, e a medição da fase 2 passaria a comparar
vendas contra um período que a tela não mostra. A promoção que **ainda não
começou** é desativada, porque não houve janela nenhuma.

É o primeiro passo do plano B do sábado: encerrar aqui e baixar o preço no
cadastro devolve a loja ao método antigo.

### 8. O limite é por VENDA, e o cartaz diz "por cliente"

Os dois estão certos: a loja fala com o cliente, o sistema conta o que consegue
contar. O texto de ajuda do campo diz isso com todas as letras. Quem aplica o
limite é o PDV (fase 1b) — aqui ele é só cadastro.

### 9. A prévia é calculada no SERVIDOR

`GET /Promotions/preview` devolve preço, custo, preço promocional, margem e os
avisos por variação. A conta é a mesma que vai decidir o preço no carrinho;
refazê-la na tela pouparia uma requisição e criaria a divergência clássica — a
tela prometendo um número que o balcão não pratica.

## Estrutura

- `promotion-route.ts`: os três caminhos numa entrada de rota só (`matchPath`),
  pelo mesmo motivo de `PRODUCTS_MATCH_PATH` — entradas separadas desmontariam a
  listagem ao abrir o cadastro.
- `hooks/promotionRules.ts`: regra pura — instantes, situação, validação, payload.
- `hooks/usePromotions.ts`: listagem, filtros, navegação e as duas ações de linha.
- `hooks/usePromotionEditor.ts`: formulário, prévia e gravação.
- `components/PromotionsTable.tsx`: listagem, com a confirmação nomeando o produto.
- `components/PromotionEditorScreen.tsx`: cadastro/detalhe em TELA (não modal) —
  a URL é compartilhável e a aba Performance da fase 2 precisa do espaço.
- `components/PromotionPricePanel.tsx`: o efeito no preço, ao lado do formulário.
- `components/ProductGroupPicker.tsx`: busca do produto, reusando `useGetProductTable`.
- `components/PromotionSituationBadge.tsx`: cor **com** ícone e palavra, nunca só cor.

## O que NÃO está aqui

- **Aplicação no balcão** — fase 1b, no PDV.
- **Nota de desempenho e investimento realizado** — fase 2; o que existe hoje é o
  investimento **projetado**, que depende da meta declarada.
- **Artes 4:5 e 9:16 com o prompt** — fase 3. As colunas já existem na tabela,
  mas ficam fora do contrato da API até lá.
- **Etiqueta, de/por e banner na vitrine** — fase 4.
