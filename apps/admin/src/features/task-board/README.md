# Tarefas — a lista de pendentes e finalizadas

Tela `/tarefas` (menu Sistema › Tarefas), aberta a qualquer usuário autenticado.
Guarda as anotações do que a loja não quer esquecer de fazer: ajuste do sistema,
correção de cadastro, ideia, pedido de compra de cliente.

Até 23/10/2026 era um quadro estilo Trello, com cinco colunas e arrasto (criado em
30/09/2026). Usando o quadro, o dono viu que os cartões funcionavam como
anotações para lembrar de fazer depois, e pediu uma lista: dois modelos foram
prototipados e ele escolheu o "Modelo B", de cartões grandes com o botão de
concluir. A pasta e a rota da API guardam os nomes do quadro (`task-board`,
`TaskCards`, `board`).

A regra transversal (o que o backend garante) está em
`Uaus.Docs/dominio/quadro-de-tarefas.md`. Aqui, o que é desta tela.

## Regras de negócio

- **Duas situações: Pendentes e Finalizadas.** Toda tarefa nasce Pendente. As
  abas do topo mostram quantas há de cada, para quem o filtro escolheu; o número
  das finalizadas conta só os últimos 30 dias (janela do servidor), e o link "Ver
  as N mais antigas" pede todas (`allFinished`).
- **Responsável: uma pessoa só**, escolhida ao criar (já vem marcado quem está
  anotando). Uma só para "Minhas tarefas" não ter ambiguidade. Tarefa migrada do
  quadro sem membro e sem autor que seja usuário fica "Sem responsável", em
  âmbar, e só aparece em "Todas as pessoas"; editar qualquer campo dela pede que
  se escolha alguém (o servidor recusa o PUT sem responsável).
- **Prioridade é da tarefa**: Urgente, Alta, Normal ou Baixa, escolhida ao criar
  (Normal por padrão). A lista de pendentes vem da mais urgente para a menos e,
  na mesma prioridade, da que espera há mais tempo — a mesma ordem do servidor
  (`sortPending`). Cor sempre com ícone e nome: Urgente vermelho, Alta âmbar,
  Normal e Baixa neutras (`PRIORITIES`). Até 23/10/2026 a prioridade vinha das
  etiquetas; elas agora só classificam, e o cadastro de etiqueta não mostra mais
  a prioridade (ela continua gravada — ver `useTaskLabels`).
- **A tela abre nas tarefas de quem está logado** ("Minhas"), pedido do dono. O
  seletor "Tarefas de" mostra as de todos ou as de uma pessoa, com a contagem da
  aba aberta. O filtro é da tela: a lista inteira vem numa consulta só.
- **Concluir é um clique**, no botão grande à direita do cartão (no celular, a
  barra larga embaixo). O cartão fica com o ✓ verde e o título riscado por
  `COMPLETE_FEEDBACK_MS` e sai da lista; o aviso traz **Desfazer**, que reabre.
  Sem confirmação de propósito: o engano custa um clique, e confirmar a cada
  tarefa feita cansaria. O segundo clique no mesmo cartão é ignorado.
- **Reabrir** (o botão do cartão finalizado, ou o do topo do detalhe) volta para
  as pendentes; o aviso oferece concluir de novo.
- **Busca**: com texto, a lista vem do servidor (`useTaskSearch`), que acha por
  número (`#12` ou `12`), título, descrição, solução, comentário e etiqueta —
  inclusive nas finalizadas fora da janela. A aba e a pessoa continuam valendo
  sobre o resultado; as contagens das abas não mudam com a busca.
- **O cartão mostra** prioridade, número, idade ("há 2 dias", em hora de
  Brasília em qualquer fuso do aparelho — `relativeAge`), título, o começo da
  descrição (prévia em texto puro que o servidor manda, nunca o HTML), para quem,
  quem anotou (quando não é o próprio responsável) e as etiquetas. O finalizado
  troca a idade por quando e por quem foi concluído, e a descrição pelo começo da
  solução.
