# Plano de implementação — `apps/loja` (site público da Uaus)

> Escrito em 28/08/2026, a partir de levantamento completo dos três repositórios
> (`Uaus.Frontend.Admin`, `Front-Loja`, `Uaus.Backend.Api`). Este documento é o
> guia de execução: cada fase tem escopo, arquivos com conteúdo pronto, gates de
> verificação e os pontos onde os freios do CLAUDE.md disparam.

> **STATUS (28/08/2026, mesmo dia):** Fases 0 a 3 **executadas** — backend em
> `Uaus.Backend.Api@dev` (commit `15acdbd`), app em `apps/loja` nesta branch
> (commits `21190d1..1bdb71e`). Diferenças em relação ao planejado: scroll
> infinito com busca no servidor (pedido posterior do dono) no lugar do
> fetch-all com filtro no cliente; tela de detalhe `/produtos/:id` com reserva
> por WhatsApp; código em inglês/docs em pt-BR. Pendentes: Fase 4 (criação
> manual dos projetos na Vercel — instruções na seção 8 e no README do app),
> Fase 5 (descomissionar o Front-Loja), deploy da `dev` do backend no Railway
> da api-dev (conferir qual branch o serviço acompanha) e o horário de
> funcionamento (seção 11).

---

## 1. Resumo

Recriar o site da loja (`uaus.com.br`) como um **novo workspace `apps/loja`**
dentro deste monorepo, consumindo a **mesma API e banco** do Admin/PDV via
endpoints públicos novos, com produtos controlados pela flag **"Exibir no site"**
que o Admin já grava (`ProductGroup.ShowOnSite`). O design segue o Front-Loja
atual (laranja `#FF751A`, Outfit + Plus Jakarta Sans, cards arredondados,
framer-motion), com melhorias deliberadas listadas na Fase 3. Ao final, o
repositório `Front-Loja` e seu backend paralelo (Express + Postgres próprio no
Railway) são descomissionados.

Ordem das fases — cada uma termina verde antes da próxima:

| Fase | Onde | O quê |
| ---- | ---- | ----- |
| 0 | `Uaus.Backend.Api` | Endpoints públicos anônimos + script de schema do `show_on_site` |
| 1 | monorepo | Scaffold do `apps/loja` + fiação da raiz (CI, scripts, launch) |
| 2 | `packages/api-client` | DTOs e hooks do catálogo público |
| 3 | `apps/loja` | Port do design: layout, home, produtos, contato, SEO |
| 4 | Vercel | Projeto novo, domínios, cutover |
| 5 | `Front-Loja` | Descomissionamento + rotação de credenciais expostas |

---

## 2. O que o levantamento revelou (corrige o enunciado)

Estes cinco fatos mudam o plano em relação ao que se assumia:

1. **O Front-Loja não é estático.** É React 18 + Vite + wouter + React Query +
   Tailwind 3 + framer-motion, com um backend Express 5 + Drizzle + **Postgres
   próprio no Railway**, painel admin paralelo (`/admin`) e formulário de contato
   com Nodemailer. "Estático" no sentido de: não fala com o sistema Uaus. O
   trabalho é um **port de design + eliminação do backend paralelo**, não uma
   reescrita de HTML. A "página em manutenção" é só um boolean
   (`PRODUCTS_MAINTENANCE_MODE = true` em `client/src/pages/Products.tsx:16`);
   home e contato continuam no ar.
2. **A flag de site fica no `ProductGroup`, não no `Product`.** Backend:
   `ProductGroup.ShowOnSite` (coluna `show_on_site`), default `false`. O card da
   vitrine é o **grupo**; `Product` é a variação vendável. O Admin já grava a
   flag de ponta a ponta (`form.isPublic` → `showOnSite` em
   `apps/admin/src/features/products/hooks/editor/useProductSubmit.ts`). Tags
   têm flag própria (`Tag.IsPublic`, rótulo "Exibir no site" no Admin) — é o
   substituto natural do selo "Super Oferta" do site antigo.
3. **Não existe endpoint público de dados.** A API nega por padrão (fallback
   `AuthorizeFilter` em `Uaus.Api/Extensions/BearerTokenExtensions.cs`); os
   únicos `[AllowAnonymous]` são enums, health e login. Sem a Fase 0, o site
   não tem o que exibir.
4. **A coluna `show_on_site` não está no schema versionado.** Existe nos bancos
   vivos (criada pelo importador legado), mas nenhum script em
   `Uaus.Data/Scripts/` a cria. Um provisionamento do zero quebraria o site.
   A Fase 0 corrige isso.
5. **Imagens de produto são URLs do S3** (`Image.Url` + `?v={version}`),
   estáveis e públicas — o site pode usá-las direto. A busca no Bing é só
   ferramenta de autoria do Admin; o que persiste é o upload no S3.

