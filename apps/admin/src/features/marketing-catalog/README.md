# Marketing › Catálogo de divulgação (`features/marketing-catalog`)

Gera o material de divulgação da loja sem montagem manual: o sistema sorteia os
produtos e desenha a peça pronta para compartilhar. Rota `/marketing/catalogo`,
item **Catálogo** do grupo Marketing. Quem está no balcão também divulga, e a
tela não mostra custo, margem nem saldo.

O contrato completo — decisões, números medidos, regras do sorteio e etapas —
está em `PLANO-CATALOGO.md`, na raiz do repositório.

**Estado: as quatro etapas.** Três formatos — banner 9:16, banner 4:5 e catálogo
em PDF —, com escolha de tema e título, sorteio do servidor e troca dos
produtos marcados; e o histórico das peças que saíram, com o descanso de quem já apareceu
e a venda antes e depois (rota `/marketing/catalogo/historico`).

## Regras de negócio

### 1. Quem sorteia é o servidor; quem desenha é o navegador

`POST /Catalogs/draw` devolve os produtos da peça já na ordem de desenho, cada um
com o **papel** que o fez sair (oferta, novidade, mais vendido, intermediário,
pouca saída). O servidor sorteia com números que a tela não recebe — venda,
dinheiro parado, dias de loja. As regras do sorteio estão no `PLANO-CATALOGO.md`
(seção 2.3) e em `CatalogDrawRules`, no backend.

A tela não sorteia, não filtra e não recalcula preço. Ela só converte o item no
formato do molde (`lib/catalogProducts.ts`).

### 2. A peça só leva o que o cliente pode ver

`CatalogProduct` não tem custo nem saldo, e não é esquecimento: a imagem circula
em grupo de WhatsApp, fora do controle da loja. O card que chega da API é o
**mesmo da vitrine pública**; o preço impresso é o que o cliente paga hoje — o
promocional quando há oferta vigente.

### 3. Toda peça sai com o aviso, e a data vai dentro dele

> Preços de referência em dd/mm/aaaa, sujeitos a alteração sem aviso e à
> disponibilidade de estoque. Imagens meramente ilustrativas.

Texto pedido pelo dono. A data é a do **calendário da loja** (Brasília), e não a
do aparelho: quem gera é o celular de quem estiver no balcão, e um fuso errado
não pode datar a peça de ontem. Ela existe porque a imagem é vista dias depois —
sem data, o preço de hoje vira promessa sem prazo.

### 4. O sorteio nunca vem do cache

`drawCatalog` é função, e não hook de query: cada chamada dá uma peça diferente
de propósito, e o preço vai **impresso** — servir o de dez minutos atrás
colocaria no status um preço que o balcão já não pratica.

### 5. Um selo por card: oferta, depois novidade, depois escassez

Nunca dois. Dois selos disputando o canto da foto tapam o produto sem informar
mais. A oferta vence porque é ela que muda o preço impresso — e quem decide que
é oferta é o **card** (`promotion` presente), não o papel do sorteio: uma
promoção que começou entre o sorteio e a montagem do card não pode deixar o selo
dizendo uma coisa e o preço outra.

### 6. O "de" riscado e o "a partir de" convivem

Oferta de 20% num grupo com variações de R$ 10 e R$ 16 custa de R$ 8,00 a
R$ 12,80. Imprimir só "de R$ 10,00" sobre o R$ 8,00 prometeria o menor preço
para todas as variações; a peça mostra as duas legendas, como o `PriceTag` do
site.

O "de" só aparece quando a API manda: `referencePrice` já vem ausente quando o
corte é de até 5% (regra do servidor, a mesma do site).

### 7. O tema sugere o título; a pessoa pode trocar

Os quatro temas fixos e um por departamento vêm de `GET /Catalogs/themes`, com
quantos cadastros cada um tem para sortear. Tema sem produto continua na lista,
desabilitado: sumir com "Novidades" num mês sem novidade pareceria defeito.

