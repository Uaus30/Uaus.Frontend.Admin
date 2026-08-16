# Cupons de desconto (Admin)

Cadastro dos códigos que saem impressos no panfleto. Esta tela define **o que o
panfleto promete**; ela não aplica cupom em venda nem mexe no contador de uso —
quem consome é um `UPDATE` condicional dentro da transação da venda, no
servidor. O contrato completo está em `PLANO-CUPONS-CAMPANHAS.md` (raiz do
repositório) e em `CouponsController` do backend. Rota: `/marketing/cupons`,
papel **Admin**.

---

## 1. Teto de resgates: `<= 0` é ILIMITADO, nunca "zero usos"

A coluna `usage_limit` guarda o teto, e **zero significa sem teto**. Não é
convenção de tela: o gate real do consumo é a condição
`usage_limit <= 0 OR redeemed_count < usage_limit` do `UPDATE` atômico. Se `0` e
`-1` convivessem como duas grafias do mesmo conceito, a primeira consulta escrita
como `usage_limit = 0` deixaria de enxergar metade dos cupons ilimitados — por
isso o negativo é normalizado para `0` dos dois lados da rede.

Consequências práticas nesta feature:

- **No formulário o ilimitado é o campo VAZIO**, não o texto `"0"`. Editar um
  cupom sem teto traz o campo em branco de propósito: mostrar `0` faria o
  administrador ler "zero usos" e "corrigir" para `1`, encerrando na hora um
  cupom que não tinha limite nenhum.
- O campo vazio é lido com **`parseAmountOrNull`**, nunca `parseAmount`. O
  segundo devolve `NaN` em campo vazio, e `NaN` vira `null` no JSON: o servidor
  gravaria `0` por outro caminho e a diferença só apareceria com um cupom sem
  teto exibido como esgotado no balcão.
- Na tabela, `usageLimit <= 0` aparece como **"Ilimitado"**. Nunca "0 usos".

O teto é **orçamento de marketing, não trava de estoque**: o PDV offline pode
gravar um resgate acima do limite, e o backend aceita — ele nunca recusa uma
venda já paga por causa de cupom. Por isso `remainingUses` na tela é _leitura do
instante_, não reserva: dois caixas podem ver "resta 1 uso" ao mesmo tempo, e os
dois estarão certos, porque nada foi reservado.

---

## 2. O cupom não some depois de usado

**Excluir só é oferecido enquanto o cupom nunca foi resgatado.** Com resgate, o
botão vira **Desativar**.

O backend também recusa o `DELETE`, mas oferecer o botão e devolver erro deixaria
o operador sem saber qual é o caminho certo — e a mensagem de erro é o pior lugar
para ensinar uma regra. A checagem da tela usa `redeemedCount`, que é o melhor
sinal que a listagem tem; a palavra final continua sendo do servidor, porque um
resgate **estornado** devolve o contador a zero e mesmo assim barra a exclusão: a
linha do livro-razão continua lá.

Ela continua lá porque duas coisas dependem dela:

- o **relatório da campanha**, que agrega resgates por período; e
- o **comprovante já impresso**, cuja segunda via precisa sair idêntica à
  primeira. Cada resgate congela código, descrição, tipo e valor no momento da
  venda — é por isso que editar o cupom hoje não altera venda nenhuma de ontem.

Desativar não apaga nada: o cupom para de valer no balcão a partir daquele
instante e permanece no cadastro, visível e auditável.

---

## 3. Vigência é INSTANTE, e o fim nasce às 23:59:59

`validFrom` e `validUntil` são `timestamp` no banco, não `date`. A campanha pode
começar às 14h de uma quinta e a vigência é conferida contra o instante da
**venda** (não o do sync), então a granularidade de hora não é enfeite.

O `DatePicker` do `packages/ui` trabalha só com data de calendário — de
propósito, e ele **não é alterado por esta feature**. O controle de hora é um
campo próprio daqui, e a string do payload é montada à mão:

- início → `` `${toDateKey(dia)}T${hora}:00` ``
- fim → `` `${toDateKey(dia)}T${hora}:59` ``

**O fim fecha em `:59` porque a vigência é inclusiva.** O campo nasce com
`23:59`, o que produz `23:59:59`. Sem isso o padrão seria `00:00` e o cupom
morreria à **meia-noite do último dia** do panfleto — que é justamente o dia mais
movimentado da campanha, com o cliente no balcão segurando o papel que diz
"válido até 30/09".

