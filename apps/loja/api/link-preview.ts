import {
  buildFallbackLinkPreview,
  buildProductLinkPreview,
  injectLinkPreview,
  parsePreviewProduct,
  renderLinkPreviewDocument,
  type PreviewProduct,
} from "../server/link-preview";

/**
 * Função de borda que responde `/produtos/:id` com o cartão do produto.
 *
 * Só chega aqui quem o `has: user-agent` do `vercel.json` desviou — WhatsApp,
 * facebookexternalhit e afins. O visitante comum continua recebendo o
 * `index.html` estático direto do CDN, sem passar por função nenhuma.
 *
 * Roda no runtime de borda (não Node) porque tudo que ela faz é dois `fetch` e
 * uma troca de string: sem cold start e sem depender da versão de Node do
 * projeto.
 */
export const config = { runtime: "edge" };

/**
 * O robô do WhatsApp desiste rápido. Melhor devolver o cartão genérico da loja
 * em 4s do que o robô fechar a conexão e o link sair cru, sem título nenhum.
 */
const UPSTREAM_TIMEOUT_MS = 4000;

/** `fetch` que desiste no prazo e nunca lança — falha aqui vira fallback, não 500. */
async function fetchWithTimeout(url: string, accept: string): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers: { accept }, signal: controller.signal });
    return response.ok ? response : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca o produto pela PRÓPRIA origem (`/api/Storefront/...`), não direto na
 * API.
 *
 * É o que mantém a regra do CLAUDE.md §10 num lugar só: quem decide se a
 * chamada vai para `api.uaus.com.br` ou `api-dev.uaus.com.br` é o `has: host`
 * do `vercel.json`, e este código herda a decisão de graça. Repetir a lista de
 * hosts aqui criaria um segundo lugar para errar — e o erro apareceria como
 * preço de dev no compartilhamento de produção.
 */
async function fetchPreviewProduct(origin: string, productGroupId: number): Promise<PreviewProduct | undefined> {
  const response = await fetchWithTimeout(`${origin}/api/Storefront/products/${productGroupId}`, "application/json");
  if (!response) return undefined;

  try {
    return parsePreviewProduct(await response.json());
  } catch {
    return undefined;
  }
}

/**
 * O `index.html` publicado, que é o corpo da resposta.
 *
 * `/index.html` é arquivo de verdade no `outputDirectory`, e a Vercel resolve
 * o sistema de arquivos ANTES dos rewrites — então esta busca pega o estático
 * do CDN e não volta para esta função.
 */
async function fetchSiteDocument(origin: string): Promise<string | undefined> {
  const response = await fetchWithTimeout(`${origin}/index.html`, "text/html");
  if (!response) return undefined;

  const html = await response.text();
  return html.toLowerCase().includes("</head>") ? html : undefined;
}

export default async function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);

  // O host do visitante, não o do deployment: é ele que escolhe a API no
  // `vercel.json` e é ele que precisa aparecer na URL canônica do cartão.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const origin = `https://${host}`;

  const rawId = Number(requestUrl.searchParams.get("id"));
  const productGroupId = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;

  const [product, document] = await Promise.all([
    productGroupId ? fetchPreviewProduct(origin, productGroupId) : undefined,
    fetchSiteDocument(origin),
  ]);

  const preview = product
    ? buildProductLinkPreview(product, origin)
    : buildFallbackLinkPreview(origin, productGroupId);

  return new Response(document ? injectLinkPreview(document, preview) : renderLinkPreviewDocument(preview), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Sem cache de CDN, de propósito. Esta resposta é específica de
      // user-agent: se o CDN a guardasse sob a chave `/produtos/:id`, o próximo
      // visitante humano receberia o HTML de um produto qualquer. O `Vary` diz
      // o mesmo para qualquer proxy no caminho. O volume aqui é de robô — não
      // há o que otimizar.
      "cache-control": "no-store",
      vary: "User-Agent",
    },
  });
}
