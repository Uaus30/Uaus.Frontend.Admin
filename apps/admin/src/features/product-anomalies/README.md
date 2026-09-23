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
