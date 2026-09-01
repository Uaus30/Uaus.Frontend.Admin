# Plano de design — `apps/loja` (site público da Uaus)

> Escrito em 29/08/2026, a partir de revisão do site rodando em
> `localhost:5175` e leitura completa de `apps/loja/src`. O pedido do dono foi:
> _"revisar o design e sugerir melhorias — fonte, cores, seções, cabeçalho — eu
> queria um site com aparência um pouco mais profissional"_.
>
> **STATUS (29/08/2026, mesmo dia): Fases 0 a 6 executadas.** O dono escolheu a
> Opção A da Fase 1 (**Archivo + Inter**) e mandou executar tudo.
>
> Uma coisa ficou de fora, e não por esquecimento:
>
> - **Ladrilhos de categoria (Fase 4, item 3).** Era condicional — "depende de a
>   busca aceitar categoria". Não aceita: `/Storefront/products?search=BELEZA`
>   devolve zero para o produto de categoria "BELEZA EM GERAL" (só nome e
>   descrição entram na busca). Filtrar por categoria exige mudança no
>   `StorefrontController` do repo vizinho `Uaus.Backend.Api`.
>
> Verificado: `npm test` (1.474 testes, 7 workspaces), `npm run typecheck:loja`,
> `npm run lint` (0 erros), `npm run build:loja`, e smoke test das quatro telas
> em `localhost:5175` — home, vitrine, detalhe do produto e contato, com
> auditoria de contraste medida no DOM (tabela na seção 4).
>
> **Rodadas 2 e 3, no mesmo dia.** O dono reverteu a fonte e o cabeçalho, e
> depois achou a saída que fecha a briga entre marca e contraste: **cabeçalho
> escuro, igual ao rodapé**. O caminho inteiro está na seção 3.5. Em uma linha:
> a **identidade** voltou (Outfit, logo com glow, laranja vivo nos textos), e o
> contraste do cabeçalho foi resolvido escurecendo a barra em vez de clarear.
> E o horário de funcionamento deixou de ser pendência: chegou do dono e está
> em `SITE_OPENING_HOURS`.

---

## 1. Diagnóstico — por que o site parece amador hoje

O site não está mal construído: a arquitetura é boa, os componentes são puros,
o conteúdo é real. O que empurra a percepção para baixo é **excesso de ênfase**.
Tudo grita ao mesmo tempo — peso 900, gradiente, sombra `2xl`, salto no hover,
pulso infinito — e quando tudo é destaque, nada é.

Abaixo, o que foi medido, não achado.

### 1.1 O laranja da marca não pode carregar texto (o achado mais grave)

`#FF751A` tem luminância alta demais. Texto branco em cima dele dá **2,69:1**.
A WCAG AA pede 4,5:1 para texto normal e 3:1 para texto grande — o laranja
reprova nos dois.

| Onde | Par | Contraste | AA |
| ---- | --- | --------- | -- |
| Nav do cabeçalho, item inativo (`text-white/80`) | branco 80% sobre `#FF751A` | **2,20:1** | ✗ |
| Subtítulo dos mastheads (`text-white/90`) | branco 90% sobre `#FF751A` | **2,43:1** | ✗ |
| Nav ativo, "MÁXIMO 30 REAIS", rótulo dos botões | branco sobre `#FF751A` | **2,69:1** | ✗ |
| **Preço no card e no detalhe** (`text-primary` sobre branco) | `#FF751A` sobre branco | **2,69:1** | ✗ |
| CNPJ e copyright do rodapé (`text-white/40`) | branco 40% sobre `#0F1729` | **3,81:1** | ✗ |

O preço é o número mais importante da loja inteira e é o que menos se lê. Isso
não é preciosismo de acessibilidade: é o motivo pelo qual a página parece
"lavada" em tela de celular no sol.

Um laranja escurecido para `#C24F09` resolve os dois sentidos de uma vez
(**4,76:1** sobre branco e com branco por cima). O laranja vivo continua válido
onde **não há texto**: preenchimento de ícone, faixa, borda, fundo de selo.

### 1.2 Peso 900 em tudo — inclusive onde ele não existe

`font-black` aparece em 11 lugares. Dois deles são os **CTAs mais importantes do
site** — "RESERVAR PELO WHATSAPP" (`pages/product-detail.tsx:141`) e "CHAMAR NO
WHATSAPP" (`features/contact/components/ContactInfo.tsx:67`). Ambos são `<a>`,
então usam a fonte de corpo, e o `index.html` carrega Plus Jakarta Sans **só até
700**:

