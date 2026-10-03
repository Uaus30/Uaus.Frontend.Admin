# Marketing › Catálogo de divulgação (plano técnico)

> **Estado: decisões fechadas com o dono em 03/10/2026; etapas 1 e 2 na `dev` no
> mesmo dia** (a etapa 1 foi testada e aprovada por ele no celular). Este arquivo
> é o contrato da feature: toda camada codifica contra ele, e divergência se
> corrige aqui primeiro.
>
> Salvo indicação, os números foram medidos no **banco de produção em
> 03/10/2026**, só com leitura (`Uaus.DbTools/console.sh prod`). A resolução das
> fotos saiu de uma amostra de 300 capas (100 por origem), baixadas do bucket.

O pedido: gerar sozinho o material de divulgação da loja — sem montar produto a
produto nem refazer o visual toda vez. Dois arquivos: **banner** (imagem, para o
status do WhatsApp e o story do Instagram) e **catálogo** (PDF, para os grupos).
A escolha dos produtos é sorteada, para cada peça sair diferente da anterior.

---

## 0. Decisões

### Fechadas com o dono (03/10/2026)

| #   | Decisão | Consequência |
| --- | ------- | ------------ |
| 1   | **A API sorteia e serve os produtos; o front desenha** a partir de um molde padrão em HTML | o bucket ganhou regra de CORS de leitura (seção 3.1); a API não ganha dependência de desenho |
| 2   | **Todos podem gerar**, não só Admin | rota sem `roles`; a tela não mostra custo, margem nem saldo |
| 3   | **Novidade = até 30 dias na loja** | acima disso entra a reimportação de 31/08/2026 e o número salta de 124 para 333 |
| 4   | **9 produtos no banner; 24 a 32 no PDF** | grade 3×3 no banner; páginas de 2 colunas no PDF |
| 5   | O tema de pouca saída chama-se **"Achados"** | o cliente não pode ler nada que soe a encalhe |
| 6   | **Cabeçalho com a arte da marca** (logotipo "Uaus! Máximo 30") | usa a própria arte, recortada — não um redesenho (seção 3.3) |
| 7   | **Aviso fixo em toda peça**: preços de referência, sujeitos a alteração; imagens ilustrativas | texto na seção 2.4, com a data dentro |
| 8   | **Ao gerar, escolhe-se o formato e o tema** (ex.: brinquedos, utilidades de cozinha, promoções e novidades) | seção 2.2 |
| 9   | "Banner" é o formato de **imagem**; "catálogo" é o **PDF** | vocabulário da tela |
| 10  | **Escolher e gerar vêm antes da prévia**, em especial no celular (depois do teste da etapa 1) | a ordem da tela é: tema e título, gerar, prévia, compartilhar, lista para trocar |
| 11  | **O contato do rodapé é o do site**, e não o de Configurações | `lib/storeContact.ts`; o cadastro de Configurações é o do cupom |
| 12  | **O nome impresso é o do cadastro**, sem edição na peça | nada a fazer; quem quer outro nome corrige o cadastro |
| 13  | **Os dois achados baixos da revisão da etapa 1 não serão corrigidos** (foto lenta que segura a tela; dois toques em Compartilhar) | ficam registrados aqui, sem tarefa |

### Decididas na implementação da etapa 2 (para o dono conferir)

| #   | Decisão | Por quê |
| --- | ------- | ------- |
| I1  | No tema Geral as **ofertas ficam com no máximo metade das âncoras** (1 das 3 do banner; 4 das 8 do PDF de 24) | sem o teto, com 4 promoções no ar todo banner geral saía com 3 delas e **nenhum** mais vendido — o terço da peça virava quase fixo (achado da revisão) |
| I2  | **O assunto do tema vence o teto de departamento** | com as novidades concentradas num departamento, o teto as barrava e "Novidades" saía completada com outros papéis |
| I3  | **A troca de um produto fica dentro do tema** | em "Mais vendidos", trocar um campeão recém-chegado só pelo papel traria uma novidade sem venda |
| I4  | O item do menu chama-se **"Catálogo"** e fica por último no grupo Marketing | não tem sequência de trabalho com cupom nem campanha |

