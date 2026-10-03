// @vitest-environment node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writePdf, type PdfPage } from "../pdfWriter";

/**
 * O PDF é escrito à mão, então o teste é a única coisa entre um deslocamento
 * errado e um arquivo que o WhatsApp não abre. O que um leitor de PDF confere
 * ao abrir é exatamente o que está afirmado aqui: a tabela de referências
 * aponta para o começo de cada objeto, e o `startxref` aponta para a tabela.
 *
 * Com `CATALOG_PREVIEW_DIR` definido, o arquivo é gravado naquela pasta para
 * conferir a ESTRUTURA num leitor de verdade (conferido em 03/10/2026 com
 * pypdf em modo estrito e com o MuPDF: páginas, tamanho e link batem).
 */

/** Um JPEG válido de 16 × 16, laranja. */
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBKKKK+XPsT/9k=",
    "base64",
  ),
);

/**
 * A página declara 1080 × 2340 e carrega o JPEG de 16 × 16: o escritor não abre
 * a imagem, só a embute. (Um leitor de verdade pinta a página de preto com este
 * par — para olhar um PDF de verdade, gere pela tela.)
 */
function page(links: PdfPage["links"] = []): PdfPage {
  return { jpeg: JPEG, pixelWidth: 1080, pixelHeight: 2340, links };
}

/** O arquivo lido byte a byte como texto: posição no texto = posição no arquivo. */
const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

/** As posições gravadas na tabela de referências, na ordem dos objetos. */
function xrefOffsets(text: string): number[] {
  // "\nxref\n", e não "xref\n": este último também casa dentro de "startxref".
  const table = text.slice(text.lastIndexOf("\nxref\n") + 1);
  return [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
}

describe("writePdf", () => {
  it("abre com o cabeçalho do PDF e fecha com o marcador de fim", () => {
    const text = asText(writePdf({ title: "Catálogo", pages: [page()], pointsPerPixel: 0.5 }));

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });

  it("a tabela de referências aponta para o começo de CADA objeto", () => {
    const text = asText(writePdf({ title: "Catálogo", pages: [page(), page()], pointsPerPixel: 0.5 }));
    const offsets = xrefOffsets(text);

    // 3 objetos do documento + 3 por página.
    expect(offsets).toHaveLength(9);
    offsets.forEach((offset, index) => {
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it("o startxref aponta para a tabela, e o tamanho conta o objeto zero", () => {
    const text = asText(writePdf({ title: "Catálogo", pages: [page()], pointsPerPixel: 0.5 }));
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);

    expect(text.slice(startxref, startxref + 5)).toBe("xref\n");
    expect(text).toContain("/Size 7 /Root 1 0 R");
    expect(text).toContain("xref\n0 7\n0000000000 65535 f \n");
  });

  it("cada página entra na árvore, com o tamanho em pontos", () => {
    const text = asText(
      writePdf({ title: "Catálogo", pages: [page(), page(), page()], pointsPerPixel: 0.5 }),
    );

    expect(text).toContain("/Type /Pages /Count 3 /Kids [4 0 R 7 0 R 10 0 R]");
    expect(text.match(/\/Type \/Page \//g)).toHaveLength(3);
    // 1080 × 2340 px a meio ponto por pixel.
    expect(text.match(/\/MediaBox \[0 0 540 1170\]/g)).toHaveLength(3);
  });

  it("o JPEG vai inteiro, sem recompressão, com o comprimento certo", () => {
    const bytes = writePdf({ title: "Catálogo", pages: [page()], pointsPerPixel: 0.5 });
    const text = asText(bytes);

    expect(text).toContain(`/Filter /DCTDecode /Length ${JPEG.length} >>`);
    expect(text).toContain("/Width 1080 /Height 2340 /ColorSpace /DeviceRGB");

    const start = text.indexOf("stream\n") + "stream\n".length;
    expect([...bytes.slice(start, start + JPEG.length)]).toEqual([...JPEG]);
    expect(text.slice(start + JPEG.length, start + JPEG.length + 10)).toBe("\nendstream");
  });

  it("o link vira o y de cabeça para baixo: no PDF a origem é o canto de baixo", () => {
    const link = { x: 32, y: 260, width: 498, height: 610, url: "https://uaus.com.br/produtos/905" };
    const text = asText(writePdf({ title: "Catálogo", pages: [page([link])], pointsPerPixel: 0.5 }));

    // esquerda 16, direita 265; topo 1170 − 130 = 1040, base 1170 − 435 = 735.
    expect(text).toContain("/Subtype /Link /Rect [16 735 265 1040]");
    expect(text).toContain("/S /URI /URI (https://uaus.com.br/produtos/905)");
    expect(text).toContain("/Annots [7 0 R]");
  });

  it("página sem link não declara anotações", () => {
    const text = asText(writePdf({ title: "Catálogo", pages: [page()], pointsPerPixel: 0.5 }));

    expect(text).not.toContain("/Annots");
  });

  it("parênteses e parâmetros do link chegam inteiros", () => {
    const url = "https://uaus.com.br/produtos/1?utm_source=whatsapp&utm_campaign=catalogo-(teste)";
    const link = { x: 0, y: 0, width: 10, height: 10, url };
    const text = asText(writePdf({ title: "Catálogo", pages: [page([link])], pointsPerPixel: 0.5 }));

    expect(text).toContain("utm_source=whatsapp&utm_campaign=catalogo-\\(teste\\))");
  });

  it("o título com acento vai em UTF-16, que é o que o PDF aceita fora do ASCII", () => {
    const text = asText(writePdf({ title: "Promoções", pages: [page()], pointsPerPixel: 0.5 }));

    // FEFF + P r o m o ç õ e s
    expect(text).toContain("/Title <FEFF00500072006F006D006F00E700F500650073>");
  });

  it("recusa documento sem página", () => {
    expect(() => writePdf({ title: "Vazio", pages: [], pointsPerPixel: 0.5 })).toThrow(/ao menos uma página/);
  });

  it.runIf(process.env.CATALOG_PREVIEW_DIR)("grava um PDF de amostra para abrir num leitor", async () => {
    const link = { x: 32, y: 260, width: 498, height: 610, url: "https://uaus.com.br/produtos/905" };
    const bytes = writePdf({
      title: "Catálogo de teste",
      pages: [page([link]), page()],
      pointsPerPixel: 0.5,
    });

    const dir = path.resolve(process.env.CATALOG_PREVIEW_DIR!);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "amostra-pdfwriter.pdf"), bytes);
  });
});