Achado bônus: existe **logo em alta resolução** (906×906, fundo transparente)
em `C:\Projects\Uaus\Front-Loja\attached_assets\icone_sem_fundo_1772322579980.png`
— até então só se conhecia o 126×132. Usar para favicon/OG do site (e,
oportunamente, para regenerar os ícones do PWA do PDV).

---

## 3. Decisões de arquitetura

| Decisão | Escolha | Alternativa rejeitada e porquê |
| ------- | ------- | ------------------------------ |
| Stack | Vite + React 19 SPA, igual admin/pdv (wouter, React Query, Tailwind v4) | Next.js/SSR: quebraria a homogeneidade do monorepo (build, lint, testes, deploy) por um ganho de SEO que uma vitrine de cidade pequena não paga. Pré-render fica no backlog se SEO virar prioridade. |
| Projeto Vercel | **Projeto próprio com Root Directory = `apps/loja`** e `vercel.json` no diretório do app (modelo do PDV) | Alterar o `vercel.json` da raiz (modelo do Admin): a raiz continua sendo o projeto do Admin; misturar os dois criaria conflito permanente. |
| Acesso a dados | Endpoints públicos novos (`/storefront/*`) com `[AllowAnonymous]` por action + DTO próprio sem campos internos | Reutilizar `/products/table` com um token embutido no front: expõe `costPrice`/`minStock` e um token de Admin no bundle público. Inaceitável. |
| Chamadas do front | **Toda chamada da loja usa `{ auth: false }`** no api-client | Padrão implícito: um 401 no `client.ts` redireciona para `/login`, rota que a loja não tem — visitante cairia num 404. `auth: false` pula o header e o redirect. |
| Qual API o site chama | `has: host` no `vercel.json` do app, idêntico ao padrão admin/pdv: **só produção cai em `api.uaus.com.br`**; previews/dev caem em `api-dev` | Arquivo por branch: já foi rejeitado no repo (CLAUDE.md §10) — o padrão seguro é dev. |
| Formulário de contato | v1 sem backend: o formulário monta a mensagem e abre o **WhatsApp** com texto pré-preenchido (`wa.me/...?text=`) | Endpoint de contato + mailer no backend: a API não tem mailer, criaria tabela + tela no Admin — custo alto para um canal que já converge no WhatsApp. Fica no backlog. |
| Tema | Tokens claros próprios no `apps/loja/src/index.css` (paleta do Front-Loja) | Compartilhar tema via `packages/ui`: o pacote não embarca CSS por decisão existente; admin e pdv já duplicam tokens — a loja segue o padrão vigente. |
| Catálogo no cliente | Buscar **todas as páginas** do endpoint público (paginado, `size=200`) e filtrar busca no cliente com `normalizeSearchText` do `packages/core` | Busca server-side por tecla digitada: catálogo de loja "máximo R$ 30" é pequeno (centenas de grupos); a busca instantânea e sem acento do site antigo é melhor UX e menos carga na API. |
| Rotas | `/`, `/produtos`, `/contato` (PT) com redirect de `/products` e `/contact` | Manter slugs em inglês do site antigo: público é brasileiro; redirects preservam links antigos. |

---

## 4. Fase 0 — Backend público (`Uaus.Backend.Api`)

> ⚠️ Repositório vizinho: **executar só com autorização explícita na conversa**
> (regra registrada). O item 4.1 é **freio 2** do CLAUDE.md (script de schema):
> parar e mostrar antes de commitar.

### 4.1 Script de schema — versionar o `show_on_site`

Novo arquivo em `Uaus.Data/Scripts/` (seguir a numeração/nomenclatura dos
existentes e o padrão idempotente do `SqlScriptRunner`):

```sql
-- Versiona a coluna que o importador legado criou fora do fluxo de scripts.
-- Sem isto, um banco provisionado do zero quebra o site público.
ALTER TABLE product_groups
  ADD COLUMN IF NOT EXISTS show_on_site boolean NOT NULL DEFAULT false;
```

### 4.2 `StorefrontController` — leitura anônima

Novo controller `Uaus.Api/Controllers/StorefrontController.cs`, rota
`[Route("[controller]")]` (vira `/storefront` com o `LowercaseUrls`).
`[AllowAnonymous]` **em cada action, nunca na classe** — é o idioma documentado
no próprio repo (comentário em `CouponsController.cs:14-17`).

Endpoints:

```
GET /storefront/products?search=&page=1&size=50   → PagedResult<StorefrontProductDto>
GET /storefront/company                           → StorefrontCompanyDto
```

Regras do `/storefront/products` (implementar em `ProductService` ou serviço
novo, copiando o fan-out em lotes de `ProductService.Table.cs` — grupos →
produtos → tags → imagens em 4 queries, não N+1):

- Filtro: `ProductGroup.ShowOnSite && !ProductGroup.IsDeleted` **e** o grupo tem
  ao menos um `Product` com `Status == ProductStatus.Active && !IsDeleted`.
- `search` opcional sobre nome/descrição do grupo (mesmo unaccent dos demais).
- Ordenação estável (nome asc) — o front pagina em sequência.