Duas proibições que valem para todo campo de instante desta tela:

- **`toISOString()` nunca.** Converte para UTC e, no Brasil, joga o dia para
  trás: o cupom apareceria vencendo na véspera do que foi salvo.
- **`new Date("2026-09-30")` nunca.** String só-data é interpretada como UTC e
  volta um dia. Para ler um instante da API de volta ao calendário, corta-se a
  parte da data (`slice(0, 10)`) e usa-se `parseDateInput`, que faz o parse no
  fuso local.

---

## 4. Ativo ≠ vigente

São colunas separadas, e o filtro "Somente ativos" filtra o **indicador**, não a
vigência. Cupom vencido continua aparecendo na listagem — é assim que o
administrador o encontra para desativar. Se o filtro escondesse os vencidos,
eles sumiriam da tela no dia seguinte e ninguém conseguiria mais encerrá-los.

Quem recusa o desconto no balcão é a **data**; o indicador de ativo é a chave de
"parar agora", independente do prazo.

---

## 5. Editar um cupom que já circula

| Edição                                  | Permitida?                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| descrição, campanha, indicador de ativo | sim, sem confirmação                                                            |
| tipo, valor, vigência                   | sim, **com confirmação** quando há resgate                                      |
| teto abaixo do já resgatado             | sim — é o "encerrar agora"; o `UPDATE` condicional simplesmente para de aceitar |
| **código**, com qualquer resgate        | **não**                                                                         |

O **código é travado no formulário** depois do primeiro resgate. Trocá-lo mataria
todo panfleto em circulação: quem apresentasse o papel ouviria "cupom não
encontrado" e ninguém entenderia por quê. O backend recusa; aqui o campo nem
chega a ser editável.

A confirmação de tipo/valor/vigência **mostra quantos resgates existem**. Sem o
número, "tem certeza?" não distingue mexer num cupom que ninguém usou de mexer
num que já saiu em 143 comprovantes. O texto também deixa explícito que as vendas
passadas não mudam — o que muda é o que o panfleto na rua passa a valer daqui
para a frente. O servidor grava log de negócio (`CouponDefinitionChanged`) nessa
alteração.

---

## 6. Campanha só fornece o questionário

O vínculo com campanha é opcional e **não decide dinheiro**. Vigência da
CAMPANHA decide apenas se o questionário aparece no balcão; vigência do CUPOM
decide o desconto. Cupom válido com campanha encerrada = desconto aplicado,
nenhuma pergunta, resgate ainda atribuído à campanha.

O nome da campanha vem resolvido dentro do próprio cupom (`campaignName`), então
a coluna da tabela não faz uma chamada por linha. A lista de campanhas é buscada
só para o seletor do formulário e para o filtro.

---

## 7. Busca, paginação e cache

- A busca tem debounce de 300 ms e **volta para a página 1** já na digitação —
  filtro novo, contagem nova. O mesmo vale para o filtro de campanha e o de
  ativos. O recuo é feito nos _setters_, não num efeito que observa o filtro:
  efeito que chama `setState` renderiza em cascata e é erro de lint aqui.
- **Excluir o último item da última página recua uma página**, no `onSuccess` da
  própria exclusão. Sem isso a tela ficaria presa numa página que deixou de
  existir, e a listagem vazia faria parecer que o cadastro inteiro sumiu.
- Toda mutação invalida o **prefixo** das chaves `["Coupons"]` e
  `["CouponDetails"]`, alcançando todas as combinações de busca/página em cache.
  Errar a chave aqui não gera erro: a tela apenas não atualiza depois de salvar.
- A listagem fica no `staleTime` de operação (não de catálogo) porque a linha
  carrega `redeemedCount`/`remainingUses`, que mudam sozinhos a cada venda.

---

## 8. O que esta feature NÃO cobre

- **A atomicidade do contador de uso não tem teste aqui** — e não tem em lugar
  nenhum do front. O consumo concorrente é um `UPDATE` condicional no Postgres, e
  fingir que um teste de hook o cobre seria pior do que declarar o buraco.
- **Conciliação** (`reconcileCoupon`) existe no api-client e não tem tela ainda:
  a divergência entre `redeemedCount` e o livro-razão só é conferida por chamada
  direta ao endpoint.
- **Aplicar cupom em venda pelo admin** está fora de escopo na v1 — só o PDV
  aplica (`POST /Sales` aceita totais arbitrários e não tem gate de
  idempotência).
