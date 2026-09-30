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
- **Busca global** (topo): número (`#12` ou `12`), título, descrição, nome de
  etiqueta e texto de checklist, inclusive nos arquivados e nos finalizados
  antigos. Clicar num resultado abre a modal.
- **Etiquetas** têm nome, cor (chave da paleta do Trello, traduzida em
  `LABEL_COLOR_CLASSES`) e **prioridade** — da etiqueta, não do cartão: "Bug"
  nasce urgente, "Ideia" nasce baixa. No cartão elas aparecem da mais urgente
  para a menos. Excluir uma etiqueta a tira de todos os cartões.
- **Membros** são os usuários do sistema. O quadro mostra só o primeiro nome
  (pedido do dono); o nome completo fica no tooltip do avatar.
- **Anexos** vão para o S3, em pasta própria por cartão dentro da pasta pública
  (`…/tarefas/{id}/`). Até 10 MB; imagens, PDF, Office, CSV, TXT, ZIP, vídeo e
  áudio. A URL é pública como a das fotos de produto.

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
- `hooks/useTaskCard.ts` — a modal: cada campo salva sozinho.
- `hooks/useTaskLabels.ts`, `hooks/useTaskSearch.ts`.
- `components/` — puros, por props. `TaskBoard` é o único que conhece o dnd-kit.
- Testes: `__tests__/board.test.ts` e `hooks/__tests__/useTaskBoard.test.tsx`.
