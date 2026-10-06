# Tarefas — o quadro (estilo Trello)

Tela `/tarefas` (menu Sistema › Tarefas), aberta a qualquer usuário autenticado. Registra as demandas
que a loja não quer esquecer: ajuste do sistema, correção de cadastro, ideia,
pedido de compra de cliente. Criada em 30/09/2026 a pedido do dono, com o quadro
"Sistemas Uaus!" do Trello como referência visual.

A regra transversal (o que o backend garante e o PDV não vê) está em
`Uaus.Docs/dominio/quadro-de-tarefas.md`. Aqui, o que é desta tela.

## Regras de negócio

- **Colunas fixas e coloridas**: Backlog (cinza), Pendente (vermelho), Fazendo
  (azul), Testes (amarelo), Finalizado (verde). A ordem e as cores estão em
  `board.ts` (`BOARD_COLUMNS`). Não há coluna configurável: o quadro é um fluxo
  de trabalho, e o que varia por tarefa é a etiqueta.
- **Número do cartão** (`#37`) é gerado pelo servidor, sequencial, e nunca se
  repete — cartão excluído leva o número junto. O `id` é a chave técnica; o
  número é o que se fala.
- **Ordem dentro da coluna** é a `position`, um decimal. Ao soltar, a tela grava
  só a posição do cartão movido: a média entre os vizinhos, `POSITION_STEP`
  depois do último, ou metade do primeiro (`positionBetween`). O select
  "Coluna" da modal manda posição **zero**, e o servidor põe no fim.
- **Finalizado mostra só os últimos 30 dias.** O servidor esconde o resto e
  diz quantos escondeu (`hiddenFinishedCount`); o link no rodapé da coluna pede
  todos (`allFinished`). Entrar em Finalizado carimba `finishedAt`; sair zera;
  reordenar dentro da coluna preserva o carimbo original.
- **Arquivar ≠ excluir.** Arquivado sai do quadro, continua na busca e na gaveta
  "Arquivados", e volta para o fim da coluna de origem. Excluir pede confirmação
  citando o número e o título, e não volta pela tela.
- **Busca global** (topo): número (`#12` ou `12`), título, descrição, solução,
  comentário, nome de etiqueta e texto de checklist, inclusive nos arquivados e
  nos finalizados antigos. Clicar num resultado abre a modal. No texto formatado,
  a frase é conferida sem a marcação: "peso padrão" acha `peso <strong>padrão</strong>`,
  e "strong" não acha nada (servidor, `RichText.ToPlainText`).
- **Etiquetas** têm nome, cor (chave da paleta do Trello, traduzida em
  `LABEL_COLOR_CLASSES`) e **prioridade** — da etiqueta, não do cartão: "Bug"
  nasce urgente, "Ideia" nasce baixa. No cartão elas aparecem da mais urgente
  para a menos. Excluir uma etiqueta a tira de todos os cartões.
- **Membros** são os usuários do sistema. O quadro mostra só o primeiro nome
  (pedido do dono); o nome completo fica no tooltip do avatar.
- **Cliques seguidos na modal não se atropelam** (06/10/2026). O PUT do cartão
  manda título, descrição, etiquetas e membros inteiros; montado do cartão
  ainda não relido, o segundo clique desfazia o primeiro (marcar A e logo B
  gravava só B). Agora os PUTs do cartão fazem fila, cada um é montado do
  cartão do cache na hora de sair, etiqueta e membro aparecem marcados no
  clique, e o cartão só é relido depois do último PUT. Título e descrição só
  entram no cartão depois de gravados: o campo de texto remonta quando o valor
  muda, e antecipar perdia o rascunho de uma gravação recusada. Ver `useTaskCard`.
- **Anexos** vão para o S3, em pasta própria por cartão dentro da pasta pública
  (`…/tarefas/{id}/`). Até 10 MB; imagens, PDF, Office, CSV, TXT, ZIP, vídeo e
  áudio. A URL é pública como a das fotos de produto.

## Solução, finalizar e atividade (05/10/2026)

Pedido do dono depois de usar o quadro: "não há campo para digitar a solução e
nem como inserir comentários no card".

- **Solução** fica logo abaixo da descrição, no mesmo formato. Preenchida, ganha
  o destaque de campo preenchido (`filledFieldClass`, o verde do cadastro de
  cliente) com o ícone verde e o rótulo "registrada" — cor nunca sozinha. Ao
  editar: **Salvar**, **Salvar e finalizar** (grava e leva o cartão para o fim de
  Finalizado numa chamada só; some se o cartão já está lá ou arquivado) e
  Cancelar. Vai por `PUT /TaskCards/{id}/solution`, nunca no PUT do cartão: um
  admin aberto antes da solução existir mandaria o PUT sem ela e a apagaria.
- **Finalizar tarefa**: botão verde no topo da modal, ao lado do fechar. Leva
  para o fim de Finalizado de qualquer coluna (o mesmo movimento do select
  "Coluna"); no cartão já finalizado vira o selo "Finalizada"; arquivado não
  finaliza (desarquive antes).