### Decididas na implementação da etapa 3 (para o dono conferir)

| #   | Decisão | Por quê |
| --- | ------- | ------- |
| I5  | O PDF tem **24 produtos em 4 páginas de 6**, sem título de seção: a ordem do sorteio e os selos (oferta, novidade) fazem esse papel | 6 por página dá o card grande que justifica o PDF; seção com título fixo deixaria página pela metade quando o tema tem 2 ofertas. Subir para 30 (5 páginas) é trocar um número em `lib/formats.ts` |
| I6  | O banner 4:5 leva **6 produtos** | o painel dele é mais baixo: 9 cards ficariam com a foto menor que o texto |
| I7  | **O PDF só sorteia capa com 300 px ou mais** no menor lado; capa ainda não medida passa pelo servidor e é conferida no navegador | abaixo disso a foto é ampliada mais de 1,6 vez no card e borra no celular |
| I8  | A etiqueta **"Foto pequena"** é cinza, a última da ordem, e só acende com saldo; com a pastilha ligada a lista sai **por unidades vendidas em 90 dias** | não trava venda nenhuma: é fila de trabalho, e a foto que rende primeiro é a do que mais vende |
| I9  | O **link de cada produto no PDF** leva `utm_source=whatsapp`, `utm_medium=catalogo`, `utm_campaign=catalogo-AAAA-MM-DD` | são as marcas que o coletor de métricas do site já lê |
| I10 | O PDF é **escrito à mão** e o desenho roda num **worker**, com a thread principal de reserva | o jsPDF pesa 30 MB instalado; e na thread principal a tela travava a cada página |

### Em aberto

| #   | Pergunta | Recomendação |
| --- | -------- | ------------ |
| A3  | Oferta com **limite por cliente**: o site imprime "Limite de N por cliente"; o card do banner ainda não | imprimir junto do selo de oferta. Nenhuma promoção teve limite até 03/10/2026 (0 de 5) |
| A6  | Achados **baixos** da revisão do sorteio (etapa 2), sem caso no ar: oferta cujo card vem sem promoção vira "intermediário" mesmo sendo novidade; lote e venda de variação **excluída** contam para o grupo; "Novidades e promoções" com 1 ou 2 produtos nunca sorteia oferta; `POST /Catalogs/draw` sem corpo não foi provado como 400 | corrigir junto de uma próxima mexida no sorteio |
| A7  | Achados **baixos** da revisão da tela (etapa 2): a troca e o "Atualizar título" reimprimem o aviso com a data de **hoje**, mesmo com a aba aberta desde ontem; em "Novidades e promoções", trocar uma oferta traz uma novidade, e não outra oferta; o aviso "não foi possível carregar os temas" acende também numa recarga em segundo plano que falha com os temas já na tela; emoji no título sai como quadrado vazio | decidir depois da bateria de testes do dono |
| A8  | Achados **baixos** da revisão do backend da etapa 3: JPEG com mais de 512 KB de metadados antes do tamanho é gravado como ilegível (0 × 0) e fica fora da etiqueta; a medição aloca 512 KB por imagem | sem caso no acervo (113 capas conferidas contra o Pillow); corrigir se aparecer |
| A9  | Achados **baixos** da revisão da tela (etapa 3): na troca de um produto do PDF, se a foto do substituto é pequena ou não carrega, as páginas são redesenhadas antes de a troca ser recusada, e o aviso diz "não carregou" mesmo quando a foto é pequena; a página guardada não percebe a troca da FOTO de um produto na mesma sessão; se a rede pendurar ao baixar o renderizador, a tela fica em "Montando…" até recarregar (já era assim antes do worker); na promoção para produção o **backend sobe primeiro** — sem ele o PDF fica desabilitado e a ajuda de Anomalias imprime "undefined px" | decidir depois da bateria de testes do dono; a ordem da promoção é regra, não pendência |

---

## 1. O que foi medido

