import { describe, expect, it } from "vitest";
import {
  isBlankRichText,
  normalizeLinkHref,
  sanitizeRichText,
  toEditorHtml,
  trimTrailingEmptyParagraphs,
} from "../content";

/**
 * O que está sendo protegido: a descrição antiga em texto puro não perde as
 * quebras de linha nem vira tag; o editor vazio não conta como texto; e o HTML
 * guardado no servidor só chega ao DOM relido pelo esquema do editor — o
 * servidor guarda o que recebe, e qualquer sessão pode mandar qualquer coisa.
 */
describe("toEditorHtml", () => {
  it("texto puro de cartão antigo vira um parágrafo por linha, escapado", () => {
    expect(toEditorHtml("Linha 1\nLinha 2\n\n<b>não é tag</b> & cia")).toBe(
      "<p>Linha 1</p><p>Linha 2</p><p></p><p>&lt;b&gt;não é tag&lt;/b&gt; &amp; cia</p>",
    );
  });

  it("HTML do editor passa como está", () => {
    expect(toEditorHtml("<p>Já <strong>formatado</strong></p>")).toBe("<p>Já <strong>formatado</strong></p>");
    expect(toEditorHtml("<ul><li><p>item</p></li></ul>")).toBe("<ul><li><p>item</p></li></ul>");
  });

  it("vazio e nulo viram vazio", () => {
    expect(toEditorHtml(null)).toBe("");
    expect(toEditorHtml(undefined)).toBe("");
    expect(toEditorHtml("")).toBe("");
  });
});

describe("isBlankRichText", () => {
  it.each([null, undefined, "", "   ", "<p></p>", "<p><br></p><p> </p>", "<p>&nbsp;</p>"])(
    "%j não tem texto",
    (value) => {
      expect(isBlankRichText(value)).toBe(true);
    },
  );

  it.each(["<p>a</p>", "texto puro", "<ul><li><p>1</p></li></ul>"])("%j tem texto", (value) => {
    expect(isBlankRichText(value)).toBe(false);
  });
});

describe("sanitizeRichText", () => {
  it("mantém o que a barra sabe fazer: negrito, itálico, sublinhado, tachado, código, cor, alinhamento, listas e link", () => {
    const html = sanitizeRichText(
      '<h2 style="text-align: center">Título</h2>' +
        '<p><strong>n</strong> <em>i</em> <u>s</u> <s>t</s> <code>c</code> <span style="color: #ef4444">cor</span></p>' +
        "<ol><li><p>um</p></li></ol>" +
        '<p><a href="https://uaus.com.br">site</a></p>',
    );

    expect(html).toContain('<h2 style="text-align: center;">Título</h2>');
    expect(html).toContain("<strong>n</strong>");
    expect(html).toContain("<em>i</em>");
    expect(html).toContain("<u>s</u>");
    expect(html).toContain("<s>t</s>");
    expect(html).toContain("<code>c</code>");
    expect(html).toMatch(/<span style="color: (#ef4444|rgb\(239, 68, 68\));?">cor<\/span>/);
    expect(html).toContain("<ol>");
    expect(html).toContain('href="https://uaus.com.br"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("derruba script, evento, imagem e estilo fora do esquema", () => {
    const html = sanitizeRichText(
      '<p onclick="alert(1)">oi<script>alert(2)</script><img src="x" onerror="alert(3)">' +
        '<span style="background: url(https://evil.example/x.png); color: red">x</span></p>',
    );

    expect(html).not.toMatch(/script|onclick|onerror|<img|background|evil/i);
    expect(html).toContain("oi");
  });

  it("não deixa passar link javascript:", () => {
    const html = sanitizeRichText('<p><a href="javascript:alert(document.cookie)">clique</a></p>');

    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain("clique");
  });

  it("texto puro de cartão antigo chega escapado e com as linhas", () => {
    expect(sanitizeRichText("A <script>\nB")).toBe("<p>A &lt;script&gt;</p><p>B</p>");
  });
});

describe("normalizeLinkHref", () => {
  it("endereço sem protocolo ganha https:// (senão vira link relativo e abre o próprio admin)", () => {
    expect(normalizeLinkHref("www.fornecedor.com.br")).toBe("https://www.fornecedor.com.br");
    expect(normalizeLinkHref("  fornecedor.com.br/pedido?x=1 ")).toBe("https://fornecedor.com.br/pedido?x=1");
  });

  it("protocolo, caminho e âncora passam como estão", () => {
    expect(normalizeLinkHref("https://uaus.com.br")).toBe("https://uaus.com.br");
    expect(normalizeLinkHref("http://192.168.0.10")).toBe("http://192.168.0.10");
    expect(normalizeLinkHref("mailto:loja@uaus.com.br")).toBe("mailto:loja@uaus.com.br");
    expect(normalizeLinkHref("/tarefas")).toBe("/tarefas");
    expect(normalizeLinkHref("#anexos")).toBe("#anexos");
  });

  it("vazio continua vazio (tira o link)", () => {
    expect(normalizeLinkHref("   ")).toBe("");
  });
});

describe("trimTrailingEmptyParagraphs", () => {
  it("tira os parágrafos vazios do fim (o que o editor deixa depois de uma lista)", () => {
    expect(trimTrailingEmptyParagraphs("<ul><li><p>a</p></li></ul><p></p>")).toBe(
      "<ul><li><p>a</p></li></ul>",
    );
    expect(trimTrailingEmptyParagraphs("<p>a</p><p></p><p><br></p>")).toBe("<p>a</p>");
  });

  it("não mexe em parágrafo vazio no meio do texto", () => {
    expect(trimTrailingEmptyParagraphs("<p>a</p><p></p><p>b</p>")).toBe("<p>a</p><p></p><p>b</p>");
  });
});