DTO — **nunca** expor `CostPrice`, `MinStock`, `Stock`, auditoria:

```csharp
public record StorefrontProductDto(
    long ProductGroupId,
    string Name,
    string? Description,
    decimal Price,                    // menor preço entre os produtos ativos do grupo
    decimal? PriceMax,                // maior preço; null quando igual ao Price
    bool HasVariations,
    string CategoryName,
    IReadOnlyList<StorefrontProductImageDto> Images,   // url + displayOrder, ordenadas
    IReadOnlyList<StorefrontTagDto> Tags);             // só Tag.IsPublic: name + color

public record StorefrontCompanyDto(
    string StoreName, string AddressLine, string CityState, string Phone);
```

`StorefrontCompanyDto` é projeção do singleton `CompanySettings` (Id=1) — dá ao
rodapé um dado só, mantido no Admin.

### 4.3 Notas (não bloqueiam a fase)

- O Swagger é público em produção e não há rate limiting; abrir a API para
  tráfego anônimo aumenta a superfície. Se preocupar: `OutputCache` curto
  (60 s) nos dois endpoints é barato e resolve pico de tráfego.
- Enums continuam serializando como **nome** e nulls são omitidos do JSON —
  os DTOs do front usam `campo?: T | null` e comparação `== null`.

### Gate da Fase 0

`curl` anônimo nos dois endpoints em `api-dev.uaus.com.br` retornando 200 com
envelope `{ items, pagination: { page, size, filteredItems } }`; endpoint
autenticado qualquer continuando 401 sem token. Testes/build do backend verdes.

---

## 5. Fase 1 — Scaffold do `apps/loja` + fiação da raiz

> ⚠️ O `apps/loja/vercel.json` é **freio 3** (config de deploy): mostrar antes
> de commitar. O restante da fase é estrutura comum.

### 5.1 Arquivos novos do workspace

#### `apps/loja/package.json`

Versões copiadas do `apps/admin/package.json` de hoje — manter alinhadas para o
hoist do npm não duplicar React:

```json
{
  "name": "@workspace/loja",
  "version": "1.0.158",
  "private": true,
  "type": "module",
  "engines": { "node": "24.x", "npm": ">=10" },
  "scripts": {
    "dev": "vite --config vite.config.ts --host 0.0.0.0",
    "build": "vite build --config vite.config.ts",
    "serve": "vite preview --config vite.config.ts --host 0.0.0.0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.100.8",
    "@workspace/api-client-react": "file:../../packages/api-client",
    "@workspace/core": "file:../../packages/core",
    "@workspace/ui": "file:../../packages/ui",
    "clsx": "^2.1.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.14.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "tailwind-merge": "^3.5.0",
    "wouter": "^3.9.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.4",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.5",
    "jsdom": "^29.1.1",
    "tailwindcss": "^4.2.4",
    "vite": "^8.2.1",
    "vitest": "^4.1.9"
  }
}
```

Sem `@workspace/receipt` (a loja não imprime cupom) e sem os pacotes Radix — os
componentes do `@workspace/ui` resolvem as dependências deles via hoist, como já
acontece no PDV.

#### `apps/loja/vite.config.ts`

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getBuildInfo } from "../../scripts/build-version";
import { createCoverageOptions } from "../../vitest.shared.mts";

const buildInfo = getBuildInfo();

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(buildInfo.version),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildInfo.buildTime),
    "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(buildInfo.commitHash),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  build: {
    // outDir padrão ("dist") — o vercel.json do app aponta para ele, como no PDV.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules") || id.includes("@workspace")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("framer-motion") || id.includes("motion-")) return "vendor-motion";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5175),
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "https://localhost:44398",
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p.replace(/^\/api/, ""),
      },
    },
    fs: { strict: true, deny: ["**/.*"] },
  },
  preview: { port: Number(process.env.PORT ?? 4175) },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: createCoverageOptions("loja", ["src/main.tsx"]),
  },
});
```

Para desenvolver sem backend local: `API_PROXY_TARGET=https://api-dev.uaus.com.br npm run dev:loja`.

#### `apps/loja/tsconfig.json`