| Medida | Valor |
| ------ | ----- |
| Cadastros (grupos) com saldo e foto — o universo do catálogo | **737** (736 já no site) |
| Com saldo, sem foto (ficam de fora) | 40 |
| Venderam nos últimos 90 dias | 368 |
| Não venderam em 90 dias | 369 |
| Novidades (até 30 dias na loja) | 124 — 92 nos últimos 15 dias |
| Promoções vigentes | 4 |
| Capas com menos de 300 px no menor lado | ~290 (39%) — as miniaturas da carga do Mais PDV (mediana 225 px) |
| Preço (menor do grupo): mediana / p90 | R$ 12,00 / R$ 30,00 |
| Nome do cadastro: mediana / p90 / maior | 29 / 43 / 63 caracteres |

Três consequências:

- **A curva ABC não serve de base.** Ela só enxerga quem vendeu, e metade do
  universo (369) não vendeu em 90 dias — justamente a "pouca saída" que o
  catálogo quer promover. A base é a do Desempenho de Produtos: vendeu **ou**
  tem saldo.
- **A foto pequena limita o tamanho do card.** Em 3 colunas (banner) a
  miniatura de 225 px aparece no tamanho real; em 2 colunas (PDF) ela borra.
- **Departamento desequilibra o sorteio.** Cozinha tem 227 cadastros de 737, e
  Livros tem 88 dos quais só 4 venderam em 90 dias — sem teto, quase um quarto
  da "pouca saída" seria livro.

---

## 2. Regras de negócio

### 2.1 Quem pode entrar

Cadastro **visível no site** (mesmo predicado da vitrine), com **saldo** e com
**foto**. Só o que está no site, por dois motivos: o preço sai da mesma conta do
site e do balcão, e todo produto do PDF tem página para onde o link aponta.
Custo e saldo nunca saem para a peça.

### 2.2 Formato e tema

| Formato | Arquivo | Produtos |
| ------- | ------- | -------- |
| Banner 9:16 | imagem 1080×1920 (status e story) | 9, em 3×3 |
| Banner 4:5 | imagem 1080×1350 (grupo e feed) | 6 por imagem |
| Catálogo | PDF em páginas verticais de 1080×2340 (540×1170 pt), 2 colunas | 24, em 4 páginas de 6; cada produto é um link para o site |

Temas: **Geral** (mistura inteligente), **Novidades e promoções**, **Mais
vendidos**, **Achados** e **um por departamento**. O tema dá o título do
cabeçalho (editável: "Cozinha" pode virar "Utilidades de cozinha") e filtra o
sorteio. Dentro de um departamento a mistura continua valendo.

Oito departamentos têm produto para um PDF de 24 ou mais: Cozinha (227),
Brinquedos (147), Livros (88), Beleza (63), Jardinagem (33), Acessórios,
Tecnologia e Banheiro e Limpeza (27 cada). Casa e Decoração (23), Mercearia e
Papelaria (12) rendem banner ou catálogo curto. Os outros dez têm menos de 10 e
entram só no Geral.

### 2.3 O sorteio (API)

Cada cadastro elegível recebe **um** papel, por prioridade:

| Papel | Regra | Em 03/10/2026 |
| ----- | ----- | ------------- |
| Oferta | promoção vigente (com o de/por do site) | 4 |
| Novidade | até 30 dias na loja — a data mais antiga entre o cadastro e a primeira entrada | 124 |
| Mais vendido | terço de cima em unidades vendidas em 90 dias (6 ou mais) | 123 |
| Intermediário | vendeu de 1 a 5 unidades | 245 |
| Pouca saída | não vendeu em 90 dias e não é novidade | 277 |

- **Mistura "inteligente"** (tema Geral): um terço de âncoras (mais vendidos e
  ofertas), um terço de novidades e um terço de descobertas — dois de pouca
  saída para cada intermediário. **As ofertas ficam com no máximo metade das
  âncoras**: oferta tem tema próprio, e no geral ela divide a vitrine. A peça
  sai nessa ordem (âncoras, novidades, descobertas).
