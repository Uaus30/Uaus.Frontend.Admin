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

## Deploy (Vercel)

Projeto próprio com **Root Directory = `apps/loja`** (mesmo modelo do PDV); o
`vercel.json` daqui define build, SPA fallback e o rewrite de `/api` — só
`uaus.com.br`/`www.uaus.com.br` falam com `api.uaus.com.br`; qualquer outro
host (previews, `loja-dev`) cai em `api-dev`. A ordem das regras é a segurança
(CLAUDE.md §10): não inverta. Host novo de produção também precisa entrar em
`packages/ui/src/lib/environment.ts`, senão a faixa de desenvolvimento aparece
em produção.