Variante de arquivo único do Admin (não a de 3 arquivos do PDV):

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "references": [{ "path": "../../packages/api-client" }]
}
```

#### `apps/loja/index.html`

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Uaus! Máximo 30 — Tudo por até R$ 30 em Tapira-PR</title>
    <meta
      name="description"
      content="Loja em Tapira-PR com tudo por no máximo R$ 30: presentes, utilidades, brinquedos, ferramentas e muito mais. Rua Paranaguá, 663 — Centro."
    />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Uaus! Máximo 30" />
    <meta property="og:description" content="Tudo por no máximo R$ 30,00 em Tapira-PR." />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:locale" content="pt_BR" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Melhorias deliberadas sobre o site antigo: `lang="pt-BR"` (era `en`), sem
`maximum-scale=1` (bloqueava zoom — acessibilidade), só as **2** famílias de
fonte usadas (o antigo carregava ~28 do boilerplate Replit), meta description e
OG que não existiam. Ícones gerados do logo 906×906 em `apps/loja/public/`.

#### `apps/loja/vercel.json` ⚠️ freio 3

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "has": [{ "type": "host", "value": "(www\\.)?uaus\\.com\\.br" }],
      "destination": "https://api.uaus.com.br/$1"
    },
    {
      "source": "/api/(.*)",
      "destination": "https://api-dev.uaus.com.br/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Mesma lógica dos irmãos: **só** `uaus.com.br`/`www.uaus.com.br` falam com a API
de produção; previews e `loja-dev` caem em `api-dev`. A ordem das regras é a
segurança — não inverter (CLAUDE.md §10).

#### `apps/loja/src/index.css`

Cabeçalho e tokens (paleta clara extraída do Front-Loja; estrutura idêntica ao
`apps/admin/src/index.css` para os componentes do `@workspace/ui` funcionarem):

```css
@import "tailwindcss";

/*
 * O @workspace/ui entra por symlink em node_modules e o autodetect do Tailwind
 * v4 ignora node_modules. Sem esta linha, classes que só existem dentro do
 * pacote não são geradas. (Mesma nota do admin/pdv.)
 */
@source "../../../packages/ui/src";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* copiar o bloco inteiro de mapeamento --color-*/--radius-* do
     apps/admin/src/index.css (linhas 17-77) — é idêntico nos três apps */
  --font-sans: var(--app-font-sans);
  --font-display: var(--app-font-display);
  --font-body: var(--app-font-sans);
}

/* TEMA CLARO — paleta do site original (Front-Loja client/src/index.css) */
:root {
  --app-font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --app-font-display: "Outfit", var(--app-font-sans);

  --background: 0 0% 100%;
  --foreground: 222 47% 11%; /* #0F1729 — também é o fundo do rodapé */
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 24 100% 55%;

  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --card-border: 214 32% 91%;

  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --popover-border: 214 32% 91%;

  --primary: 24 100% 55%; /* #FF751A — o laranja da marca */
  --primary-foreground: 0 0% 100%;

  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;

  --accent: 24 100% 95%;
  --accent-foreground: 24 100% 45%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;

  --radius: 1rem;

  /* Tokens que o @source do ui referencia mas a loja não usa na prática:
     preencher com os equivalentes claros para não gerar var() indefinida
     (chart-1..5, sidebar-*, elevate, button-outline — copiar do admin e
     clarear os valores). */
}

body {
  @apply bg-background text-foreground antialiased;
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  letter-spacing: -0.025em;
}
```

Nota de fidelidade: no site antigo as classes `font-display`/`font-body` eram
usadas ~30 vezes **mas nunca foram definidas** (bug conhecido, documentado em
`client/requirements.md`) — só `<h1>–<h6>` renderizavam em Outfit. Aqui elas
passam a existir de verdade, então o wordmark "Uaus!" do header e os preços
**mudam visivelmente** para Outfit. É correção intencional, não regressão.

#### Esqueleto de `src/`

```
apps/loja/src/
  main.tsx                     createRoot + index.css + handlers globais de erro
                               (reloadOnChunkLoadError — ver 5.3)
  App.tsx                      QueryClientProvider + DevEnvironmentBanner +
                               WouterRouter + ScrollToTop + Suspense/Switch
  routes.ts                    fonte única de rotas e navegação
  components/layout/
    SiteLayout.tsx             header + <main> + footer
    SiteHeader.tsx             logo, wordmark, nav derivada de routes.ts, menu mobile
    SiteFooter.tsx             marca, contato, navegação, mapa, CNPJ
  pages/
    home.tsx  produtos.tsx  contato.tsx  nao-encontrada.tsx
  features/
    catalogo/                  (estrutura CLAUDE.md §4, modelo fixed-costs)
      hooks/useCatalogo.ts     query pública + busca client-side + estado do lightbox
      hooks/__tests__/useCatalogo.test.tsx
      components/ProductCard.tsx ProductGrid.tsx ProductLightbox.tsx CatalogSearch.tsx
      types.ts  README.md
    contato/
      hooks/useContatoWhatsApp.ts        monta a URL wa.me com a mensagem
      hooks/__tests__/useContatoWhatsApp.test.ts
      components/ContactForm.tsx ContactInfo.tsx
      types.ts  README.md
  lib/
    site.ts                    constantes: WhatsApp, Instagram, endereço, CNPJ
  assets/                      7 fotos da loja copiadas do Front-Loja/attached_assets
```

`routes.ts` — mesmo conceito do Admin (rota e menu não divergem), sem papéis:

```ts
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface SiteRoute {
  path: string;
  label?: string; // presente = aparece na navegação
  component: LazyExoticComponent<ComponentType<Record<string, never>>>;
}