- **Novidades e promoções**: até um terço de ofertas, o resto de novidades.
  **Mais vendidos**: o terço de cima em unidades, inclusive o campeão que está
  em oferta. **Achados**: só pouca saída. **Departamento**: a mistura geral
  dentro dele.
- **Faltando cadastro num papel, os outros completam**: melhor a peça cheia do
  que a regra exata.
- **Sorteio com peso**, com semente: nos mais vendidos pesa a quantidade
  vendida; na pouca saída, o dinheiro parado na prateleira; nas novidades, a
  mais recente. Semente injetada, para o teste afirmar o que saiu.
- **Teto por departamento**: um terço das vagas — menos no tema de
  departamento e com menos de três departamentos em jogo. **O assunto do tema
  vence o teto**: antes de outro papel entrar, o papel do tema é sorteado de
  novo sem ele.
- **Troca de um produto**: outro do mesmo papel, **dentro do tema**, sem repetir
  quem está na peça nem quem já foi trocado.
- **Reservas** à parte, para a foto que não carregar. Nunca ofertas.
- **Venda cancelada não conta**, como em todo o BI.
- A regra mora em `CatalogDrawRules` (`static`, sem banco, com o acaso
  injetado), no molde de `ProductScoreRules`. O serviço faz quatro consultas
  agregadas e pede o card de cada sorteado à vitrine (`GetCardsAsync`).

Medido contra a dev em 03/10/2026: 608 elegíveis; ~11 idas ao banco por
sorteio, 1,5 s rodando daqui (a medição local exagera cerca de 8 vezes o custo
em produção).

### 2.4 O que cada peça imprime

- **Card**: foto, nome em até duas linhas, preço grande, "a partir de" quando
  há faixa de preço, "de" riscado na oferta (só com corte acima de 5%, regra do
  servidor) e **um** selo — Oferta vence Novidade, que vence Últimas unidades.
- **Cabeçalho**: a arte da marca e o título do tema.
- **Rodapé**: endereço, WhatsApp, site e o aviso, com a data da geração:

  > Preços de referência em dd/mm/aaaa, sujeitos a alteração sem aviso e à
  > disponibilidade de estoque. Imagens meramente ilustrativas.

  A data vai **dentro** do aviso porque a imagem circula por dias.
- **No PDF**, cada produto é link para `/produtos/:id` do site, com
  `utm_source=whatsapp&utm_medium=catalogo&utm_campaign=catalogo-aaaa-mm-dd`. O
  site já registra a origem da visita: o BI › Analytics passa a mostrar o que
  cada catálogo trouxe, sem código novo de medição.

---

## 3. Arquitetura

### 3.1 O front desenha, e por isso o bucket tem CORS

O navegador só lê os pixels de uma foto de outra origem se o servidor dela
autorizar. Regra aplicada no `uaus-bucket` em 03/10/2026 (o bucket não tinha
nenhuma): `GET` e `HEAD` para `https://admin.uaus.com.br`,
`https://admin-dev.uaus.com.br`, `http://localhost:5173` e
`http://localhost:5273`. É só leitura e não torna nada mais público — as fotos
já eram abertas. **Host novo do admin precisa entrar nessa lista.**

Armadilha: o admin já mostra as mesmas fotos em `<img>` comum, e o navegador
guarda a resposta **sem** o cabeçalho de CORS. O gerador busca a foto com
`cache: "no-store"`; lida do cache, ela seria recusada mesmo com a regra no ar.

### 3.2 O molde é HTML, mas quem desenha não é o navegador

"Fotografar a página" (html2canvas e parentes) depende do motor de cada
aparelho e falha no Safari. O caminho escolhido dá o mesmo resultado em qualquer
celular:

1. o **satori** calcula o layout do molde (JSX com CSS inline, só flexbox) e o
   converte em SVG, com o texto já em curvas pela fonte embutida (Montserrat);
2. o **resvg** (WebAssembly) pinta o SVG em pixels;
3. um canvas fecha o JPEG.

