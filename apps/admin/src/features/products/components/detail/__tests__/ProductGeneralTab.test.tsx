import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBarcodeInput } from "@workspace/core";

// Os blocos da aba têm teste próprio; aqui importa só onde cada um mora.
vi.mock("../../editor/ProductBasicInfo", () => ({ ProductBasicInfo: () => <p>campos obrigatórios</p> }));
vi.mock("../../editor/ProductCostAndStock", () => ({ ProductCostAndStock: () => null }));
vi.mock("../../editor/ProductPricing", () => ({ ProductPricing: () => <p>preço e status</p> }));
vi.mock("../../editor/ProductImageGallery", () => ({ ProductImageGallery: () => <p>fotos</p> }));
vi.mock("../../editor/ProductVariationsManager", () => ({ ProductVariationsManager: () => null }));
vi.mock("../../editor/ProductOptionalFields", () => ({
  ProductOptionalFields: () => <label>Estoque mínimo</label>,
}));

const { ProductGeneralTab } = await import("../ProductGeneralTab");

function renderTab() {
  const editor = {
    form: { hasVariations: false },
    variationDrafts: [],
  } as unknown as React.ComponentProps<typeof ProductGeneralTab>["editor"];

  render(
    <ProductGeneralTab
      editor={editor}
      validationErrors={{}}
      setValidationErrors={vi.fn()}
      barcodeInput={resolveBarcodeInput("")}
      currentBarcode=""
      flashSuccess={false}
      setSearchModalOpen={vi.fn()}
      setVariationToDelete={vi.fn()}
      onOpenGradePicker={vi.fn()}
    />,
  );
}

describe("ProductGeneralTab — os opcionais voltaram para a aba Dados (04/10/2026)", () => {
  afterEach(cleanup);

  it("ficam ocultos por padrão, atrás de 'Mais campos'", () => {
    renderTab();

    const botao = screen.getByRole("button", { name: /Mais campos/ });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Estoque mínimo").closest("[hidden]")).not.toBeNull();
  });

  it("'Mais campos' mostra os opcionais, e fechar só esconde — o digitado continua no formulário", () => {
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /Mais campos/ }));
    expect(screen.getByText("Estoque mínimo").closest("[hidden]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Menos campos/ }));
    // Continua no DOM (só escondido): desmontar perderia o que foi digitado.
    expect(screen.getByText("Estoque mínimo").closest("[hidden]")).not.toBeNull();
  });

  it("as fotos estão na própria aba, junto dos campos", () => {
    renderTab();

    expect(screen.getByText("fotos")).toBeTruthy();
    expect(screen.getByText("preço e status")).toBeTruthy();
  });
});
