# Anomalias (`/bi/anomalias`)

O que está **errado agora** no cadastro dos produtos, para corrigir no próprio
cadastro e recarregar. Só Admin (`SO_ADMIN`): a lista mostra custo, preço e
margem item a item.

Plano e decisões: `PLANO-ANOMALIAS.md`, na raiz deste repositório. A regra de
cada tipo mora no backend
(`Uaus.Backend.Api/Uaus.Application/Services/ProductAnomalyService.cs` e
`ProductAnomalies/ProductAnomalyRules.cs`); aqui mora como ela aparece.

---

## Nada é persistido

Decisão do dono (22/09/2026): nem a anomalia, nem a lista, nem a resolução.
Cada consulta varre o catálogo inteiro, e o produto **sai da lista quando a
causa é corrigida** — não existe "marcar como resolvido". Por isso a tela não
tem ação nenhuma além de levar ao cadastro.

- **O link ao lado do nome** abre o cadastro (do GRUPO) em nova aba. O estoque
  fantasma e o custo zerado têm um atalho próprio ("Contar", "Corrigir custo")
  que abre a aba **Estoque** já na variação certa — é onde ficam a Contagem
  Física e o detalhe da última entrada.
- **Voltar para a aba recarrega a lista** (`refetchOnWindowFocus`, com o dado
  mais velho que 30 s), e o botão de recarregar faz o mesmo na hora. Quem corrige
  numa aba e volta para a outra quer ver a anomalia sumir.

## Uma linha por cadastro, com N etiquetas

É o grupo que a tela de produto edita e que o link abre; foto e "exibir no site"
são do grupo. Quando a anomalia é de uma variação (preço, custo, estoque), a
etiqueta mostra o nome dela ao lado. Medido em produção em 22/09/2026: sem o
estoque fantasma, só 3 cadastros tinham mais de uma anomalia — linhas
repetidas por anomalia não ganhariam nada.

## As etiquetas e a cor

A ordem é a da prioridade do backend, do que perde dinheiro ao que só confunde,
e é também a ordem das pastilhas de filtro. **Vermelho** fica para o que perde
dinheiro ou trava a venda agora (preço abaixo do custo, rascunho com estoque);
o resto é **âmbar**. É o vocabulário de `Uaus.Docs/dominio/convencoes-de-interface.md`:
se tudo que preocupa fosse vermelho, nada seria. Toda etiqueta sai com ícone e
texto — cor nunca sozinha.

Cada etiqueta traz **a evidência com os números** (`lib/anomalies.ts`,
`describeAnomaly`) e o que fazer. No estoque fantasma a conta vem por extenso —
"vendia em 39 de 401 vendas da loja (1 a cada 10); desde 22/09, a loja fez 31
vendas sem ele; no ritmo, seriam ~3" —, porque é uma suspeita estatística e a
etiqueta sem a conta seria uma acusação sem prova.

**Tipo desconhecido não derruba a tela.** A API manda o enum pelo NOME; um tipo
novo no backend sem entrada aqui cai no `FALLBACK_META` ("Anomalia", neutra, no
fim da ordem) em vez de estourar a rota pelo ErrorBoundary.

## Foto pequena: a fila de fotos para refazer (03/10/2026)

A capa com o menor lado abaixo de 300 px (`rules.smallPhotoMinSide`) serve para o
site e para o banner, mas borra no card grande do catálogo de divulgação em PDF,
e o sorteio do PDF deixa o produto de fora. A etiqueta é **cinza e a última da
ordem**: não trava venda nenhuma. Só acende com saldo, como "Sem foto".

- **Capa ainda não medida não é acusada.** O tamanho é medido uma vez por foto,
  no upload ou pela rotina de fundo do servidor; acusar o que falta medir
  encheria a lista com o acervo inteiro no dia do deploy.
- **Com a pastilha ligada, a lista vira ordem de trabalho**: do que mais vendeu
  para o que menos vendeu em `rules.smallPhotoSalesWindowDays` dias (90). O
  servidor já ordena assim quem só tem esta etiqueta; o hook reordena o recorte
  inteiro (`sortBySmallPhotoSales`), porque o cadastro que tem outra anomalia
  junto viria no topo por ela. Nos outros recortes vale a ordem do servidor.

