/**
 * O `index.html` de verdade (`?raw`), não uma imitação: é o que faz o teste
 * avisar quando alguém acrescentar uma tag de cartão lá e o produto passar a
 * concorrer com a loja pelo mesmo `og:` — o robô fica com a primeira que
 * encontra, e a falha só apareceria no WhatsApp de alguém.
 */
import indexHtml from "../../index.html?raw";
import { describe, expect, it } from "vitest";
import {
  buildFallbackLinkPreview,
  buildProductLinkPreview,
  formatBrl,
  injectLinkPreview,
  parsePreviewProduct,
  renderLinkPreviewDocument,
  type PreviewProduct,
} from "../link-preview";

const ORIGIN = "https://uaus.com.br";

function makeProduct(overrides: Partial<PreviewProduct> = {}): PreviewProduct {
  return {
    productGroupId: 907,
    name: "PF.FARMAX ACETONA AZUL 100ML UN",
    description: null,
    price: 7,
    priceMax: null,
    categoryName: "Beleza em Geral",
    images: [{ url: "https://s3.exemplo/foto.webp", displayOrder: 0 }],
    ...overrides,
  };
}

describe("formatBrl", () => {
  it("formata no padrão brasileiro, com milhar", () => {
    expect(formatBrl(7)).toBe("R$ 7,00");
    expect(formatBrl(29.9)).toBe("R$ 29,90");
    expect(formatBrl(1234.5)).toBe("R$ 1.234,50");
    expect(formatBrl(0)).toBe("R$ 0,00");
  });
});

describe("parsePreviewProduct", () => {
  it("aceita a resposta real de /Storefront/products/:id", () => {
    const product = parsePreviewProduct({
      productGroupId: 907,
      name: "PF.FARMAX ACETONA AZUL 100ML UN",
      price: 7.0,
      hasVariations: false,
      categoryName: "Beleza em Geral",
      images: [{ url: "https://s3.exemplo/foto.webp", displayOrder: 0 }],
      tags: [],
      variations: [],
    });

    expect(product?.name).toBe("PF.FARMAX ACETONA AZUL 100ML UN");
    expect(product?.images).toEqual([{ url: "https://s3.exemplo/foto.webp", displayOrder: 0 }]);
    // Campos ausentes no JSON viram nulo, não `undefined` solto no cartão.
    expect(product?.priceMax).toBeNull();
    expect(product?.description).toBeNull();
  });

  it("recusa payload que não é produto", () => {
    expect(parsePreviewProduct(null)).toBeUndefined();
    expect(parsePreviewProduct("<html>login</html>")).toBeUndefined();
    expect(parsePreviewProduct({ name: "Sem preço", productGroupId: 1 })).toBeUndefined();
    expect(parsePreviewProduct({ name: "", price: 7, productGroupId: 1 })).toBeUndefined();
  });

  it("descarta imagem sem url em vez de derrubar o preview", () => {
    const product = parsePreviewProduct({
      productGroupId: 1,
      name: "Caneca",
      price: 25,
      images: [{ displayOrder: 0 }, { url: "https://s3.exemplo/ok.webp" }],
    });

    expect(product?.images).toEqual([{ url: "https://s3.exemplo/ok.webp", displayOrder: 0 }]);
  });
});

describe("buildProductLinkPreview", () => {
  it("usa a primeira foto por displayOrder, não a primeira do array", () => {
    const preview = buildProductLinkPreview(
      makeProduct({
        images: [
          { url: "https://s3.exemplo/terceira.webp", displayOrder: 2 },
          { url: "https://s3.exemplo/primeira.webp", displayOrder: 0 },
        ],
      }),
      ORIGIN,
    );

    expect(preview.imageUrl).toBe("https://s3.exemplo/primeira.webp");
  });

  it("cai na arte da loja quando o produto não tem foto", () => {
    const preview = buildProductLinkPreview(makeProduct({ images: [] }), ORIGIN);

    expect(preview.imageUrl).toBe("https://uaus.com.br/og-image.png");
  });

  it("põe nome no título e preço no começo da descrição", () => {
    const preview = buildProductLinkPreview(makeProduct(), ORIGIN);

    expect(preview.title).toBe("PF.FARMAX ACETONA AZUL 100ML UN");
    expect(preview.description).toBe("R$ 7,00 — Beleza em Geral");
    expect(preview.canonicalUrl).toBe("https://uaus.com.br/produtos/907");
  });

  it("usa 'a partir de' quando o grupo tem faixa de preço", () => {
    const preview = buildProductLinkPreview(makeProduct({ price: 10, priceMax: 25 }), ORIGIN);

    expect(preview.description).toContain("a partir de R$ 10,00");
  });

  it("prefere a descrição do cadastro à categoria", () => {
    const preview = buildProductLinkPreview(makeProduct({ description: "Acetona para unhas." }), ORIGIN);

    expect(preview.description).toBe("R$ 7,00 — Acetona para unhas.");
  });

  it("corta descrição longa sem partir palavra", () => {
    const preview = buildProductLinkPreview(makeProduct({ description: "palavra ".repeat(60) }), ORIGIN);

    expect(preview.description.length).toBeLessThanOrEqual(201);
    expect(preview.description.endsWith("…")).toBe(true);
    expect(preview.description).not.toContain("palav…");
  });
});

