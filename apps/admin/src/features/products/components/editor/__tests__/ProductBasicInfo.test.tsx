import { render, cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDisplayBarcode } from "../../../lib/barcode";

/**
 * A `react-barcode` desenha via jsbarcode, que mede o texto num canvas — e o
 * jsdom não tem canvas, então no teste ela devolveria um SVG vazio para
 * QUALQUER código, válido ou não. O dublê expõe o que a tela pediu, que é onde
 * o defeito estava: o formato vinha do comprimento, não do verificador.
 */
vi.mock("react-barcode", () => ({
  default: ({ value, format }: { value: string; format: string }) => (
    <svg data-value={value} data-format={format} />
  ),
}));

const { ProductBasicInfo } = await import("../ProductBasicInfo");

/** O mínimo do `useProductEditor` que a prévia do código de barras lê. */
function fakeEditor(barcode: string) {
  return {
    form: { productGroupName: "BONECO PAPAI NOEL", departmentId: "", categoryId: "" },
    setForm: vi.fn(),
    productEditor: { id: 883, name: "BONECO PAPAI NOEL", barcode },
    setProductEditor: vi.fn(),
    departments: [],
    filteredCategories: [],
    lookupBarcode: vi.fn(),
  } as unknown as React.ComponentProps<typeof ProductBasicInfo>["editor"];
}

function renderBasicInfo(barcode: string) {
  render(
    <ProductBasicInfo
      editor={fakeEditor(barcode)}
      validationErrors={{}}
      setValidationErrors={vi.fn()}
      displayBarcode={buildDisplayBarcode(barcode, 883)}
      currentBarcode={barcode}
      flashSuccess={false}
      onPrintBarcode={vi.fn()}
    />,
  );

  const svg = screen.getByTestId("barcode-preview").querySelector("svg");
  return { format: svg?.getAttribute("data-format"), value: svg?.getAttribute("data-value") };
}

describe("ProductBasicInfo — prévia do código de barras", () => {
  afterEach(cleanup);

  it("desenha o EAN-13 de fábrica como EAN-13", () => {
    expect(renderBasicInfo("7891234567895")).toEqual({
      format: "EAN13",
      value: "7891234567895",
    });
  });

  it("cai no CODE128 quando o verificador do código não fecha", () => {
    // Regressão: o produto #883 tem `7896665551252`, cujo verificador deveria
    // ser 3. Com `format="EAN13"` fixo a jsbarcode lançava, o SVG ficava vazio
    // e a tela mostrava um retângulo branco de 300x150 no lugar da prévia.
    // O NÚMERO tem que continuar o mesmo: é ele que o PDV procura ao bipar.
    expect(renderBasicInfo("7896665551252")).toEqual({
      format: "CODE128",
      value: "7896665551252",
    });
  });

  it("desenha o código interno gerado para produto sem EAN", () => {
    expect(renderBasicInfo("")).toEqual({ format: "EAN13", value: "2000000008837" });
  });
});