```
Outfit:            400 500 600 700 800 900
Plus Jakarta Sans: 400 500 600 700          <- 900 pedido, 700 entregue
```

O navegador cai no peso mais próximo disponível. O destaque que o autor quis
nesses dois botões simplesmente **não acontece** — e ninguém percebeu porque
tudo em volta também é bold.

### 1.3 Gradiente como padrão, não como exceção

`bg-gradient-to-r from-primary to-orange-400` está em todo botão primário, no
cartão da faixa escura (`from-primary to-orange-600`), e ainda há
`bg-clip-text` gradiente no `<h1>` da home mais um blob radial de 800px
desfocado atrás. Gradiente laranja→laranja a 15° de diferença não comunica nada;
só tira a nitidez da borda e do texto.

### 1.4 Movimento sem sistema — e sem freio de acessibilidade

- `hover:-translate-y-2` no card, `hover:scale-110` na imagem e na logo,
  `hover:-translate-y-1` nos botões: a página inteira flutua ao passar o mouse.
- `animate-pulse-glow` **infinito** nos dois botões de WhatsApp. Botão que pisca
  para sempre é a assinatura visual de página de captura de lead.
- `transition-all duration-700` nesses mesmos botões — 700ms é lento demais para
  hover; a resposta parece atrasada.
- **Zero ocorrências de `prefers-reduced-motion` no app.** Nem no CSS, nem no
  framer-motion (que tem `useReducedMotion` pronto). Quem configurou o sistema
  para reduzir animação recebe tudo mesmo assim.

### 1.5 A home de uma loja não mostra um único produto

Hero → faixa escura → carrossel da loja → três cartões de destaque. Todas as
quatro seções são institucionais. O catálogo existe, o endpoint público existe,
o hook existe — e mesmo assim o visitante precisa clicar em "Produtos" para ver
que a loja tem produtos. É a maior lacuna **estrutural** do site.

### 1.6 Faltam os sinais de que a loja é de verdade

Horário de funcionamento não aparece em lugar nenhum (pendência conhecida,
anotada no `VisitBanner.tsx`). Formas de pagamento, também não. Para comércio
local, horário é o dado mais consultado depois do endereço — e a ausência dele
é lida como "site abandonado".

### 1.7 Detalhes menores, mesmo assim visíveis

- `<span className="block h-4 md:h-8" aria-hidden />` dentro do `<h1>` da home
  para forçar quebra de linha. Espaçador dentro de heading é gambiarra de
  layout; `<br />` ou dois blocos resolvem sem elemento fantasma.
- `bg-gray-100` no carrossel (`StoreCarousel.tsx:41`) é a única cor crua fora do
  sistema de tokens do arquivo.
- Nenhum `focus-visible` definido para links do cabeçalho e para o card de
  produto. O anel padrão do navegador some contra o laranja.
- `object-cover` no card corta foto de produto vertical. Para catálogo,
  `object-contain` sobre fundo neutro mostra o produto inteiro.
- O endereço vem do admin em **caixa alta** ("RUA PARANAGUÁ, 663 — TAPIRA - PR")
  e é impresso como veio, ao lado de textos em caixa mista. É dado, não design —
  corrigir no cadastro ou normalizar na exibição.

---

## 2. Direção proposta

> **Cromo silencioso, produto alto.** A loja vende variedade barata: quem tem
> que gritar é a foto e o preço, não a moldura. Hoje é o contrário — a moldura
> grita e o preço fica em laranja ilegível.

Três regras que resolvem quase tudo:

1. **Laranja é acento, não superfície de texto.** Fundo grande vira branco,
   areia (`#FAFAF9`) ou o azul-escuro que já existe (`#0F1729`).
2. **Um destaque por bloco.** Se o preço é o destaque do card, o nome não é
   bold. Se o CTA é laranja sólido, o secundário é contorno neutro.
3. **Movimento confirma, não entretém.** 150–200ms, no máximo 2px de
   deslocamento, e nada infinito.

---

## Fase 0 — Ícones de marca ✅ FEITO (29/08/2026)

O rodapé, a página de contato e o botão de reserva usavam `MessageCircle` do
lucide — um balão de conversa genérico — no lugar do WhatsApp. O lucide-react
removeu os ícones de marca na v1, e o balão entrou como substituto.