Consequências: o molde só usa o subconjunto de CSS do satori (sem grid; todo
`div` com mais de um filho precisa de `display: flex`), e há um teste que passa
o molde pelo satori de verdade. As duas bibliotecas entram por `import()`
dinâmico, em chunk próprio (`vendor-catalogo`).

**Satori fixado em 0.32.0.** A 0.33 trouxe o HarfBuzz, que carrega um
WebAssembly por caminho relativo e não resolve dentro do bundle do Vite.

Medido em 03/10/2026, no navegador de mesa: o desenho de um banner de 9 produtos
leva **~2,0 s** (era 3,2 s com PNG intermediário) e o arquivo sai com **~470 KB**.
A busca dos produtos (0,8 s) e das fotos (0,3 s) soma cerca de 1 s a isso. Com a
aba em segundo plano o navegador baixa a prioridade e a mesma geração leva mais
de 5 s — medição feita assim não vale.

Peso: `vendor-catalogo` com 515 KB (~170 KB comprimidos) e o WebAssembly do resvg
com 2,4 MB (~950 KB comprimidos), baixados ao abrir a tela e guardados pelo
navegador. O `vendor` comum do admin não mudou (414 KB antes e depois).

### 3.3 A arte do cabeçalho

`Artes/catalogo/` (fora do git, convenção das peças gráficas): a arte original e
o gerador `gerador/gerar_fundos.py`, que recorta o logotipo e o assenta sobre a
mesma textura laranja estendida por espelhamento. As medidas do gerador são as
de `template/geometry.ts` — mudou num, mude no outro.

### 3.4 Onde mora cada coisa

| Peça | Onde |
| ---- | ---- |
| Molde, geração e tela | `apps/admin/src/features/marketing-catalog/` (README com as regras) |
| Rota | `/marketing/catalogo`, sem `roles`; item "Catálogo" do grupo Marketing |
| Sorteio | `Uaus.Backend.Api`: `CatalogsController` (`GET /Catalogs/themes`, `POST /Catalogs/draw`, qualquer usuário autenticado), `Services/Catalogs/` |
| Cliente | `packages/api-client/src/hooks/catalogs.ts` e os DTOs em `models.ts` |

---

## 4. Etapas

| #   | Entrega | Estado |
| --- | ------- | ------ |
| 1   | CORS no bucket; molde padrão; banner 9:16 "Novidades e promoções" com produtos reais; sortear de novo, compartilhar e baixar | **feita em 03/10/2026**; testada e aprovada pelo dono no celular (~6 s para gerar, com leves travadas; salvar e compartilhar funcionaram) |
| 2   | Sorteio na API (papéis, mistura, teto por departamento); escolha de tema e título; trocar um produto; item no menu Marketing; controles antes da prévia | **feita em 03/10/2026** |
| 3   | Catálogo PDF com links rastreados; banner 4:5; largura e altura em `images`; etiqueta "Foto pequena" em Anomalias; atalho no BI › Desempenho de Produtos; desenho fora da thread principal | **feita em 03/10/2026** |
| 4   | Histórico das peças compartilhadas: não repetir quem saiu nas últimas e medir vendas antes e depois | depois de algumas semanas de uso |

### O que ainda não está garantido

- **O celular de verdade.** O worker tirou a travada no computador (maior pausa
  da tela ao gerar: de 2,1 s para menos de 0,1 s) e o PDF abre no leitor do
  Chromium. Compartilhar o PDF pela folha do Android e do iPhone, e o tempo de
  gerar 4 páginas no celular, só o teste do dono mostra. No computador: banner
  ~3 s, banner 4:5 ~2,3 s, PDF de 24 produtos ~4 s (1,3 MB), troca de um
  produto no PDF ~1,7 s.
- **A medição do acervo leva algumas rodadas.** A rotina de fundo mede 400
  imagens a cada 15 minutos. Enquanto não termina, a contagem de "foto grande"
  de cada tema está inflada (capa não medida conta como grande) e a etiqueta
  "Foto pequena" ainda cresce. O PDF não sai errado por isso: o navegador
  confere o tamanho de cada foto antes de desenhar.
