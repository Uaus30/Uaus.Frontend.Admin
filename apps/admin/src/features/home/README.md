# Início (`/inicio`)

A tela em que o admin abre, desde 05/10/2026: uma grade de botões que leva
direto às telas do dia a dia. Pedido do dono, pensando no **celular** — no
telefone a barra lateral fica escondida atrás do botão do topo, e as telas mais
usadas moravam dois toques fundo, dentro de um grupo do menu.

## Quem manda para cá

O caminho mora em `home-route.ts` (`HOME_PATH`), e quatro lugares o usam:

- a raiz `/` (`App.tsx`);
- o destino padrão do login, quando não há `?redirect=` (`useLoginFeature`);
- o botão da 404 (`pages/not-found.tsx`);
- o "Início" da tela de erro (`components/ErrorBoundary.tsx`).

Até 05/10/2026 os quatro levavam ao Dashboard. O Dashboard continua no menu,
logo abaixo do Início, e é o primeiro botão da grade.

## Os botões

A lista é `shortcuts.ts`, na ordem da grade. Rótulo **curto** ("Lucros",
"Estoque"), que é o nome que o dono usa e cabe em duas colunas de celular; a
descrição de uma linha desfaz a dúvida sobre qual tela ele abre.

Os botões andam em **pares de assunto**, um par por linha no celular — a ordem
é a que o dono pediu (05/10/2026):

| Linha     | Esquerda                              | Direita                                       |
| --------- | ------------------------------------- | --------------------------------------------- |
| Resultado | Dashboard (`/dashboard`)              | Lucros (`/bi/o-que-trouxe-lucro`)             |
| Cadastro  | Produtos (`/produtos`)                | Anomalias (`/bi/anomalias`)                   |
| Reposição | Estoque (`/relatorios/estoque-baixo`) | Compras (`/estoque/compras`)                  |
| Saída     | Vendas (`/vendas`)                    | Catálogos (`/marketing/catalogo` — o gerador) |
| Rotina    | Promoções (`/marketing/promocoes`)    | Tarefas (`/tarefas`)                          |

Por isso a grade só tem número **par** de colunas — duas, e quatro a partir do
`lg`. Com três, os pares se separariam (Lucros numa linha, Dashboard na outra).
Botão novo entra com o seu par; um sozinho empurraria a linha de baixo inteira
uma casa e misturaria os assuntos.

Botão novo é uma entrada em `shortcuts.ts` e uma linha no teste, que confere a
lista inteira por igualdade estrita, que ela tem número par de botões e que
**todo destino é uma rota visível do `routes.ts`** — renomear uma rota sem
mexer aqui reprova o teste em vez de deixar um botão levando à 404.

## Decisões

- **Não busca dado.** É a primeira tela depois do login, e no 4G cada consulta
  atrasaria o primeiro toque. Número (faturamento, reposição) é do Dashboard, a
  um toque daqui. Sem consulta, a tela também é o destino mais seguro do
  "Início" da tela de erro: depois de uma queda, não tem o que cair de novo.
- **O cartão inteiro é o link.** Botão dentro do cartão deixaria área morta
  entre o ícone e o texto. Duas colunas no celular dão alvos de mais de 140px de
  lado num aparelho de 360px.
- **Uma cor por botão** (pedido do dono, 24/10/2026; até ali eram todos
  neutros, com o laranja da marca no ícone). Com dez botões iguais, achar um era
  ler os rótulos; com cor, o olho vai direto. A cor está no quadrado do ícone,
  no brilho do canto e na borda ao passar o mouse; o texto continua neutro.
  - A paleta (`tones.ts`) **não usa verde, âmbar, vermelho nem cinza**, nem os
    vizinhos que se confundem com eles: cada um já diz um estado no sistema
    (`Uaus.Docs/dominio/convencoes-de-interface.md`), e atalho não é estado — um
    "Estoque" âmbar leria como alerta.
  - Ela está em **ordem de matiz**, e dois botões que se tocam (lado a lado ou
    um embaixo do outro, nas duas e nas quatro colunas) nunca recebem cores
    vizinhas nela — azul ao lado de índigo se confunde de relance.
  - Trocar a cor de um botão é trocar o `tone` em `shortcuts.ts`. O teste
    (`home-tones.test.tsx`) reprova cor repetida, cor de estado e vizinhos
    parecidos.
- **Polígonos atrás dos botões** (24/10/2026), a mesma malha da tela de entrada
  do Prisma (`components/PolygonBackground.tsx`), em laranja, violeta e
  azul-céu. Fica **fixa na janela**: presa à página, cobria só a altura dos
  botões e deixava a metade de baixo vazia no desktop. É enfeite, então não pode
  custar o primeiro toque: pausa com a aba oculta, fica parada se o aparelho pede
  menos movimento, tem de 26 a 70 pontos conforme a área, anda pelo relógio com
  teto de 60 quadros por segundo (numa tela de 120 Hz o original desenhava o
  dobro) e, sem canvas ou sem `ResizeObserver`, desenha o que der em vez de
  derrubar a tela. Os cartões são translúcidos (`bg-card/80`) mas **sem
  `backdrop-blur`**: o desfoque seria refeito a cada quadro, nos dez cartões.
