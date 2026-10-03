# Marketing › Catálogo de divulgação (plano técnico)

> **Estado: decisões fechadas com o dono em 03/10/2026; etapa 1 implementada na
> `dev` no mesmo dia.** Este arquivo é o contrato da feature: toda camada
> codifica contra ele, e divergência se corrige aqui primeiro.
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

### Em aberto

| #   | Pergunta | Recomendação |
| --- | -------- | ------------ |
| A1  | O contato do rodapé repete o do site (endereço, WhatsApp da loja). Deve vir de Configurações? | manter o do site; o cadastro de Configurações é o do cupom (caixa alta, celular de sócio) |
| A2  | O nome impresso é o do cadastro, com código de fornecedor ("ESCORREDOR DE MASSA 22CM 13339 INOX") | permitir editar o nome só na peça, como nas etiquetas de gôndola (etapa 2) |
| A3  | Oferta com **limite por cliente**: o site imprime "Limite de N por cliente"; o card do banner ainda não | imprimir junto do selo de oferta na etapa 2. Nenhuma promoção teve limite até 03/10/2026 (0 de 5) |
| A4  | Foto que **demora** (conexão pendurada) segura a tela em "Montando o banner…": a folga cobre foto que falha, não foto lenta (achado baixo da revisão) | tempo máximo por foto, cedendo a vaga à reserva |
| A5  | Dois toques seguidos em "Compartilhar": o segundo é recusado pelo aparelho e cai no download, com o aviso "Banner salvo" (achado baixo da revisão) | desabilitar o botão enquanto a folha está aberta |

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
| Catálogo | PDF em páginas verticais, 2 colunas | 24 a 32, em seções |

Temas: **Geral** (mistura inteligente), **Novidades e promoções**, **Mais
vendidos**, **Achados** e **um por departamento**. O tema dá o título do
cabeçalho (editável: "Cozinha" pode virar "Utilidades de cozinha") e filtra o
sorteio. Dentro de um departamento a mistura continua valendo.

Oito departamentos têm produto para um PDF de 24 ou mais: Cozinha (227),
Brinquedos (147), Livros (88), Beleza (63), Jardinagem (33), Acessórios,
Tecnologia e Banheiro e Limpeza (27 cada). Casa e Decoração (23), Mercearia e
Papelaria (12) rendem banner ou catálogo curto. Os outros dez têm menos de 10 e
entram só no Geral.

### 2.3 O sorteio (API, etapa 2)

Cada cadastro elegível recebe **um** papel, por prioridade:

| Papel | Regra | Em 03/10/2026 |
| ----- | ----- | ------------- |
| Oferta | promoção vigente (com o de/por do site) | 4 |
| Novidade | até 30 dias na loja — a data mais antiga entre o cadastro e a primeira entrada | 124 |
| Mais vendido | terço de cima em unidades vendidas em 90 dias (6 ou mais) | 123 |
| Intermediário | vendeu de 1 a 5 unidades | 245 |
| Pouca saída | não vendeu em 90 dias e não é novidade | 277 |

- **Mistura "inteligente"** (tema Geral): um terço de novidades, um terço de
  mais vendidos (as ofertas entram aqui), um terço de pouca saída com
  intermediários.
- **Sorteio com peso**, com semente: nos mais vendidos pesa a quantidade
  vendida; na pouca saída, o dinheiro parado na prateleira; nas novidades, a
  mais recente. Semente injetada, para o teste afirmar o que saiu.
- **Teto por departamento**: um terço das vagas.
- **Venda cancelada não conta**, como em todo o BI.
- A regra mora num `static` sem banco, no molde de `ProductScoreRules`.

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
| Rota | `/marketing/catalogo`, sem `roles`; oculta do menu até a etapa 2 |
| Sorteio (etapa 2) | `Uaus.Backend.Api`, serviço e regra próprios, `POST /Catalogs/draw` |

---

## 4. Etapas

| #   | Entrega | Estado |
| --- | ------- | ------ |
| 1   | CORS no bucket; molde padrão; banner 9:16 "Novidades e promoções" com produtos reais; sortear de novo, compartilhar e baixar | **feita em 03/10/2026** — produtos sorteados da vitrine pública, provisório |
| 2   | Sorteio na API (papéis, mistura, teto por departamento); escolha de tema e título; trocar um produto; item no menu Marketing | a fazer |
| 3   | Catálogo PDF com seções e links rastreados; banner 4:5; largura e altura em `images`; etiqueta "Foto pequena" em Anomalias; atalho no BI › Desempenho de Produtos | a fazer |
| 4   | Histórico das peças compartilhadas: não repetir quem saiu nas últimas e medir vendas antes e depois | depois de algumas semanas de uso |

### O que a etapa 1 NÃO garante

- **Saldo.** A vitrine pública não expõe saldo, então o sorteio provisório pode
  escolher produto esgotado. A etapa 2 resolve no servidor.
- **Novidade de verdade.** "Mais recente" aqui é a ordem da vitrine (cadastro
  mais novo primeiro), não os 30 dias de loja.
- **iPhone.** A geração foi provada no Chromium. O teste no Safari do celular é
  do dono, no ambiente de dev.