export const ROUTES: SiteRoute[] = [
  { path: "/", label: "Início", component: lazy(() => import("@/pages/home")) },
  { path: "/produtos", label: "Produtos", component: lazy(() => import("@/pages/produtos")) },
  { path: "/contato", label: "Contato", component: lazy(() => import("@/pages/contato")) },
];

/** Slugs do site antigo continuam funcionando. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/products": "/produtos",
  "/contact": "/contato",
};

export const NOT_FOUND_COMPONENT = lazy(() => import("@/pages/nao-encontrada"));
export const NAV_LINKS = ROUTES.filter((r) => r.label);
```

`App.tsx` — pontos que diferem do Admin: sem `AuthGate`/`RequireRole` (tudo
público), sem `OfflineBanner`, QueryClient com cadência de catálogo:

```ts
const queryClient = createQueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME.catalogo, retry: 2, refetchOnWindowFocus: false },
  },
});
```

Mais um componente global `ScrollToTop` (wouter não restaura scroll — no site
antigo só a página de produtos resetava; aqui vale para todas).

### 5.2 Fiação da raiz (espelhar o que o PDV precisou)

1. **`package.json` (raiz)** — em `workspaces`, acrescentar `"apps/loja"`; em
   `scripts`:

   ```json
   "dev:loja": "npm run dev --workspace=@workspace/loja",
   "build:loja": "npm run build --workspace=@workspace/loja",
   "typecheck:loja": "npm run build:types && npm run typecheck --workspace=@workspace/loja",
   "test:loja": "npm run build:types && npm run test --workspace=@workspace/loja",
   ```

   Acrescentar `test:loja` à cadeia do `"test"` e
   `&& vitest run --root apps/loja --coverage` ao `"coverage"`.

2. **`vitest.shared.mts`** — a união é fechada de propósito; sem isto o
   typecheck reprova:

   ```ts
   export type CoverageWorkspace = "core" | "api-client" | "ui" | "receipt" | "admin" | "pdv" | "loja";
   ```

   E em `COVERAGE_FLOOR`, seguindo a filosofia documentada no arquivo (piso é
   **medido**, nunca meta — um piso que nasce vermelho é desligado na primeira
   sexta-feira):

   ```ts
   // workspace novo: piso zera no scaffold e é travado no valor medido ao fim da Fase 3
   loja: { statements: 0, branches: 0, functions: 0, lines: 0 },
   ```

   **Ao fim da Fase 3 é obrigatório** rodar `vitest run --coverage` na loja,
   ler o `coverage/loja/coverage-summary.json` e subir o piso para o medido
   (arredondado para baixo), com o comentário `// medido X/Y/Z/W`.

3. **`scripts/sync-version.js`** — em `pkgFiles`, acrescentar
   `path.resolve(workspaceRoot, "apps/loja/package.json"),`.

4. **`.github/workflows/ci.yml`** — no job `typecheck`, novo passo
   `npm run typecheck:loja`; no job `build`, `matrix.app: [admin, pdv, loja]`.

5. **`.claude/launch.json`** — nova entrada:

   ```json
   { "name": "loja", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev:loja"], "port": 5175 }
   ```

6. **`packages/ui/src/lib/environment.ts`** — sem isto a faixa ciano de dev
   **vai para produção** do site:

   ```ts
   const PRODUCTION_HOSTS = ["admin.uaus.com.br", "pdv.uaus.com.br", "uaus.com.br", "www.uaus.com.br"];
   ```

   Atualizar o teste `dev-environment-banner.test.tsx`/`environment` conforme.

7. **Docs** — `README.md` da raiz, `CLAUDE.md` §2 (linha na tabela de
   workspaces: "apps/loja — Site público da loja. Só leitura anônima; nada de
   auth.") e §10 (nota do terceiro projeto Vercel), `AGENTS.md`.

### 5.3 Refactor pequeno: `chunk-reload` compartilhado

O Admin ganhou auto-recuperação de chunk desatualizado pós-deploy
(`apps/admin/src/lib/chunk-reload.ts`, commit `ca51bba`). Um site público sofre
disso mais que o Admin (visitantes com aba velha). Mover o utilitário para
`packages/ui/src/lib/chunk-reload.ts` (mesmo lar do `environment.ts` — é infra
de app, não regra de negócio, então não vai para o `core`), exportar no barrel
do `ui`, atualizar o import do Admin e usar na loja (`main.tsx`). O
`clientLogger` do Admin **não** vai junto: ele posta em `/logs` autenticado; a
loja fica só com `console.error` na v1.

### Gate da Fase 1

`npm install` → `npm run build:types` → `npm run typecheck:loja` →
`npm run lint` → `npm test` → `npm run build:loja`, tudo verde;
`npm run dev:loja` sobe na 5175 com o esqueleto navegável (header/footer +
páginas placeholder) e console limpo. Como há mexida em `vitest.shared.mts` e
`ci.yml`, rodar também `typecheck:admin` e `typecheck:pdv`.

---

## 6. Fase 2 — Camada de dados (`packages/api-client`)

Seguir o passo a passo do `packages/api-client/README.md` (DTO em `models.ts`,
arquivo de domínio em `hooks/`, chave de cache com factory de prefixo puro,
funções de acesso, `build:types` no final).

### 6.1 DTOs em `src/models.ts`

```ts
/** Item do catálogo público. Espelho de StorefrontProductDto do backend. */
export interface StorefrontProductDto {
  productGroupId: number;
  name: string;
  description?: string | null;
  price: number;
  priceMax?: number | null; // presente só quando o grupo tem variações com preços distintos
  hasVariations: boolean;
  categoryName: string;
  images: StorefrontProductImageDto[];
  tags: StorefrontTagDto[];
}