- **Novo** `src/components/icons/WhatsAppIcon.tsx` — glifo oficial, sólido,
  `currentColor`, viewBox 24.
- **Reescrito** `src/components/icons/InstagramIcon.tsx` — era contorno estilo
  lucide; virou o glifo oficial sólido, para casar com o do WhatsApp nos dois
  botões redondos vizinhos do rodapé.
- Trocado em `SiteFooter.tsx:61`, `ContactInfo.tsx:17` e
  `product-detail.tsx:143`.

Verificado: `npm run typecheck:loja`, `npm run test:loja` (52 testes),
`npx eslint` nos arquivos tocados, e conferência visual dos glifos renderizados
de 64px a 16px no navegador.

---

## Fase 1 — Tipografia

**Decisão pendente: qual par de fontes.** Duas opções defensáveis:

| | Opção A (recomendada) | Opção B (conservadora) |
| --- | --- | --- |
| Display | **Archivo** 600/700/800 | **Outfit** (fica), 600/700/800 |
| Corpo | **Inter** 400/500/600/700 | **Inter** 400/500/600/700 |
| Ganho | Archivo é grotesca com peso editorial: nos títulos de oferta soa confiante em vez de infantil, e ocupa menos largura, então a manchete cabe em menos linhas | Muda uma fonte só; risco menor de estranhar a marca |
| Custo | Duas famílias novas | Outfit em 800 ainda é bem redonda |

Nos dois casos o **corpo vira Inter**, e essa é a parte que mais importa: o
texto pequeno do site (nav 14px caixa alta, rótulo de categoria 12px caixa alta,
rodapé 14px, preço) é onde o Plus Jakarta Sans embola. Inter foi desenhada
exatamente para essa faixa.

Independente da escolha:

- **Teto de peso 800.** `font-black` sai de todo lugar. Título em 700/800,
  subtítulo em 600, corpo em 400/500.
- **Carregar os pesos que se usa, e só eles.** Hoje se carrega Outfit 400→900
  (6 pesos) e se usa 3. Cortar reduz o CSS de fonte e o tempo até o texto.
- **Escala menor:** `<h1>` da home de `text-5xl md:text-7xl` (48→72px) para
  `text-4xl md:text-6xl` (36→60px). Mastheads de `text-4xl md:text-6xl` para
  `text-3xl md:text-5xl`.
- Nos dois CTAs de WhatsApp, `font-black` → `font-bold` (é o que já renderiza
  hoje; a mudança tira a mentira do código).
- `letter-spacing: -0.025em` em h1–h6 fica; ajuda no aperto dos títulos.

**Arquivos:** `index.html` (link do Google Fonts), `src/index.css`
(`--app-font-sans`, `--app-font-display`), e um passe de `font-black` →
`font-bold`/`font-extrabold` nos 11 pontos listados em §1.2.

---

## Fase 2 — Cor e contraste

1. **Novo token `--primary-strong: 22 91% 40%`** (`#C24F09`) em
   `src/index.css`, exposto como `--color-primary-strong` no `@theme inline`.
   Usar em **todo texto laranja** e em todo fundo laranja que carrega texto.
   `--primary` (`#FF751A`) continua para ícone, faixa, selo e borda.
2. **Preço** (`PriceTag.tsx`) passa a `text-primary-strong`. É a linha de maior
   impacto do plano inteiro.
3. **Mastheads de `/produtos` e `/contato`** deixam de ser laranja chapado.
   Proposta: fundo `bg-foreground` (o mesmo `#0F1729` do rodapé) com o termo
   destacado em laranja vivo — que sobre escuro dá **6,65:1** e fica legítimo.
   Alternativa mais leve: fundo branco com um filete laranja embaixo.
4. **Rodapé:** `text-white/40` → `text-white/60` (3,81:1 → **6,99:1**) na linha
   de copyright e CNPJ; `text-white/60` da tagline → `text-white/70`.
5. **Gradientes fora.** Botão primário vira `bg-primary` sólido com
   `hover:bg-primary-strong`. O `bg-clip-text` do `<h1>` vira cor sólida. O blob
   radial do hero sai ou cai para `opacity-40`.
6. **Fundo de página:** `bg-orange-50/50` (um lavado alaranjado que suja a foto
   do produto) → `#FAFAF9` neutro. O produto é que traz cor.
