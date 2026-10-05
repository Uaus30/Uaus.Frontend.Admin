import { render, cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBarcodeInput } from "@workspace/core";
import { ProductBasicInfo } from "../ProductBasicInfo";

/** O mínimo do `useProductEditor` que o campo do código de barras lê. */
function fakeEditor(barcode: string, id: number | null = 883) {
  return {
    form: { productGroupName: "BONECO PAPAI NOEL", departmentId: "", categoryId: "" },
    setForm: vi.fn(),
    productEditor: { id, name: "BONECO PAPAI NOEL", barcode },
    setProductEditor: vi.fn(),
    departments: [],
    filteredCategories: [],
    lookupBarcode: vi.fn(),
  } as unknown as React.ComponentProps<typeof ProductBasicInfo>["editor"];
}

function renderBasicInfo(barcode: string, id: number | null = 883) {
  render(
    <ProductBasicInfo
      editor={fakeEditor(barcode, id)}
      validationErrors={{}}
      setValidationErrors={vi.fn()}
      barcodeInput={resolveBarcodeInput(barcode)}
      currentBarcode={barcode}
      flashSuccess={false}
    />,
  );
}

describe("ProductBasicInfo — código de barras", () => {
  afterEach(cleanup);

  it("não desenha mais a prévia nem oferece imprimir (04/10/2026) — a etiqueta é na tela Etiquetas", () => {
    renderBasicInfo("7891234567895");

    expect(screen.queryByTestId("barcode-preview")).toBeNull();
    expect(screen.queryByTitle(/Imprimir etiqueta/)).toBeNull();
    expect((screen.getByPlaceholderText("Ex: 7891234567890") as HTMLInputElement).value).toBe(
      "7891234567895",
    );
  });

  it("diz o código INTERNO que será gravado, não o que foi digitado", () => {
    // Quem digita 0020 salva 2000000000206; o aviso evita a surpresa no cadastro.
    renderBasicInfo("0020");

    expect(screen.getByText(/Será gravado como/)).toBeTruthy();
    expect(screen.getByText("2000000000206")).toBeTruthy();
  });

  it("explica quando o verificador não fecha", () => {
    renderBasicInfo("7896665551252");

    expect(screen.getByText(/o último dígito deveria ser 3/)).toBeTruthy();
  });

  it("recusa código com letra dizendo o motivo", () => {
    renderBasicInfo("13-00001-01-WD");

    expect(screen.getByText(/apenas números/)).toBeTruthy();
  });

  it("campo vazio no cadastro novo: quem gera o código é a API, ao salvar", () => {
    renderBasicInfo("", null);

    expect(screen.getByText(/a loja gera um ao salvar/)).toBeTruthy();
  });

  it("campo apagado num produto já gravado avisa que as etiquetas impressas param de achar", () => {
    renderBasicInfo("");

    expect(screen.getByText(/este produto já tem código/)).toBeTruthy();
  });
});