export interface StorefrontProductImageDto {
  url: string;
  displayOrder: number;
}

export interface StorefrontTagDto {
  name: string;
  color: string;
}

export interface StorefrontCompanyDto {
  storeName: string;
  addressLine: string;
  cityState: string;
  phone: string;
}
```

(Lembrete do repo: nulls chegam como `undefined` — por isso `?: T | null`.)

### 6.2 `src/hooks/storefront.ts`

```ts
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { apiGetOrThrow, fetchAllPages } from "../client";
import type { StorefrontCompanyDto, StorefrontProductDto } from "../models";

/** Prefixo puro, aridade zero — o teste query-keys.test.ts fiscaliza. */
export const getGetStorefrontProductsQueryKey = (): QueryKey => ["storefront-products"];
export const getGetStorefrontCompanyQueryKey = (): QueryKey => ["storefront-company"];

/**
 * Catálogo completo do site. Todas as chamadas da loja são anônimas
 * ({ auth: false }): sem header Authorization e, crucialmente, sem o
 * redirect para /login que o client.ts dispara em 401 — rota que o site
 * público não tem.
 */
export function getAllStorefrontProducts(): Promise<StorefrontProductDto[]> {
  return fetchAllPages<StorefrontProductDto>("/storefront/products", undefined, 200, {
    auth: false,
  });
}

export function getStorefrontCompany(): Promise<StorefrontCompanyDto> {
  return apiGetOrThrow<StorefrontCompanyDto>("/storefront/company", { auth: false });
}

export function useGetStorefrontProducts() {
  return useQuery({
    queryKey: [...getGetStorefrontProductsQueryKey()],
    queryFn: getAllStorefrontProducts,
  });
}