## Produto parado: as duas etiquetas do fim (30/09/2026)

Pedido do dono. **Nunca vendeu**: comprado há mais de 30 dias (`rules.idleDays`),
com saldo, sem uma venda sequer — contado da PRIMEIRA compra, e uma reposição
por cima não zera. **Parou de vender**: já vendeu, tem saldo, e a última venda
foi há mais de 30 dias. Só produto que o balcão vende (Ativo ou "Sem estoque");
rascunho e inativo já têm a própria etiqueta. As duas ficam no fim da ordem:
não são erro de cadastro, são mercadoria que não sai. "Parou de vender" é cinza
(`neutro`): é para olhar, não para consertar.

**"Ignorar parado com saldo menor que 2"** (`ignoreSingleUnits`, ligado por
padrão) esconde essas duas etiquetas no cadastro com uma unidade só **no total**
(`row.stock`, somado das variações) — livro de título único, peça única, que
fica meses na prateleira por natureza — e some com a linha que ficar sem
etiqueta. É o saldo do cadastro, e não da variação (decisão do dono,
30/09/2026): uma camiseta com P, M e G de uma unidade cada tem três peças
paradas, e aparece. É local, como o filtro: o servidor manda tudo, e
as pastilhas e o total se recontam sobre o que sobrou (`IDLE_TYPES`,
`IDLE_MIN_STOCK`, `isSingleUnitIdle` em `lib/anomalies.ts`). Nas outras
etiquetas o saldo não importa: uma unidade com preço errado continua errada.

## Filtro e busca são locais

A varredura não tem parâmetro, e a lista inteira vem numa resposta só (cerca de
120 cadastros em produção). Filtrar e buscar no servidor trocaria o conjunto
debaixo de quem está corrigindo. A busca ignora acento e caixa
(`normalizeSearchText`) e acha pelo nome, pela categoria, pelo número do cadastro
e pelo nome da variação. Filtro não reordena.

A lista mostra 30 linhas por vez: cada linha tem foto.

## O manual fala com os números da regra

O "Como ler esta tela" escreve a regra do estoque fantasma com os números que o
servidor devolveu (`rules`): um texto que ensinasse "3 vendas" enquanto a regra
usa outro número ensinaria errado sem ninguém perceber.

## O que a tela não sabe

- **Custo zero pode ser de propósito** (bonificação e brinde). A etiqueta diz de
  qual entrada vem o zero, e só some quando nenhuma unidade da prateleira sair
  com custo zero e o custo do cadastro deixar de ser zero. Ela olha os LOTES, e
  não só o cadastro: uma compra nova (ou a sobra de uma contagem) com custo põe o
  cadastro acima de zero, e as unidades do lote zerado continuam saindo primeiro,
  pelo FIFO — olhando só o cadastro, a etiqueta sumiria sem nada ter sido
  corrigido (revisão adversarial, 23/09/2026). O atalho "Corrigir custo" só
  aparece quando o zero está na última entrada (`zeroCostIsCorrectable`); numa
  anterior, a correção é por script.
- **Queda real de procura parece estoque fantasma.** A contagem da prateleira
  decide. A contagem física **não entra na regra** (decisão do dono,
  23/09/2026): se zerar o saldo, o produto sai da lista pelo próprio saldo; se
  confirmar, ele fica até vender ou até as unidades serem baixadas.
- **Produto inativo com estoque zerado não aparece**: é o fim normal de um
  produto com que a loja parou de trabalhar (regra do dono, 22/09/2026).
- **Preço abaixo do custo só conta com estoque** (regra do dono, 23/09/2026):
  sem saldo, pode ter sido queima de estoque, e a próxima entrada já pede o preço
  e mostra a margem. Em produção, a única ocorrência (JARRA MARACATU 1,560ML) está
  sem saldo e saiu da lista.
