import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ImageHoverZoom } from "../image-hover-zoom";

/**
 * O que estes testes protegem.
 *
 * 1. **A moldura é de quem chama.** Cada tela passa as próprias classes de
 *    miniatura — 40px na tabela de produtos, 80px nas fotos da compra, o
 *    `aspect-square` da galeria. Um dia em que o componente resolvesse impor a
 *    dele, oito telas mudariam de layout sem nenhum arquivo delas no diff.
 * 2. **A ampliação não nasce montada.** Ela é a MESMA URL da miniatura, em 320px;
 *    se viesse no DOM desde o primeiro render, uma listagem de 100 linhas
 *    baixaria 100 fotos grandes que ninguém pediu.
 * 3. **A ampliação não corta.** `object-contain` é o motivo de existir do
 *    componente: com `cover` a foto ampliada perde a tampa do frasco e o volume
 *    do rótulo, que é o detalhe pelo qual se amplia.
 */
describe("ImageHoverZoom", () => {
  it("mantem na miniatura as classes de quem chama", () => {
    render(
      <ImageHoverZoom
        src="https://cdn.uaus.com.br/refrigerante.jpg"
        alt="Refrigerante Cola 2L"
        className="h-10 w-10 rounded-lg object-cover"
      />,
    );

    const miniatura = screen.getByAltText("Refrigerante Cola 2L");

    expect(miniatura.getAttribute("src")).toBe("https://cdn.uaus.com.br/refrigerante.jpg");
    expect(miniatura.className).toBe("h-10 w-10 rounded-lg object-cover");
  });

  it("so baixa a foto grande depois que o mouse entra", async () => {
    render(<ImageHoverZoom src="https://cdn.uaus.com.br/rodo.jpg" alt="Rodo de pia" />);

    // Antes do hover existe UMA foto na tela: a miniatura.
    expect(screen.getAllByAltText("Rodo de pia")).toHaveLength(1);

    fireEvent.pointerEnter(screen.getByAltText("Rodo de pia"));

    await waitFor(() => expect(screen.getAllByAltText("Rodo de pia")).toHaveLength(2));
  });

  it("amplia a mesma foto sem cortar", async () => {
    render(<ImageHoverZoom src="https://cdn.uaus.com.br/rodo.jpg" alt="Rodo de pia" />);

    fireEvent.pointerEnter(screen.getByAltText("Rodo de pia"));

    const ampliada = await waitFor(() => {
      const fotos = screen.getAllByAltText("Rodo de pia");
      expect(fotos).toHaveLength(2);
      return fotos[1];
    });

    expect(ampliada.getAttribute("src")).toBe("https://cdn.uaus.com.br/rodo.jpg");
    expect(ampliada.className).toContain("object-contain");
  });
});