7. `bg-gray-100` do carrossel → `bg-muted`.

---

## Fase 3 — Cabeçalho

Hoje: 96px de altura, laranja chapado, logo de 80px com halo branco desfocado
mais `drop-shadow` de brilho e `scale-110` no hover. É a primeira coisa que se
vê e é a mais pesada da página.

**Proposta — inverter:**

```
┌──────────────────────────────────────────────────────────────┐
│ ▸ Rua Paranaguá, 663 — Tapira-PR   ·   Seg–Sáb, 9h–18h      │  faixa fina escura (28px)
├──────────────────────────────────────────────────────────────┤
│  [logo 40px] Uaus! MÁXIMO 30    Início Produtos Contato      │  branco, 72px,
│                                          [ Falar no WhatsApp ]│  borda hairline
└──────────────────────────────────────────────────────────────┘
```

- Fundo **branco** com `border-b border-border`; ao rolar, ganha sombra sutil.
  Some o halo, some o `drop-shadow`, some o `scale-110`.
- Logo em 40–48px. A marca não precisa de brilho para ser vista sobre branco.
- Nav em `text-foreground`, item ativo com filete laranja embaixo — resolve o
  contraste de 2,20:1 de graça.
- **CTA de WhatsApp fixo no cabeçalho.** É a única conversão do site e hoje só
  existe no rodapé, no contato e no detalhe do produto.
- **Faixa superior escura com endereço + horário.** É o sinal mais barato de
  "loja de verdade" que existe. Depende de definir o horário (§1.6).
- `focus-visible:ring-2 ring-primary-strong ring-offset-2` nos links.

Menu mobile: manter o painel, com fundo branco e itens escuros.

---

## Fase 4 — Seções da home

Ordem proposta (as duas novas em **negrito**):

1. **Hero** — mais curto (`pt-16 pb-20`), sem gradiente no texto, com uma prova
   ao pé: "Mais de N produtos no site · Reserva pelo WhatsApp · Tapira-PR".
2. **Destaques do catálogo — NOVO.** 8 produtos reais em faixa horizontal,
   reusando `ProductCard`, com "Ver todos os produtos →". Fonte: o mesmo hook do
   catálogo, primeira página. É a seção que falta para o site parecer uma loja.
3. **Categorias — NOVO (opcional).** 6 ladrilhos (Casa, Cozinha, Brinquedos,
   Ferramentas, Papelaria, Presentes) levando à vitrine já filtrada. Depende de
   a busca aceitar categoria; se não aceitar, fica para depois.
4. **Faixa "Venha conhecer"** — fica. Acrescentar a terceira linha de horário no
   cartão (o TODO que já está no arquivo) e trocar o gradiente do cartão por
   laranja sólido.
5. **Carrossel da loja** — fica. Setas sempre visíveis no mobile (hoje só
   aparecem no `group-hover`, que não existe em toque).
6. **Destaques (3 cartões)** — fica, com o cartão do meio em
   `bg-primary-strong` e o texto "reclame ;D" revisto: piada tira credibilidade
   justamente no bloco que promete o preço.

---

## Fase 5 — Vitrine e card de produto

- Card: `hover:-translate-y-2` → `hover:-translate-y-0.5` + `hover:shadow-lg`;
  `shadow-md` de repouso → `border border-border` + `shadow-sm`.
- Imagem: `object-cover` → `object-contain` com padding sobre `bg-white`, para
  não decapitar produto vertical.
- Nome do produto em `font-medium` (não `font-bold`) — quem tem que pesar é o
  preço.
- Grade `lg:grid-cols-4` → `xl:grid-cols-5` acima de 1280px; hoje sobra
  respiro lateral em monitor grande.
- `focus-visible` no card inteiro (é um `<Link>` que envolve tudo).
- Selos (`TagRibbons`): a cor vem do admin e pode ser clara; calcular a
  luminância e escolher texto branco ou escuro. Etiqueta amarela com texto
  branco é ilegível hoje.

---

## Fase 6 — Movimento e acessibilidade

- `@media (prefers-reduced-motion: reduce)` no `index.css` zerando duração de
  transição e animação; `useReducedMotion()` do framer-motion nos componentes
  com `motion.*` (hero, faixa, carrossel).
