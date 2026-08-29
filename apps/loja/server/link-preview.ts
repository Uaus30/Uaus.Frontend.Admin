/**
 * Preview de link do produto — o cartão que WhatsApp, Facebook e Telegram
 * montam quando alguém compartilha `/produtos/:id`.
 *
 * ## Por que existe código de servidor num site que é SPA
 *
 * O site é Vite puro: o HTML entregue é sempre o mesmo `index.html`, com as
 * tags Open Graph da LOJA. Quem lê meta tag é robô, e robô de preview **não
 * executa JavaScript** — mexer em `document.head` no cliente não muda nada para
 * ele. Por isso toda reserva compartilhada no WhatsApp mostrava a logo da loja
 * em vez da foto do produto que o cliente quis reservar.
 *
 * A correção só pode acontecer no servidor: responder o HTML já com as tags
 * certas. O `vercel.json` desvia **só** os user-agents de preview para
 * `api/link-preview.ts`; o visitante de verdade continua recebendo o
 * `index.html` estático do CDN, idêntico ao de hoje.
 *
 * ## Por que este arquivo não importa NADA do monorepo — nem tipo
 *
 * A função é compilada pela Vercel, fora do toolchain daqui: o alias `@/` não
 * existe lá, os packages `@workspace/*` publicam TypeScript cru numa condição
 * de exportação (`workspace`) que só o Vite conhece, e o `tsconfig` que a
 * Vercel enxerga é o de `api/`, deliberadamente sem essas opções. Foi
 * exatamente esse acoplamento que reprovou o primeiro build (65d3010).
 *
 * Daí o formatador de moeda repetido em cinco linhas e a forma do produto
 * redeclarada abaixo. O contrato continua sendo o `StorefrontProductDetailDto`
 * do api-client (CLAUDE.md §3); quem garante que os dois não divergiram é o
 * `parsePreviewProduct`, testado contra a resposta real do endpoint — que é a
 * única guarda que serviria de qualquer jeito, já que aquele DTO é escrito à
 * mão e não gerado do backend.
 */

/**
 * O recorte do detalhe da vitrine que vira cartão — subconjunto de
 * `StorefrontProductDetailDto`. Nada além disso é usado.
 */
export interface PreviewProduct {
  productGroupId: number;
  name: string;
  description?: string | null;
  price: number;
  priceMax?: number | null;
  categoryName: string;
  images: { url: string; displayOrder: number }[];
}

/** O cartão pronto, com as URLs já absolutas (robô não resolve caminho relativo). */
export interface LinkPreview {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonicalUrl: string;
  /** Ausente no fallback: sem produto não há `product:price` para declarar. */
  price?: number;
}

const SITE_NAME = "Uaus! Máximo 30";
const SITE_DESCRIPTION = "Tudo o que você precisa por no máximo R$ 30,00, em Tapira-PR.";
/** Mesma arte do `index.html` — usada quando o produto não tem foto ou não carregou. */
const FALLBACK_IMAGE_PATH = "/og-image.png";
/** Teto da descrição: o WhatsApp corta em duas linhas, e cortar aqui evita partir palavra. */
const DESCRIPTION_LIMIT = 200;

/**
 * Caminho do detalhe. Duplica `productDetailPath` de `src/routes.ts` de
 * propósito: importar de lá traria o `lazy(() => import(...))` das páginas — e
 * com ele o React inteiro — para dentro do bundle da função de borda.
 */
function productDetailUrl(origin: string, productGroupId: number): string {
  return `${origin}/produtos/${productGroupId}`;
}