- **Número da tarefa** (`#37`) é gerado pelo servidor, sequencial, e nunca se
  repete — tarefa excluída leva o número junto.
- **Excluir** pede confirmação citando o número e o título, e não volta pela
  tela. Para o que já foi feito, a confirmação sugere Concluir.
- **Saíram com o quadro**: colunas, arrasto, arquivar (as arquivadas viraram
  finalizadas na migração), membros (viraram o responsável) e checklist (os itens
  ficaram no banco, sem tela). Linhas antigas do histórico que falam disso
  continuam legíveis (`activity.ts`).

## Detalhe da tarefa

`TaskCardDialog`: no topo, o botão verde **Concluir tarefa** (conclui e fecha a
modal) ou, na finalizada, o selo e **Reabrir**. Embaixo, o título editável, para
quem e as etiquetas, a descrição, a solução (com **Salvar e concluir**), os
anexos e, à direita no desktop, a atividade. Na lateral: responsável,
prioridade, etiquetas, excluir e as datas.

- **Cada campo salva sozinho** e os PUTs da mesma modal fazem fila; responsável,
  prioridade e etiqueta aparecem marcados no clique (ver `useTaskCard`, regra de
  06/10/2026). O PUT manda a tarefa inteira, e `priority` e `assigneeId` vão
  sempre: o servidor recusa o PUT sem eles, para um admin aberto antes de
  23/10/2026 não gravar "Normal" e "ninguém" por cima.
- **Solução** fica logo abaixo da descrição, com o destaque verde de campo
  preenchido. Vai por `PUT /TaskCards/{id}/solution`, nunca no PUT da tarefa.
- **Atividade** (`CardActivity`): comentários e histórico numa lista só, do mais
  antigo para o mais recente. Concluir é "concluiu a tarefa", reabrir é "reabriu
  a tarefa", trocar o responsável é "passou a tarefa para “Bruno Lima”".
- **Comentário**: só o autor vê "Editar" e "Excluir" (o servidor recusa os
  outros) — autoria não é perfil.
- **Anexos** vão para o S3, em pasta própria por tarefa (`…/tarefas/{id}/`). Até
  10 MB; imagens, PDF, Office, CSV, TXT, ZIP, vídeo e áudio.

## Nova tarefa

`NewTaskDialog`: título, para quem (já marcado quem está logado), prioridade
(Normal) e a descrição opcional. Anotar para si mesmo é título e Enter. Etiquetas
e anexos ficam para o detalhe, depois de criada. Se a tarefa nasceu para outra
pessoa e a tela está em "Minhas", o aviso diz que ela aparece em "Todas as
pessoas" — senão parece que não gravou.

## Texto formatado

Descrição, solução e comentários usam o editor de `@/components/rich-text`
(Tiptap). A exibição é sempre saneada (`sanitizeRichText`); descrição antiga em
texto puro vira um parágrafo por linha e só vira HTML se alguém editar; editor
vazio (`<p></p>`) é "sem texto". Esc numa edição cancela aquela edição, e com
qualquer edição aberta a modal não fecha no Esc. Ctrl+Enter salva.

## Arquivos

- `tasks.ts` — regras puras: situação, prioridades, ordem, filtro por pessoa,
  idade e data em hora de Brasília, cores de etiqueta e avatar.
- `hooks/useTaskList.ts` — a lista, os filtros, concluir/reabrir com o
  "Desfazer", criar e excluir.
- `hooks/useTaskCard.ts` — a modal: cada campo salva sozinho; a solução também.
- `hooks/useCardActivity.ts` — a atividade: linha do tempo e comentários.
- `hooks/useTaskSearch.ts` — a busca, com pausa de 300 ms.
- `activity.ts` — a frase de cada fato do histórico, quem edita o comentário.
- `components/` — puros, por props. `TaskListCard` é o cartão da lista;
  `TaskListFilters` tem as abas e o "Tarefas de" com a busca.
- Testes: `__tests__/` (regras, atividade e a página com a modal) e
  `hooks/__tests__/` (lista, modal e atividade); o editor em
  `@/components/rich-text/__tests__/`.