- `animate-pulse-glow` infinito → dispara 3 vezes e para, ou some.
- `transition-all duration-700` → `transition-colors duration-200` nos CTAs.
- Padronizar: `duration-200` para cor e sombra, `duration-300` para transform.

---

## 3. Ordem de execução e gates

| Fase | Risco | Ganho aparente | Ordem sugerida |
| ---- | ----- | -------------- | -------------- |
| 2 — cor e contraste | baixo | **alto** | 1º |
| 1 — tipografia | baixo | **alto** | 2º |
| 3 — cabeçalho | médio | **alto** | 3º |
| 6 — movimento | baixo | médio | 4º |
| 5 — vitrine | baixo | médio | 5º |
| 4 — seções da home | médio (dado novo) | alto | 6º |

Cada fase termina com `npm run typecheck:loja`, `npm run test:loja`,
`npm run lint` e smoke test das três páginas no `localhost:5175` — console sem
exceção, `/storefront/*` respondendo, header/rodapé/vitrine renderizando (gate
de regressão do CLAUDE.md §8).

**Freio:** nada aqui toca `vercel.json`, migração ou segredo. Mas Fase 3 e 4
mudam tela, então o push só sai depois do smoke test descrito acima.

---

## 3.5. Segunda rodada — o que o dono reverteu, e por quê

Depois de ver o resultado, o dono pediu a identidade de volta. O pedido tem um
argumento que o plano original não tinha: **a fachada física da loja é
laranja**, e o cabeçalho é a fachada do site. Isso não é gosto — é
continuidade de marca entre a rua e a tela, e vale mais que a régua da WCAG num
elemento que carrega três palavras de navegação.

| O que | Estado |
| ----- | ------ |
| Fonte Archivo + Inter | **Revertida** para Outfit + Plus Jakarta Sans |
| `font-black` (900) nos títulos | **Voltou** — só na Outfit, que tem o peso |
| Cabeçalho branco de 72px | **Revertido** para laranja de 96px — e depois para navy (rodada 3) |
| Logo de 44px sem halo | **Revertida** para 80px com glow e `scale-110` |
| Faixa de endereço acima do cabeçalho | **Movida para baixo** dele, em fundo claro |
| CTA de WhatsApp no cabeçalho | **Ficou**, agora com contorno branco |
| Tudo da Fase 2 fora do cabeçalho | **Ficou** (preço, mastheads, rodapé, botões) |
| Fases 4, 5 e 6 | **Ficaram** inteiras |

Três coisas sobreviveram à reversão do cabeçalho porque não custam identidade
nenhuma: a nav em **branco puro** (era `white/80`, 2,20:1 — agora 2,69:1, o
teto de qualquer texto branco sobre esse laranja), o **anel de foco branco**
para navegação por teclado, e o **CTA de WhatsApp**, que antes só existia no
rodapé, no contato e no detalhe do produto.

### Terceira rodada — o cabeçalho escuro resolve a briga

A pergunta do dono foi direta: com o laranja de volta, o problema de contraste
voltou também? Voltou — e a resposta útil não era "é o preço da fachada", era
desfazer a premissa. **O problema nunca foi o laranja, foi o branco em cima
dele.**

Medida a rampa inteira do laranja da marca (hue 24, saturação 100%), não existe
lightness que passe em 4,5:1 com texto branco sem virar marrom: em L=40% ainda
são 4,4:1 e a cor já não é a da fachada. Mas o navy `#0F1729` sobre o **mesmo**
`#FF751A` dá **6,65:1**.

Cinco variantes foram renderizadas com a logo e as fontes reais para o dono
escolher: (A) laranja + branco, como estava; (B) laranja + texto navy; (C)
híbrida, nav navy e wordmark branco; (D) laranja escurecido + branco; e (E)
**escuro como o rodapé** — ideia do dono, e a escolhida.

A E resolve as duas coisas de uma vez:

- **Contraste:** wordmark laranja **6,65:1**, nav branca **17,87:1**, tagline
  **11,68:1**. Tudo passa, com folga.
- **Presença:** a objeção à barra branca era que ela sumia como única faixa
  clara brigando com as seções escuras. O navy não briga — ele **fecha o par
  com o rodapé**, e a página ganha moldura escura em cima e embaixo com o
  laranja vivendo no meio.
- **Identidade:** o laranja não saiu do cabeçalho. Mudou de papel: era o fundo
  de três palavras de navegação, virou o wordmark e o filete do item ativo.

