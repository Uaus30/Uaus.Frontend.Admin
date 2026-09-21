import { render, cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBarcodeInput } from "@workspace/core";

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
      barcodeInput={resolveBarcodeInput(barcode)}
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

  it("desenha o código INTERNO que será gravado, não o que foi digitado", () => {
    // Quem digita 0020 salva 2000000000206; mostrar 0020 na prévia prometeria
    // uma etiqueta que o cadastro não vai guardar.
    expect(renderBasicInfo("0020")).toEqual({ format: "EAN13", value: "2000000000206" });
    expect(screen.getByText(/Será gravado como/)).toBeTruthy();
    expect(screen.getByText("2000000000206")).toBeTruthy();
  });

  it("não desenha nada e explica quando o verificador não fecha", () => {
    // Regressão de 07/09/2026: com `format="EAN13"` fixo a jsbarcode lançava, o
    // SVG ficava vazio e a tela mostrava um retângulo branco de 300x150. Desde
    // 21/09/2026 o código nem chega a ser desenhado — ele é RECUSADO, porque
    // gravá-lo produziria etiqueta que nenhum leitor lê.
    expect(renderBasicInfo("7896665551252")).toEqual({ format: undefined, value: undefined });
    expect(screen.getByText(/o último dígito deveria ser 3/)).toBeTruthy();
  });

  it("recusa código com letra dizendo o motivo", () => {
    expect(renderBasicInfo("13-00001-01-WD")).toEqual({ format: undefined, value: undefined });
    expect(screen.getByText(/apenas números/)).toBeTruthy();
  });

  it("campo vazio não inventa código: quem gera é a API, ao salvar", () => {
    // A sequence vive no banco. Desenhar aqui um código derivado do id, como a
    // tela fazia até 21/09/2026, mostrava um número que o cadastro não guardava.
    expect(renderBasicInfo("")).toEqual({ format: undefined, value: undefined });
    expect(screen.getByText("Gerado ao salvar")).toBeTruthy();
  });

  it("desabilita a impressão da etiqueta quando não há código para imprimir", () => {
    render(
      <ProductBasicInfo
        editor={fakeEditor("")}
        validationErrors={{}}
        setValidationErrors={vi.fn()}
        barcodeInput={resolveBarcodeInput("")}
        currentBarcode=""
        flashSuccess={false}
        onPrintBarcode={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Imprimir etiqueta (80mm)").hasAttribute("disabled")).toBe(true);
  });
});