O título do cabeçalho nasce do tema ("Cozinha") e é editável ("Utilidades de
cozinha"), até 36 caracteres — o que cabe em uma linha na menor fonte.

- **Trocar de tema descarta o que foi digitado**: o texto era do outro tema.
- **Título apagado volta ao sugerido**: a peça não sai sem cabeçalho.
- **Mexer no título depois de gerar** acende "Atualizar título", que redesenha a
  **mesma** peça, sem sortear de novo. Com outro tema selecionado o botão não
  aparece: aí o campo é o título do próximo sorteio.

### 8. Trocar produtos mantém a mistura — e é em lote

A pessoa **marca** na lista os produtos que quer trocar (tocar na linha marca) e
toca uma vez em "Trocar N produtos". Pedido do dono (05/10/2026): um por um,
trocar três eram três desenhos da peça — e, no PDF, três montagens do arquivo.
Agora são os sorteios e **um** desenho só.

Cada produto marcado dá lugar a outro do **mesmo papel**, no tema da **peça** (e
não no que estiver selecionado no campo), sem repetir quem está nela nem quem já
foi trocado nesta peça. A novidade trocada dá lugar a outra novidade. Cada novo
entra no lugar do seu; os demais não se mexem.

- **Um sorteio por papel, um depois do outro** (`lib/swapPlan.ts`). Duas
  novidades e um achado marcados são dois pedidos: duas novidades, um achado. Em
  sequência, e não em paralelo, porque o servidor, sem produto do papel no tema,
  completa com outros papéis — dois pedidos ao mesmo tempo podiam trazer o mesmo
  cadastro. O segundo pedido já evita quem o primeiro trouxe.
- **Papel sem substituto suficiente:** troca quem veio e avisa "2 de 3
  trocados"; os que ficaram continuam onde estavam. Sem substituto nenhum, a tela
  avisa e mantém a peça.
- **A marcação acaba** quando a troca é aplicada e quando sai um sorteio novo (os
  produtos marcados eram da outra peça). Num erro ela **fica**: tocar de novo
  não exige marcar tudo outra vez.

Um sorteio novo zera a lista de trocados.

**A troca só vale se as fotos dos substitutos carregarem.** Na troca não há
reserva para ceder a vaga: o montador descartaria o produto de foto quebrada e a
peça voltaria com oito, em silêncio. A peça fica como estava — nenhuma das
trocas é aplicada —, a tela pede para trocar de novo, e só o substituto de foto
quebrada não é sorteado outra vez.

### 9. Foto fora do ar cede a vaga

O sorteio devolve **reservas** à parte (4 no banner, 8 no PDF). O montador baixa
todas as fotos e usa as primeiras que serviram: a peça não sai com buraco, e uma
foto quebrada não derruba a geração. Só há erro quando nenhuma serve. As
reservas nunca são ofertas — a reserva não pode furar o teto delas.

### 10. Vale a última geração

Cada geração tem um número (`runRef`). Dois toques seguidos disparam duas
gerações, e a que responder atrasada é descartada — sem isso, o banner da
primeira cobriria o da segunda. Durante a geração o banner anterior continua na
tela, esmaecido.

Sair da tela no meio de uma geração também a invalida. Sem isso ela terminaria
depois, criaria a URL da prévia para uma tela que não existe mais, e o arquivo
ficaria preso na memória — não há efeito de limpeza para um estado que nunca foi
exibido.

### 11. Compartilhar baixa quando a folha do aparelho não existe

No celular, "Compartilhar" abre a folha do sistema com o arquivo (WhatsApp,
Instagram). No computador ela não aceita arquivo, e o botão nem aparece — fica o
"Baixar". Fechar a folha sem escolher é desistência; qualquer outra falha cai no
download, porque quem tocou quer o arquivo.

### 12. Escolher e gerar vêm antes da prévia

Pedido do dono (03/10/2026). No celular a tela é uma coluna só, e com a prévia
em cima o botão de gerar ficava abaixo de uma moldura vazia. A ordem é a do
trabalho: formato, tema e título, gerar, prévia, compartilhar, e por fim a lista
para trocar produto. No computador a prévia sobe para a coluna da direita.

### 13. Três formatos: banner é imagem, catálogo é PDF

| Formato         | Arquivo                                | Produtos                  | Para onde                  |
| --------------- | -------------------------------------- | ------------------------- | -------------------------- |
| Banner 9:16     | JPEG 1080 × 1920                       | 9                         | status do WhatsApp e story |
| Banner 4:5      | JPEG 1080 × 1350                       | 6                         | imagem no grupo e feed     |
| Catálogo em PDF | páginas de 1080 × 2340 (540 × 1170 pt) | até 30, em 5 páginas de 6 | grupos de WhatsApp         |

As medidas de cada um estão em `template/geometry.ts`; o que vai ao sorteio e o
arquivo que sai, em `lib/formats.ts`. O vocabulário é o do dono: os botões e os
avisos dizem "banner" ou "catálogo".

**A peça é redesenhada no formato em que foi gerada.** Trocar produto e
atualizar título usam o formato (e o tema) da peça que está na tela, e não o que
estiver nos campos. Com outro formato selecionado, o botão principal volta a ser
"Gerar…" e o aviso de título não acende: o que está nos campos é o próximo
sorteio.

### 14. O catálogo em PDF só leva foto grande

Na página do PDF o card tem 498 px de largura, contra 325 no banner. A capa de
225 px herdada do Mais PDV borra ali, e são centenas delas. Duas barreiras:

- o **servidor** sorteia só cadastros com capa de 300 px ou mais no menor lado
  (`largePhotosOnly`), e a lista de temas diz quantos cada tema tem — é a
  contagem que o seletor mostra quando o formato é o PDF;
- o **navegador** confere de novo com o arquivo na mão (`minPhotoSide` em
  `formats.ts`). A capa que a rotina de fundo ainda não mediu passa pelo
  servidor como "grande"; aqui ela é recusada e a reserva entra no lugar.

O número (300) é o mesmo dos dois lados: `CatalogDrawRules.LargeCardMinPhotoSide`
no backend. As fotos recusadas aparecem em BI › Anomalias, etiqueta **Foto
pequena**, em ordem de venda — é a fila de fotos para refazer.

### 15. No PDF, cada produto é um link para o site

Cada página é uma imagem do mesmo molde, e por cima de cada card vai uma área
clicável para `uaus.com.br/produtos/{id}` com `utm_source=whatsapp`,
`utm_medium=catalogo` e `utm_campaign=catalogo-AAAA-MM-DD` (o dia da loja). O
coletor de métricas do site lê as três marcas: cada catálogo compartilhado vira
uma linha na tela de métricas.

- A área de cada card vem de `cardRects`, que **repete a conta de posição do
  molde**. Mudou o alinhamento da grade em `CatalogPiece.tsx`, mude lá também: o
  link sairia deslocado sem erro nenhum.
- Com mais de uma página, o cabeçalho leva "Página 2 de 4", embaixo do título.
  Os dois encostam **à direita**, com a mesma margem de 48 px do logotipo, que
  fica à esquerda (pedido do dono, 05/10/2026). A última página, com menos
  produtos, mantém o card do mesmo tamanho e a grade encostada em cima.
- **O PDF é escrito à mão** (`lib/pdfWriter.ts`, ~150 linhas): página, imagem
  JPEG e link. A biblioteca usual (jsPDF) pesa 30 MB instalada e traria
  html2canvas e dompurify para dentro do admin por causa de uma tela. O teste
  confere a tabela de referências byte a byte — é ela que um leitor usa para
  achar as páginas.
- **Páginas já desenhadas são guardadas** (as últimas 15). Trocar produtos de
  um catálogo de cinco páginas redesenha só as páginas deles.

### 16. O desenho roda fora da tela

O satori e o resvg ocupam o processador por segundos. Na thread principal a tela
congelava (as "leves travadas" do teste do dono no celular), e o PDF congelaria
cinco vezes. O desenho roda num **worker** (`lib/render.worker.ts`); medido em
03/10/2026 no computador, a maior travada durante a geração caiu de 2,1 s para
menos de 0,1 s, e a tela mostra em que página está.

- **A thread principal é a rede de segurança** (`lib/renderer.ts`): se o worker
  não sobe (navegador antigo) ou falha, a mesma peça é desenhada pelo mesmo
  código, travando como antes — mas o arquivo sai. O console registra o motivo.
- **O molde fica fora do Fast Refresh** (`exclude` do plugin do React, no
  `vite.config.ts`). O código que o plugin injeta em todo `.tsx` usa `window`,
  que não existe no worker: em desenvolvimento o worker morria ao carregar e o
  desenho caía, calado, para a thread principal.
- O worker recebe o **nome** da peça, e não as medidas: `PieceSpec` tem uma
  função, que não atravessa `postMessage`.

### 17. Só a peça que SAIU vai para o histórico

Compartilhar (quando a folha do aparelho conclui, ou cai no download) e baixar
registram a peça no servidor (`POST /Catalogs/pieces`): tema, formato, título e
os produtos na ordem do desenho, com o **preço impresso**. A peça que ficou na
tela não é registrada — "sortear de novo" dez vezes não são dez divulgações, e
fechar a folha sem escolher nada é desistência.

- **Uma peça, um registro.** Cada arquivo gerado tem uma chave (`newPieceKey`);
  compartilhar e depois baixar o mesmo arquivo manda a mesma chave, e o servidor
  não cria outro registro. Trocar um produto ou o título gera **outro** arquivo,
  com outra chave.
- **A falha é calada.** A pessoa já tem o arquivo, e o registro não é tarefa
  dela: sem aviso na tela, com o motivo no console, e a chave volta a ficar
  livre para a próxima tentativa.

### 18. Quem saiu descansa uma semana — como preferência, não como veto

O sorteio manda para o fim da fila quem saiu numa peça registrada nos últimos 7
dias (`CatalogDrawRules.CooldownDays`, no backend): o produto só volta quando
faltar outro do mesmo tipo de vaga. Veto esvaziaria os temas pequenos — com
quatro promoções no ar, em quatro dias "Novidades e promoções" ficaria sem
oferta. Nos temas de assunto (Novidades e promoções, Mais vendidos, Achados), o
descanso vem **antes** do limite por departamento (decisão
do dono, 03/10/2026, para repetir menos). A tela não mostra o descanso; ele é
explicado no histórico.

### 19. O histórico compara com o MESMO trecho da semana anterior

A tela de histórico, ao contrário da de gerar, mostra unidades vendidas. Para
cada peça, "depois" são as unidades dos produtos dela desde que
saiu, por até 7 dias; "antes" é o mesmo trecho da semana anterior — os mesmos
dias da semana. Com dois dias medidos, uma peça de sábado comparada com a quinta
e a sexta pareceria um sucesso só por causa do calendário.

A conta é toda do servidor (`CatalogPieceRules`); a tela mostra e avisa que é
**pista, não prova** — ela não separa a divulgação do dia de pagamento ou de uma
reposição. A queda aparece em âmbar, e não em vermelho, pelo mesmo motivo.

## Promoção na peça e a memória do sorteio (05/10/2026)

- O selo de promoção diz **"PROMOÇÃO"** em vermelho com o raio amarelo (era
  "OFERTA" em preto — o dono pediu uma cor mais chamativa). Na lista da tela o
  papel "Oferta" virou "Promoção".
- **Combo**: o preço do card é o de tabela, e o selo traz a oferta ("3 POR R$
  20,00", `describeComboOffer` do `@workspace/core`) no lugar da palavra. Não cabe
  linha abaixo do preço: o card tem 150px de texto na escala 1.
- O título padrão do tema geral é **"Promoções e Novidades"**.
- O servidor lembra **todo sorteio**, compartilhado ou não, e dá um quinto do peso
  a quem apareceu nos últimos 3 dias — a tela não muda nada para isso. Detalhe em
  `Uaus.Docs/historico/2026-10-05-catalogo-memoria-do-sorteio.md`.

## O molde é desenhado pelo satori, não pelo navegador

`template/` é JSX comum, mas quem o transforma em imagem é o **satori** (layout e
SVG) seguido do **resvg** (pixels). É o que faz o banner sair igual no Android,
no iPhone e no computador. O preço disso é um subconjunto do CSS:

- só **flexbox** (sem grid), e todo `div` com mais de um filho precisa de
  `display: flex`;
- estilo **inline** — classe do Tailwind não chega ao arquivo;
- `<img>` com largura e altura declaradas;
- fonte embutida: Montserrat (a do logotipo) em WOFF. WOFF2 o satori não lê.

O navegador renderiza o mesmo JSX sem reclamar, então o erro só aparece ao
gerar. Por isso `template/__tests__/CatalogPiece.render.test.tsx` passa o molde
pelo satori **de verdade**, nas três peças, com todas as variações de card e de
grade. Foi ele que pegou, na etapa 3, que o satori recusa `boxShadow: undefined`
e quebra em `border: undefined` — a chave não pode existir.

**Satori fixado em 0.32.0.** A 0.33 passou a carregar o HarfBuzz por caminho
relativo de WebAssembly, que não resolve dentro do bundle.

### O peso fica fora do resto do admin

Satori e resvg somam 515 KB de JavaScript (~170 KB comprimidos) e 2,4 MB de
WebAssembly (~950 KB comprimidos). Três cuidados, os três conferidos no build de
03/10/2026:

- entram por `import()` dinâmico. No worker, que é o caminho normal, viram
  chunks do próprio worker; na thread principal (a rede de segurança), o
  `manualChunks` do `vite.config.ts` os põe no chunk `vendor-catalogo` — sem
  isso cairiam no `vendor` comum, que todo mundo baixa no primeiro paint;
- a lista de pacotes do `vite.config.ts` é o fecho de dependências do satori
  0.32. **Atualizou o satori? Refaça a lista e confira o tamanho do `vendor`**;
- a tela chama `preloadPiece()` ao abrir: o worker sobe e baixa as bibliotecas
  e as fontes enquanto a pessoa lê, e não com o botão "Gerar" já apertado.

### Conferir uma mudança de desenho sem abrir o navegador

```bash
cd apps/admin
CATALOG_PREVIEW_DIR=../../../TEMP/catalogo npx vitest run CatalogPiece.render
```

Grava `banner-story.png`, `banner-feed.png` e `catalogo-pagina.png` com produtos
reais da **vitrine pública** (o sorteio exige sessão; a prévia serve para olhar
o desenho, não a escolha).
`CATALOG_PREVIEW_SEED` desloca a janela de produtos; `CATALOG_PREVIEW_API` troca
a API.

### As fotos passam por um canvas antes do molde

O bucket tem JPEG, PNG e WebP, e a extensão mente (há `.jpg` que é WebP por
dentro — foi o que derrubou a primeira prévia). O canvas devolve sempre um JPEG
comum, já reduzido a 640 px e com fundo branco no lugar da transparência.

A foto é buscada com `cache: "no-store"`. O admin já mostrou a mesma URL num
`<img>` comum, e o navegador guardou a resposta **sem** o cabeçalho de CORS; lida
do cache, ela seria recusada mesmo com o bucket liberado.

### A arte do cabeçalho

`assets/story-header.jpg`, `feed-header.jpg`, `page-header.jpg` e
`story-footer.jpg` (o rodapé é o mesmo nas três peças) saem de
`C:\Projects\Uaus\Artes\catalogo\gerador\gerar_fundos.py --publicar`, que recorta
o logotipo da arte da marca e estende a textura. No banner o logotipo fica
centralizado, com o título embaixo; na página do PDF, compacto à esquerda, com o
título do outro lado, encostado à direita. As medidas de lá são as de `template/geometry.ts`: mudou a
posição do logotipo num, mude no outro, senão o título passa por cima dele.

## O contato do rodapé é o do site

`lib/storeContact.ts` repete o contato do site (`apps/loja/src/lib/site.ts`), e
o dono confirmou a escolha em 03/10/2026. O cadastro de Configurações não serve:
é o do cupom — caixa alta e o celular de um sócio. É a segunda cópia; na terceira
os valores sobem para o `packages/core`.

## Estrutura

- `template/geometry.ts`: medidas das três peças, a grade conforme a quantidade
  e a posição de cada card (`cardRects`).
- `template/text.ts`: preço partido, data da loja, aviso, corpo do título.
- `template/CatalogPiece.tsx` e `ProductCard.tsx`: o molde, um só para as três.
- `lib/formats.ts`: os três formatos — quantidades, foto mínima, arquivo.
- `lib/catalogProducts.ts`: o item sorteado no formato do molde; papéis e selo.
- `lib/themes.ts`: as opções do seletor de tema, com rótulo e título sugerido.
- `lib/rasterize.ts`: satori + resvg, do molde aos pixels (roda nos dois lados).
- `lib/render.worker.ts` e `lib/renderer.ts`: o worker e a porta dele, com a
  rede de segurança na thread principal.
- `lib/photos.ts`: fotos (com o tamanho original) e artes em data URL; pixels
  em JPEG.
- `lib/fonts.ts`: os cinco pesos da Montserrat.
- `lib/buildPiece.ts`: junta tudo — páginas, links e o arquivo final.
- `lib/pdfWriter.ts` e `lib/links.ts`: o PDF escrito à mão e o link de cada
  produto.
- `lib/share.ts`: folha de compartilhamento, download e nome do arquivo.
- `lib/pieceRecord.ts`: a chave da peça e o registro dela no histórico.
- `lib/history.ts`: a diferença com sinal e o estado da medição, em texto.
- `lib/swapPlan.ts`: a troca em lote — os marcados juntos por papel, e cada um
  casado com o seu substituto.
- `hooks/useCatalogGenerator.ts`: estado e ações da tela.
- `hooks/useCatalogHistory.ts` e `components/CatalogHistoryList.tsx`: a tela de
  histórico.
- `components/CatalogControls.tsx`: formato, tema, título e os botões de gerar.
- `components/CatalogPreview.tsx`: a moldura da prévia — que mostra o próprio
  arquivo (ou as páginas que estão dentro do PDF), e não uma simulação.
- `components/CatalogProductList.tsx`: quem saiu na peça, com a marcação e o
  botão de trocar os marcados (preso ao pé da tela enquanto a lista rola).