Efeito colateral resolvido junto: os mastheads de `/produtos` e `/contato`
haviam virado navy na Fase 2, e com o cabeçalho também navy a faixa clara de
endereço entre os dois virou uma emenda. Foram para **laranja com texto navy**
(6,65:1) — a variante B aplicada onde ela não custa nada, e que devolve ao
laranja uma faixa grande de verdade.

### O laranja dos textos voltou ao tom vivo

Ainda na rodada 3, o dono pediu o `#FF751A` de volta em todo texto laranja — o
titulo do hero, o preço, os ícones. `--primary-strong` deixou de ser cor de
texto e ficou só como **superfície** que carrega branco (botão primário, cartão
do VisitBanner) e como anel de foco.

O custo, assumido: **o preço no card volta a 2,69:1** sobre branco. É o único
ponto do conteúdo que reprova na AA depois de tudo. Reverter só o preço para
`--primary-strong` é uma linha em `PriceTag.tsx`, se o dono mudar de ideia.

`font-black` **não** voltou nos dois CTAs de WhatsApp: são `<a>`, usam a fonte
de corpo, e a Plus Jakarta Sans é carregada até 700 — lá o 900 nunca desenhou.

### Horário de funcionamento — resolvido

Informado pelo dono em 29/08/2026 e agora em `apps/loja/src/lib/site.ts`
(`SITE_OPENING_HOURS`), como **lista de regras**, não frase corrida: o sábado
tem duas, e a diferença entre elas é justamente o que o cliente confere antes
de sair de casa.

| Dias | Horário |
| ---- | ------- |
| Segunda a sexta | 8h30 às 12h e 13h30 às 18h |
| 1º e 2º sábado do mês | 8h30 às 18h |
| Demais sábados | 8h30 às 13h |

Exibido no cartão do `VisitBanner` (home) e na coluna de informações da página
de contato. **Não** entrou no JSON-LD do `index.html`: o
`openingHoursSpecification` do schema.org não sabe dizer "primeiro e segundo
sábado do mês", e publicar sábado como 8h30–13h faria o Google anunciar loja
fechada num dia em que ela está aberta até as 18h. Se o horário de sábado
uniformizar, entra.

## 4. Resultado — contraste medido no DOM depois da execução

Números tirados do estilo computado das telas rodando, não do código. A régua
da WCAG AA é 4,5:1 para texto normal.

| Elemento | Antes | Depois |
| -------- | ----- | ------ |
| Nav do cabeçalho, item inativo | 2,20:1 ✗ | **11,68:1** ✓ |
| Nav do cabeçalho, item ativo | 2,69:1 ✗ | **17,87:1** ✓ |
| Wordmark "Uaus!" | 2,69:1 ✗ | **6,65:1** ✓ |
| `<h1>` dos mastheads | 2,69:1 ✗ | **6,65:1** ✓ |
| Subtítulo dos mastheads | 2,43:1 ✗ | **5,02:1** ✓ |
| **Preço no card e no detalhe** | 2,69:1 ✗ | 2,69:1 ✗ (tom vivo, a pedido) |
| CTA de WhatsApp (era `green-600`) | 3,22:1 ✗ | **4,95:1** ✓ |
| Copyright/CNPJ do rodapé | 3,81:1 ✗ | **6,99:1** ✓ |
| Faixa de endereço do cabeçalho | — (nova) | **9,10:1** ✓ |

Outras verificações do smoke test:

- Fontes: só os pesos usados são carregados (Archivo 600/700/800, Inter
  400–700). O `<h1>` sai em Archivo 800 de verdade; antes o `font-black` dos
  CTAs pedia 900 numa família carregada até 700.
- O pulso do CTA de reserva agora é `3 x 2.4s`, não `infinite`.
- O glifo do botão de reserva é o oficial do WhatsApp (`M17.472 14.3…`).

## 5. O que NÃO fazer

- **Não trocar o laranja da marca.** `#FF751A` é a identidade da loja e está na
  logo, na fachada e na sacola. O que muda é onde ele encosta em texto.
- **Não trazer biblioteca de UI nova.** `packages/ui` (shadcn) já está no
  workspace e cobre o que falta.
- **Não animar mais.** O site já tem framer-motion suficiente; a Fase 6 tira,
  não acrescenta.
- **Não mexer em `packages/api-client` pela Fase 4** — a vitrine da home usa o
  hook de catálogo que já existe.