export function useGetStorefrontCompany() {
  return useQuery({
    queryKey: [...getGetStorefrontCompanyQueryKey()],
    queryFn: getStorefrontCompany,
  });
}
```

Exportar no barrel `src/hooks/index.ts`.

### 6.3 Ajuste no `client.ts`: `fetchAllPages` anônimo

Hoje `fetchAllPages(path, params?, size?, { maxItems }?)` não repassa opções de
auth. Acrescentar `auth?: boolean` ao objeto de opções e encaminhar para as
chamadas `apiGet` internas. Mudança pequena, coberta em `client.test.ts` (caso
novo: com `auth: false` nenhuma requisição leva `Authorization`).

Conferir a assinatura de `apiGetOrThrow` — se hoje não aceita `{ auth }`,
aplicar o mesmo repasse.

### 6.4 Testes

- `src/hooks/storefront.test.ts`: hook devolve dados mapeados; chamadas saem
  com `auth: false`; chave de cache bate com a factory (o
  `query-keys.test.ts` já cobre aridade e unicidade do prefixo novo
  automaticamente).
- Rodar `npm run build:types` antes do typecheck dos apps (regra do repo).

### Gate da Fase 2

`npm run test:api-client`, `build:types`, `typecheck:loja` verdes. Smoke: com o
dev server da loja proxyando para `api-dev`, o hook lista produtos reais no
console/tela provisória.

---

## 7. Fase 3 — Port do design

Referência visual: o Front-Loja como está (`C:\Projects\Uaus\Front-Loja`).
Fidelidade ao design com as melhorias marcadas 🔧. Textos em português copiados
**verbatim** do original (guardam a voz da marca), exceto onde indicado.

### 7.1 Layout (header + rodapé)

- Header sticky laranja (`bg-primary`), 96 px, logo 80×80 com glow no hover,
  wordmark em duas linhas ("Uaus!" `text-4xl font-black` / "MÁXIMO 30"
  `tracking-[0.2em]`), nav uppercase derivada de `NAV_LINKS`, menu mobile com
  animação de altura (framer-motion). 🔧 wordmark agora de fato em Outfit.
- Rodapé `bg-foreground` (#0F1729) em 4 colunas: marca + tagline ("Tudo o que
  você precisa por no máximo R$ 30,00…"), contato (WhatsApp (44) 99136-5567,
  e-mail uaus30@gmail.com, Rua Paranaguá 663 — dados via
  `useGetStorefrontCompany` com fallback nas constantes de `lib/site.ts`),
  navegação, mapa embed do Google. Barra final com © e CNPJ 64.958.682/0001-22.
  Instagram: `instagram.com/uaus_maximo30`.

### 7.2 Home

1. **Hero** — pill "Nova loja em Tapira-PR", H1 "Chegou em Tapira… Uma loja com
   tudo por no máximo 30 reais!" com gradiente `from-primary to-orange-400`,
   parágrafo original, CTAs "Ver Super Ofertas" → `/produtos` e "Fale Conosco".
2. **Faixa escura** — 🔧 o countdown da inauguração (07/03/2026) já expirou e o
   card dizia "A inauguração foi um sucesso!". Substituir por conteúdo perene
   mantendo o visual (card gradiente laranja sobre fundo escuro): **"Visite a
   loja"** com os dois blocos de info (endereço/"Pertinho do Correios" +
   horário de funcionamento se fornecido). 🔧 Remover a textura hotlinkada do
   pixabay — usar uma das fotos locais da loja com opacidade baixa.
3. **Carrossel** — as 7 fotos reais (1280×960) copiadas para
   `src/assets/`, autoplay 5 s, cross-fade framer-motion, setas no hover, dots
   com pílula ativa. 🔧 adicionar swipe no touch e pausa no hover.
4. **Grade de destaques** — 3 cards (Presentes / MÁXIMO 30 REAIS em destaque
   laranja / Diversidade), textos originais.

### 7.3 Produtos (`/produtos`)

Masthead laranja "Promoções e Novidades" (🔧 com acento — o original perdeu a
acentuação) + "Todas as imagens são meramente ilustrativas."

- **Dados**: `useCatalogo` consome `useGetStorefrontProducts`; busca instantânea
  client-side usando `normalizeSearchText` do `@workspace/core` (o site antigo
  reimplementava — não duplicar, armadilha clássica do repo).
- **Card**: imagem `aspect-square` (primeira `images[]` por `displayOrder`;
  fallback `ImageOff`), nome, "Por apenas" + `formatCurrency(price)` do core;
  com variações de preços distintos: "A partir de R$ X". Ribbons: uma badge por
  tag pública do grupo, com `tag.color` — o Admin passa a controlar o selo
  "Super Oferta" criando/atribuindo a tag pública correspondente.
- **Lightbox** ao clicar. 🔧 fechar com Esc, travar scroll do body, foco
  gerenciado.
- Estados de carregando/erro/vazio com os textos originais.
- 🔧 chips de categoria (dados já vêm em `categoryName`) — filtro simples no
  cliente; incluir só se não atrasar a fase, senão backlog.

### 7.4 Contato (`/contato`)

Masthead "Fale Conosco" + duas colunas. 🔧 Formulário sem backend: os campos
(nome, telefone, mensagem) alimentam `useContatoWhatsApp`, que monta
`https://wa.me/5544991365567?text=<mensagem codificada>` e abre em nova aba —
validação com mensagens em português. Coluna direita: informações + botão verde
"CHAMAR NO WHATSAPP" com o `pulse-glow` (portar o keyframe). E-mail vira
`mailto:`. (O formulário antigo postava num Express com senha de app do Gmail
hardcoded — ver Fase 5.)

### 7.5 404 e SEO

- `nao-encontrada.tsx` em português dentro do layout (o original era o
  boilerplate shadcn em inglês).
- `public/robots.txt` (allow all + sitemap), `public/sitemap.xml` com as 3
  rotas, JSON-LD `LocalBusiness` (nome, endereço, telefone, geo de Tapira-PR)
  no `index.html` ou injetado na home.
- Título por página via hook simples `usePageTitle` (padrão `document.title`
  que o Admin já usa; sem dependência nova).

### 7.6 Testes obrigatórios da fase

- `useCatalogo`: filtra sem acento, mapeia imagem principal, estados de
  erro/vazio (mock do api-client com `vi.mock` + `importOriginal`, **sem
  redefinir chave de cache no mock** — cerimônia do CLAUDE.md §4).
- `useContatoWhatsApp`: telefone/urlencode corretos (função pura).
- Ao final: medir cobertura e **subir o piso da loja** no `vitest.shared.mts`
  para o valor medido (ver Fase 1, item 2).

### Gate da Fase 3

Sequência completa do CLAUDE.md §8 (`build:types`, `typecheck:loja`, `test`,
`lint`, `build:loja`) + smoke no preview local: as 3 páginas renderizam,
busca filtra, lightbox abre/fecha, WhatsApp abre com texto, console sem
exceção, requisições ao `/api/storefront/*` em 200.

---

## 8. Fase 4 — Vercel e cutover

Passos no painel da Vercel (manuais, do dono da conta):

1. Criar projeto novo (ex.: `uaus-loja`) apontando para este repositório,
   **Root Directory = `apps/loja`** (mesmo modelo do projeto do PDV).
   Production Branch = `main`. Build/output vêm do `vercel.json` do app.