- **Atividade** (`CardActivity`): comentários e histórico numa lista só, do mais
  antigo para o mais recente, com a caixa de comentário embaixo — o painel do
  ClickUp como referência. No desktop largo (`lg`) é um painel à direita com
  rolagem própria, que desce até o fim ao abrir e a cada linha nova; no celular
  vem depois do conteúdo. "Só comentários" esconde o histórico.
- **Histórico** é gravado pelo servidor junto com cada ação: criou, mudou de
  coluna (reordenar não conta), arquivou/desarquivou, título, descrição,
  solução, etiqueta, membro, anexo e checklist (adicionar, marcar, desmarcar,
  remover — renomear item não). A frase é montada aqui (`activity.ts`); ir para
  Finalizado é dito "finalizou a tarefa". Quem fez aparece pelo **nome completo**
  (o servidor traduz o login gravado; usuário excluído fica com o login), como o
  "Criado por" da modal e o autor do anexo.
- **Comentário**: só o autor vê "Editar" e "Excluir" (o servidor recusa os
  outros). Não é perfil de usuário — é autoria: editar a frase de outra pessoa
  faria a atividade dizer, com o nome dela, o que ela não escreveu. Editado
  mostra "(editado)"; salvar sem mudar nada não grava e não marca.

## Texto formatado

Descrição, solução e comentários usam o editor de `@/components/rich-text`
(Tiptap), com a barra do ClickUp que o dono mandou de referência: tipo de bloco
(texto, títulos, listas, citação, código), cor, negrito, itálico, sublinhado,
tachado, código, alinhamento e link. Guarda HTML.

- **Exibição sempre saneada** (`sanitizeRichText`): o HTML é relido pelo esquema
  do editor antes do `dangerouslySetInnerHTML` — script, evento, estilo fora de
  cor/alinhamento e link `javascript:` não chegam ao DOM.
- **Descrição antiga em texto puro** (antes de 05/10/2026) vira um parágrafo por
  linha, escapada. Abrir e salvar sem mexer não grava nada — senão ela viraria
  HTML e o histórico diria "editou a descrição".
- **Editor vazio** (`<p></p>`) é "sem texto": apaga a descrição/solução e não
  deixa comentar em branco (o servidor confere igual, `RichText.IsBlank`).
- **Esc**: com o foco numa edição (o editor, a barra ou os botões dela), cancela
  aquela edição (`RichTextEditingArea`); a caixa de comentário só fecha se vazia.
  Com qualquer edição aberta, a modal **não fecha** no Esc — o rascunho iria
  junto, sem aviso; a modal procura `data-rich-text-editing`. Sem edição aberta,
  Esc fecha a modal. Ctrl+Enter salva.
- **Link**: endereço sem protocolo ganha `https://`; na exibição, todo link sai
  com `target="_blank"` e `rel="noopener noreferrer nofollow"`, sem `class`.
- Limites do servidor em caracteres de HTML (a formatação conta): descrição e
  solução 20.000, comentário 10.000.

## Arrastar e soltar

`@dnd-kit/core` + `@dnd-kit/sortable`, com três sensores (`TaskBoard.tsx`):

- **Mouse**: 6px de movimento iniciam o arrasto; clique sem movimento abre.
- **Toque**: segurar 250ms sem mover (o gesto do Trello). Antes disso o dedo
  rola a coluna normalmente — é por isso que os cartões usam
  `touch-action: manipulation`, e não `none`.
- **Teclado**: espaço pega, setas movem, espaço solta.

A cópia local por coluna (`useTaskBoard.columns`) é o que o arrasto mexe a cada
`dragOver`; o servidor só é chamado ao soltar, e a cópia é ressincronizada com a
consulta sempre que **não** há arrasto em andamento. Se o servidor recusar (o
cartão foi arquivado por outra pessoa), a cópia volta ao que ele tem.

## Celular

- Uma coluna por tela (`w-[85vw]`, `snap-center`), com a próxima aparecendo na
  borda; o quadro rola de lado, a coluna rola por dentro.
- A modal ocupa a tela inteira; no desktop é uma caixa larga com as ações à
  direita.
- Sem arrasto: o select "Coluna" da modal move o cartão.

## Visual

Fundo com a imagem escolhida pelo dono (`assets/board-background.webp`, 200 KB,
carregada só nesta rota). Colunas, cabeçalho e cartões são translúcidos
(`bg-background/75` + `backdrop-blur`), para o fundo aparecer sem prejudicar a
leitura — o pedido foi "efeito translúcido em algumas partes".

## Arquivos

- `board.ts` — regras puras: colunas, cores, `positionBetween`, agrupamento.
- `hooks/useTaskBoard.ts` — o quadro, o arrasto e as ações de cartão.
- `hooks/useTaskCard.ts` — a modal: cada campo salva sozinho; a solução também.
- `hooks/useCardActivity.ts` — a atividade: linha do tempo e comentários.
- `activity.ts` — regras puras da atividade: a frase de cada fato, quem edita.
- `hooks/useTaskLabels.ts`, `hooks/useTaskSearch.ts`.
- `components/` — puros, por props. `TaskBoard` é o único que conhece o dnd-kit.
- Testes: `__tests__/` (quadro, atividade e a página com a modal) e
  `hooks/__tests__/` (quadro, modal e atividade); o editor em
  `@/components/rich-text/__tests__/`.
