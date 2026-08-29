# @workspace/loja — site público da Uaus

O site da loja (`uaus.com.br`): vitrine dos produtos marcados com "Exibir no
site" no admin, detalhe com reserva via WhatsApp, e as páginas institucionais
(home e contato) portadas do site anterior (repo `Front-Loja`, descomissionado).

## O que este app É — e o que ele não é

- **Vitrine anônima.** Não existe login, sessão nem chamada autenticada aqui.
  Todos os dados vêm dos endpoints públicos `/storefront/*` do backend
  (`StorefrontController`), e todos os hooks usam `{ auth: false }`. Não
  adicione chamadas a endpoints internos: além de 401, o redirect global do
  api-client mandaria o visitante para um `/login` que não existe.
- **Sem e-commerce.** Não há carrinho nem pagamento; a conversão é a RESERVA
  pelo WhatsApp (mensagem pré-preenchida, quem envia é o visitante). Ver
  `src/features/contact/README.md` e `src/features/catalog/README.md`.
- **Curadoria 100% no admin.** Flag do grupo (`ShowOnSite`), etiquetas públicas
  (`Tag.IsPublic` → selos do card), fotos (S3) e identidade da empresa
  (rodapé/contato) são todos cadastros do admin. Conteúdo hardcoded aqui é
  fallback ou texto institucional (`src/lib/site.ts`).

## Arquitetura

Estrutura de features do CLAUDE.md §4 (`hooks/` com testes, `components/`
puros, `types.ts`, `README.md` por feature): `home` (seções institucionais),
`catalog` (vitrine + detalhe, scroll infinito) e `contact`. As rotas — em
português, com redirect das antigas em inglês — nascem em `src/routes.ts`,
fonte única da navegação. Tema claro próprio em `src/index.css` (o único app
claro do monorepo; admin e PDV são escuros).

## Rodar

```bash
npm run dev:loja        # porta 5175; proxy /api -> https://localhost:44398
API_PROXY_TARGET=http://localhost:5214 npm run dev:loja   # backend local (perfil http)
API_PROXY_TARGET=https://api-dev.uaus.com.br npm run dev:loja  # sem backend local
```

Verificação: `npm run typecheck:loja`, `npm run test:loja`, `npm run build:loja`.

## Preview do link no WhatsApp (`api/` + `server/`)

A reserva termina numa mensagem de WhatsApp que carrega o link do produto — e o
cartão que o WhatsApp desenha vem das tags Open Graph do HTML. Como o site é
SPA, o HTML servido é sempre o `index.html` com as tags da LOJA, e **robô de
preview não executa JavaScript**: toda reserva aparecia com a logo da Uaus no
lugar da foto do produto.

Por isso estas duas pastas, que são o único código deste app que **não roda no
navegador**:

- `api/link-preview.ts` — função de borda da Vercel. Busca o produto pela
  própria origem (`/api/Storefront/...`), para herdar o `has: host` do
  `vercel.json` em vez de repetir a lista de hosts (CLAUDE.md §10), e devolve o
  `index.html` publicado com as tags trocadas.
- `server/link-preview.ts` — o que monta o cartão (título, preço, foto, escape)
  e o que injeta no `<head>`. É puro e testado; a função de borda é só a casca.

O `vercel.json` desvia para a função **apenas** os user-agents de preview
(`WhatsApp`, `facebookexternalhit`, Telegram, Slack…): o visitante comum
continua recebendo o `index.html` estático do CDN, sem passar por função
nenhuma. Googlebot fica **de fora** de propósito — ele executa JavaScript e
indexa a página real.

Três detalhes que valem a leitura antes de mexer:

- A resposta é o **site inteiro**, não uma casca com meta tags. É isso que torna
  a regra de user-agent não crítica: se um navegador embutido casar com ela por
  engano, a pessoa recebe o site funcionando, só com meta tags melhores. Com
  casca, receberia uma página morta — no exato fluxo que o site existe para
  atender.
- A resposta vai com `cache-control: no-store`. Ela depende do user-agent; se o
  CDN a guardasse sob a chave `/produtos/:id`, o próximo visitante receberia o
  HTML de um produto qualquer.
- Nada de `meta refresh` para a própria URL: o robô buscaria o mesmo endereço,
  cairia na função de novo e o preview nunca fecharia.

WhatsApp e Facebook **guardam o preview por URL**. Link já compartilhado antes
desta mudança pode continuar mostrando a logo por horas — teste com um produto
que ainda não circulou, ou force o re-scrape no
[Sharing Debugger](https://developers.facebook.com/tools/debug/) do Facebook.

## Deploy (Vercel)

Projeto próprio com **Root Directory = `apps/loja`** (mesmo modelo do PDV); o
`vercel.json` daqui define build, SPA fallback e o rewrite de `/api` — só
`uaus.com.br`/`www.uaus.com.br` falam com `api.uaus.com.br`; qualquer outro
host (previews, `loja-dev`) cai em `api-dev`. A ordem das regras é a segurança
(CLAUDE.md §10): não inverta. Host novo de produção também precisa entrar em
`packages/ui/src/lib/environment.ts`, senão a faixa de desenvolvimento aparece
em produção.