/** `R$ 1.234,50`. Equivale ao `formatCurrency` do core, que aqui não pode ser importado. */
export function formatBrl(value: number): string {
  const [units, cents] = Math.abs(value).toFixed(2).split(".");
  const withThousands = units.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}R$ ${withThousands},${cents}`;
}

/**
 * Rótulo do preço, no mesmo critério da mensagem de reserva
 * (`src/lib/whatsapp.ts`): grupo com faixa vira "a partir de".
 */
function priceLabel(product: PreviewProduct): string {
  return product.priceMax != null && product.priceMax > product.price
    ? `a partir de ${formatBrl(product.price)}`
    : formatBrl(product.price);
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Primeira foto da galeria, respeitando `displayOrder`.
 *
 * A ordem é a do cadastro no admin, e o backend não garante que o array já
 * venha ordenado — pegar `images[0]` colocaria no WhatsApp uma foto que a
 * galeria do site mostra em terceiro lugar.
 */
function primaryImageUrl(product: PreviewProduct): string | undefined {
  return product.images
    .filter((image) => typeof image.url === "string" && image.url.length > 0)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)[0]?.url;
}

/** Valida a resposta da vitrine. Payload estranho vira `undefined`, não exceção. */
export function parsePreviewProduct(data: unknown): PreviewProduct | undefined {
  if (typeof data !== "object" || data === null) return undefined;

  const raw = data as Record<string, unknown>;
  if (typeof raw.name !== "string" || raw.name.trim() === "") return undefined;
  if (typeof raw.price !== "number" || !Number.isFinite(raw.price)) return undefined;
  if (typeof raw.productGroupId !== "number") return undefined;

  const images = Array.isArray(raw.images)
    ? raw.images.flatMap((image) => {
        if (typeof image !== "object" || image === null) return [];
        const entry = image as Record<string, unknown>;
        if (typeof entry.url !== "string") return [];
        const displayOrder = typeof entry.displayOrder === "number" ? entry.displayOrder : 0;
        return [{ url: entry.url, displayOrder }];
      })
    : [];

  return {
    productGroupId: raw.productGroupId,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : null,
    price: raw.price,
    priceMax: typeof raw.priceMax === "number" ? raw.priceMax : null,
    categoryName: typeof raw.categoryName === "string" ? raw.categoryName : "",
    images,
  };
}

/** Cartão do produto: nome no título, preço na primeira linha, foto do produto. */
export function buildProductLinkPreview(product: PreviewProduct, origin: string): LinkPreview {
  const detail = product.description?.trim() || product.categoryName.trim();

  return {
    title: product.name.trim(),
    description: truncate(
      [priceLabel(product), detail || `Reserve pelo WhatsApp na ${SITE_NAME}.`].join(" — "),
      DESCRIPTION_LIMIT,
    ),
    imageUrl: primaryImageUrl(product) ?? `${origin}${FALLBACK_IMAGE_PATH}`,
    imageAlt: product.name.trim(),
    canonicalUrl: productDetailUrl(origin, product.productGroupId),
    price: product.price,
  };
}

/**
 * Cartão genérico da loja. É a saída de TODA falha — produto oculto, 404, API
 * fora do ar, timeout: o robô recebe o preview de hoje em vez de nada, que é o
 * pior resultado possível (link cru, sem título e sem imagem).
 */
export function buildFallbackLinkPreview(origin: string, productGroupId?: number): LinkPreview {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    imageUrl: `${origin}${FALLBACK_IMAGE_PATH}`,
    imageAlt: SITE_NAME,
    canonicalUrl: productGroupId ? productDetailUrl(origin, productGroupId) : origin,
  };
}

/** Escapa para dentro de atributo HTML — nome de produto tem `&`, `"` e `<` de cadastro. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** As tags do cartão, indentadas para entrar dentro de um `<head>` existente. */
function renderLinkPreviewTags(preview: LinkPreview): string {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const image = escapeHtml(preview.imageUrl);
  const url = escapeHtml(preview.canonicalUrl);
  const alt = escapeHtml(preview.imageAlt);

  const tags = [
    `<title>${title}</title>`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:secure_url" content="${image}" />`,
    `<meta property="og:image:alt" content="${alt}" />`,
  ];

  if (preview.price != null) {
    tags.push(
      `<meta property="product:price:amount" content="${preview.price.toFixed(2)}" />`,
      `<meta property="product:price:currency" content="BRL" />`,
    );
  }

  tags.push(
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  );

  return tags.map((tag) => `    ${tag}`).join("\n");
}

/**
 * Tudo do `<head>` que o cartão substitui: título, descrição, canônica e os
 * Open Graph/Twitter da loja. `[^>]*` atravessa quebra de linha de propósito —
 * a meta `description` do `index.html` é escrita em três linhas.
 */
const REPLACED_HEAD_TAGS =
  /<title\b[^>]*>[\s\S]*?<\/title>|<link\b[^>]*\brel\s*=\s*"canonical"[^>]*>|<meta\b[^>]*\b(?:property|name)\s*=\s*"(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>/gi;

/**
 * Troca as tags de cartão do `index.html` de verdade pelas do produto.
 *
 * Reescrever o HTML do site — em vez de devolver uma casca só com meta tags —
 * é o que torna a regra de user-agent do `vercel.json` **não crítica**. Se um
 * navegador embutido (o WebView de dentro do próprio WhatsApp, por exemplo)
 * casar com a regra por engano, a pessoa recebe o site inteiro, funcionando,
 * apenas com meta tags melhores. Com casca, receberia uma página morta — e o
 * erro apareceria justamente no fluxo que o site existe para atender.
 */
export function injectLinkPreview(html: string, preview: LinkPreview): string {
  const headEnd = html.toLowerCase().lastIndexOf("</head>");
  if (headEnd < 0) return renderLinkPreviewDocument(preview);

  const head = html
    .slice(0, headEnd)
    .replace(REPLACED_HEAD_TAGS, "")
    .replace(/\n\s*\n+/g, "\n");

  return `${head.trimEnd()}\n${renderLinkPreviewTags(preview)}\n  ${html.slice(headEnd)}`;
}

/**
 * Documento mínimo, usado só quando o `index.html` não pôde ser lido.
 *
 * Sem `meta refresh` para a própria URL: o robô re-buscaria o mesmo endereço,
 * cairia aqui de novo e o preview nunca fecharia. Sem `noindex` também — se um
 * dia um user-agent do Google entrar na regra do `vercel.json`, um `noindex`
 * aqui tiraria a página do produto do índice de verdade.
 */
export function renderLinkPreviewDocument(preview: LinkPreview): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
${renderLinkPreviewTags(preview)}
  </head>
  <body>
    <img src="${escapeHtml(preview.imageUrl)}" alt="${escapeHtml(preview.imageAlt)}" width="480" />
    <h1>${escapeHtml(preview.title)}</h1>
    <p>${escapeHtml(preview.description)}</p>
    <p><a href="${escapeHtml(preview.canonicalUrl)}">Ver na ${escapeHtml(SITE_NAME)}</a></p>
  </body>
</html>
`;
}
