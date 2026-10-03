/**
 * Escreve o PDF do catálogo: uma imagem JPEG por página e uma área clicável
 * por produto.
 *
 * É escrito à mão, sem biblioteca, e é de propósito. O que o catálogo precisa
 * do formato são três coisas — página, imagem e link — e isso cabe em cem
 * linhas. A biblioteca usual (jsPDF) pesa 30 MB instalada, traz html2canvas,
 * canvg e dompurify de carona e entraria no pacote do admin por causa de uma
 * tela.
 *
 * O arquivo é um PDF 1.4 comum: catálogo, árvore de páginas, e por página o
 * objeto da página, a imagem (`DCTDecode` — o JPEG vai inteiro, sem
 * recompressão), o conteúdo que a desenha e as anotações de link.
 */

/** Área clicável, em pixels da página, com a origem no canto de CIMA à esquerda. */
export interface PdfLink {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

export interface PdfPage {
  /** A página já em JPEG (RGB, 8 bits — o que o canvas do navegador entrega). */
  jpeg: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  links: PdfLink[];
}

export interface PdfDocument {
  title: string;
  pages: PdfPage[];
  /**
   * Pontos por pixel. Com 0,5, a página de 1080 px vira 540 pt de largura —
   * perto da largura de uma tela de celular, que é onde o arquivo é lido.
   */
  pointsPerPixel: number;
}

const encoder = new TextEncoder();

/** Número no formato do PDF: ponto decimal, sem zeros sobrando. */
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Texto do PDF entre parênteses: barra e parênteses precisam de escape. */
function literal(text: string): string {
  return `(${text.replace(/[\\()]/g, (char) => `\\${char}`)})`;
}

/** Texto com acento, em UTF-16 com marca de ordem — o que o PDF aceita fora do ASCII. */
function utf16Hex(text: string): string {
  let hex = "FEFF";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const units =
      code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code];
    for (const unit of units) hex += unit.toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

/** Monta o arquivo. Lança se não houver página: PDF vazio não abre em leitor nenhum. */
export function writePdf(document: PdfDocument): Uint8Array<ArrayBuffer> {
  if (document.pages.length === 0) throw new Error("O catálogo precisa de ao menos uma página.");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };

  /** Abre o objeto `id` e guarda onde ele começa — a tabela do fim aponta para cá. */
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };

  // 1 catálogo, 2 árvore de páginas, 3 informações; depois, por página, a página,
  // a imagem, o conteúdo e um objeto por link.
  let nextId = 4;
  const layout = document.pages.map((page) => {
    const ids = { page: nextId++, image: nextId++, content: nextId++, links: page.links.map(() => nextId++) };
    return { page, ids };
  });

  // O comentário binário da segunda linha avisa a quem transporta o arquivo que
  // ele não é texto — sem isso há servidor de e-mail que o converte e corrompe.
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Count ${layout.length} /Kids [${layout.map(({ ids }) => `${ids.page} 0 R`).join(" ")}] >>`,
  );
  object(3, `<< /Title ${utf16Hex(document.title)} /Producer (Uaus Admin) >>`);

  for (const { page, ids } of layout) {
    const width = page.pixelWidth * document.pointsPerPixel;
    const height = page.pixelHeight * document.pointsPerPixel;
    const annots = ids.links.length > 0 ? ` /Annots [${ids.links.map((id) => `${id} 0 R`).join(" ")}]` : "";

    object(
      ids.page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] ` +
        `/Resources << /XObject << /Im0 ${ids.image} 0 R >> >> /Contents ${ids.content} 0 R${annots} >>`,
    );

    object(
      ids.image,
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`,
      page.jpeg,
    );

    // A imagem é um quadrado de 1 × 1 esticado para a página inteira.
    const content = encoder.encode(`q ${num(width)} 0 0 ${num(height)} 0 0 cm /Im0 Do Q`);
    object(ids.content, `<< /Length ${content.length} >>`, content);

    page.links.forEach((link, index) => {
      // No PDF a origem é o canto de BAIXO: o y vira ao contrário.
      const left = link.x * document.pointsPerPixel;
      const right = (link.x + link.width) * document.pointsPerPixel;
      const top = height - link.y * document.pointsPerPixel;
      const bottom = height - (link.y + link.height) * document.pointsPerPixel;

      object(
        ids.links[index],
        `<< /Type /Annot /Subtype /Link /Rect [${num(left)} ${num(bottom)} ${num(right)} ${num(top)}] ` +
          `/Border [0 0 0] /A << /Type /Action /S /URI /URI ${literal(new URL(link.url).href)} >> >>`,
      );
    });
  }

  // A tabela de referências: uma linha de 20 bytes por objeto, com a posição
  // dele no arquivo. É por ela que o leitor acha as páginas.
  const xref = length;
  const total = nextId;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const file = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    file.set(chunk, position);
    position += chunk.length;
  }
  return file;
}