describe("buildFallbackLinkPreview", () => {
  it("mantém a URL do produto quando só a API falhou", () => {
    const preview = buildFallbackLinkPreview(ORIGIN, 907);

    expect(preview.canonicalUrl).toBe("https://uaus.com.br/produtos/907");
    expect(preview.imageUrl).toBe("https://uaus.com.br/og-image.png");
    expect(preview.title).toBe("Uaus! Máximo 30");
  });

  it("sem id, aponta para a home", () => {
    expect(buildFallbackLinkPreview(ORIGIN).canonicalUrl).toBe(ORIGIN);
  });
});

describe("renderLinkPreviewDocument", () => {
  it("declara a foto do produto como og:image", () => {
    const html = renderLinkPreviewDocument(buildProductLinkPreview(makeProduct(), ORIGIN));

    expect(html).toContain('<meta property="og:image" content="https://s3.exemplo/foto.webp" />');
    expect(html).toContain('<meta property="og:url" content="https://uaus.com.br/produtos/907" />');
    expect(html).toContain('<meta property="og:title" content="PF.FARMAX ACETONA AZUL 100ML UN" />');
    expect(html).toContain('<meta property="product:price:amount" content="7.00" />');
  });

  it("escapa aspas e & do nome cadastrado", () => {
    const html = renderLinkPreviewDocument(
      buildProductLinkPreview(makeProduct({ name: 'Caneca 12" & cia <b>' }), ORIGIN),
    );

    expect(html).toContain('content="Caneca 12&quot; &amp; cia &lt;b&gt;"');
    expect(html).not.toContain('content="Caneca 12" &');
  });

  it("não redireciona para a própria URL", () => {
    // `meta refresh` aqui faria o robô buscar o mesmo endereço, cair nesta
    // função de novo e nunca fechar o preview.
    const html = renderLinkPreviewDocument(buildFallbackLinkPreview(ORIGIN, 1));

    expect(html).not.toContain("http-equiv");
    expect(html).not.toContain("noindex");
  });

  it("omite product:price quando não há produto", () => {
    const html = renderLinkPreviewDocument(buildFallbackLinkPreview(ORIGIN));

    expect(html).not.toContain("product:price");
  });
});

describe("injectLinkPreview", () => {
  it("substitui as tags da loja pelas do produto no index.html publicado", () => {
    const html = injectLinkPreview(indexHtml, buildProductLinkPreview(makeProduct(), ORIGIN));

    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain('<meta property="og:image" content="https://s3.exemplo/foto.webp" />');
    expect(html).toContain("<title>PF.FARMAX ACETONA AZUL 100ML UN</title>");
    expect(html).not.toContain("https://uaus.com.br/og-image.png");
    expect(html).not.toContain("Tudo por até R$ 30 em Tapira-PR");
  });

  it("preserva o app — o robô não é o único que pode cair aqui", () => {
    const html = injectLinkPreview(indexHtml, buildProductLinkPreview(makeProduct(), ORIGIN));

    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('"@type": "Store"');
    expect(html).toContain("fonts.googleapis.com");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("remove a meta description mesmo escrita em várias linhas", () => {
    // O index.html quebra `<meta name="description" ...>` em três linhas; um
    // regex que parasse na quebra deixaria a descrição da loja no cartão.
    expect(indexHtml).toMatch(/<meta\s*\n\s*name="description"/);

    const html = injectLinkPreview(indexHtml, buildProductLinkPreview(makeProduct(), ORIGIN));

    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).toContain('<meta name="description" content="R$ 7,00 — Beleza em Geral" />');
  });

  it("cai no documento mínimo quando o HTML não tem head", () => {
    const html = injectLinkPreview("resposta que não é o site", buildFallbackLinkPreview(ORIGIN, 907));

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta property="og:url" content="https://uaus.com.br/produtos/907" />');
  });
});
