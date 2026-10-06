import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductImagesSection } from "../ProductImagesSection";
import type { LocalImage } from "../../types";

function foto(n: number): LocalImage {
  return { name: `foto ${n}`, url: `https://cdn/foto-${n}.jpg`, imageId: n };
}

function renderSection(images: LocalImage[]) {
  const setImages = vi.fn();
  const onSearchWebImage = vi.fn();
  const reorderProductImage = vi.fn();
  render(
    <ProductImagesSection
      images={images}
      setImages={setImages}
      handleSimpleFileSelection={vi.fn()}
      reorderProductImage={reorderProductImage}
      productName="CANECA"
      onSearchWebImage={onSearchWebImage}
    />,
  );
  return { setImages, onSearchWebImage, reorderProductImage };
}

describe("ProductImagesSection — capa grande e duas menores (04/10/2026)", () => {
  afterEach(cleanup);

  it("produto sem foto mostra os três lugares vazios, o primeiro como foto principal", () => {
    renderSection([]);

    expect(screen.getByLabelText("Adicionar a foto principal")).toBeTruthy();
    expect(screen.getAllByLabelText("Adicionar foto")).toHaveLength(2);
  });

  it("com uma foto, ela é a principal e sobram dois lugares para acrescentar", () => {
    renderSection([foto(1)]);

    expect(screen.getByText("Principal")).toBeTruthy();
    expect(screen.getByAltText("foto 1")).toBeTruthy();
    expect(screen.getAllByLabelText("Adicionar foto")).toHaveLength(2);
  });

  it("com três fotos não há onde acrescentar, e a busca na web fica travada", () => {
    renderSection([foto(1), foto(2), foto(3)]);

    expect(screen.queryByLabelText(/Adicionar/)).toBeNull();
    const busca = screen.getByRole("button", { name: /Buscar na Web/ });
    expect(busca.hasAttribute("disabled")).toBe(true);
    expect(busca.getAttribute("title")).toContain("já tem 3 fotos");
  });

  it("remover tira a foto clicada e mantém a ordem das outras", () => {
    const { setImages } = renderSection([foto(1), foto(2), foto(3)]);

    fireEvent.click(screen.getByLabelText("Remover a foto 2"));

    const atualizar = setImages.mock.calls[0][0] as (current: LocalImage[]) => LocalImage[];
    expect(atualizar([foto(1), foto(2), foto(3)]).map((image) => image.imageId)).toEqual([1, 3]);
  });

  it("a estrela leva a foto para o primeiro lugar — no toque não existe arrasto", () => {
    const { reorderProductImage } = renderSection([foto(1), foto(2), foto(3)]);

    // A capa não tem estrela: ela já é a principal.
    expect(screen.queryByLabelText("Tornar a foto 1 a principal")).toBeNull();

    fireEvent.click(screen.getByLabelText("Tornar a foto 3 a principal"));

    expect(reorderProductImage).toHaveBeenCalledWith(2, 0);
  });
});