2. Deploy de preview primeiro (branch `dev`): conferir que o preview fala com
   `api-dev` (regra default do rewrite), que a faixa de dev aparece no preview
   e que o catálogo carrega.
3. Domínios: mover `uaus.com.br` e `www.uaus.com.br` do projeto antigo
   (Front-Loja) para o novo — apex como primário, `www` redirecionando
   (comportamento padrão da Vercel). Opcional: `loja-dev.uaus.com.br` na branch
   `dev`, como nos outros apps.
4. Smoke de produção imediatamente após o cutover: home, `/produtos` com dados
   reais (via `api.uaus.com.br`), `/contato`, **sem** faixa de dev (se ela
   aparecer, faltou o host em `PRODUCTION_HOSTS` — Fase 1 item 6).

Observação: o merge `dev → main` que publica a loja é deploy de produção —
gate de regressão do CLAUDE.md §8 se aplica por inteiro.

---

## 9. Fase 5 — Descomissionar o Front-Loja

Só depois do cutover verificado:

1. **Rotacionar credenciais expostas** — o repo antigo (GitHub `Uaus30/Front-Loja`)
   tem no histórico: `.env` com `DATABASE_URL` real do Railway, **senha de app
   do Gmail hardcoded** em `server/routes.ts` (`uaus30@gmail.com`) e usuário
   admin `admin@uaus.com.br` com senha conhecida seedada. Revogar a senha de
   app do Google, trocar a senha do Postgres antigo (ou apagar o banco, que
   deixa de ter função) e considerar arquivar o repositório.
2. Apagar/pausar o projeto Vercel antigo e o Postgres paralelo do Railway
   (confirmar antes que nada mais o usa — ele era exclusivo do site).
3. Guardar `attached_assets/` (fotos + logo 906×906) — já copiados para o
   monorepo na Fase 3, mas manter o original.
4. Registrar no README da loja que o site antigo morava em `Front-Loja` e onde
   os assets vivem agora.

---

## 10. Backlog (fora do escopo desta entrega)

- Filtro por categoria/departamento na vitrine (chips) se não entrar na Fase 3.
- Filtro "só exibidos no site" na tabela de produtos do Admin (exige parâmetro
  novo no `/products/table`).
- Endpoint de contato persistido + tela de mensagens no Admin (substituir o
  WhatsApp-only, se sentirem falta).
- Pré-render/SSG das rotas para SEO forte (vite-react-ssg ou similar).
- Analytics (Vercel Analytics é o caminho de menor atrito).
- Tela "Configurações do site" no Admin (hero, fotos do carrossel, horário) —
  hoje esses conteúdos são estáticos no código da loja.
- Vitrine de cupons/campanhas públicas (`Tag.IsPublic` e `Coupon` já existem).
- Cache/output-cache nos endpoints públicos e rate limiting na API.

---

## 11. Riscos e pontos de decisão em aberto

| Ponto | Recomendação (assumida no plano) |
| ----- | -------------------------------- |
| Conteúdo da faixa escura da home (ex-inauguração) | "Visite a loja" com endereço + horário; **precisa do horário de funcionamento real** (não existe em lugar nenhum do sistema) |
| Formulário de contato sem e-mail | WhatsApp pré-preenchido cobre o caso real; reverter via backlog se fizer falta |
| Marca: fachada física é **vermelha**, site é laranja | Manter o laranja do site (consistência digital); alinhar com o dono quando renovar a fachada |
| Volume do catálogo | `fetchAllPages` aguenta 20k itens; catálogo real é ordens de grandeza menor. Se crescer, paginar a vitrine |
| SEO de SPA | Aceitável para v1 (Google renderiza JS; site pequeno); pré-render no backlog |
| Grupos `ShowOnSite` hoje no banco | A flag nasce `false` e o Admin default é `true` ao salvar — conferir quantos grupos estão marcados antes do cutover para o site não estrear vazio |

---

## 12. Sequência de commits sugerida

Na `dev` (fluxo atual do repo), um tema por commit, mensagens sem acento:

1. `feat(backend): endpoints publicos do storefront e script do show_on_site` — repo vizinho, Fase 0 (freio 2 no script SQL: mostrar antes).
2. `feat(loja): scaffold do workspace apps/loja` — Fase 1 sem o vercel.json.
3. `feat(loja): vercel.json do projeto proprio` — freio 3: mostrar antes.
4. `feat(api-client): hooks anonimos do catalogo publico` — Fase 2.
5. `feat(loja): layout e home` / `feat(loja): vitrine de produtos` /
   `feat(loja): contato, 404 e seo` — Fase 3 em fatias.
6. `chore(loja): piso de cobertura medido` — fecha a Fase 3.
7. Merge `dev → main` quando a Fase 4 estiver liberada (gate de regressão §8).

Cada commit: só os arquivos tocados nominalmente (**nunca `git add -A`** —
working tree compartilhado).
