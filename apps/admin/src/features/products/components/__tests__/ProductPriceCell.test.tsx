import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import type { PromotionRule, ShelfPrice } from "@workspace/core";
import { ProductPriceCell } from "../ProductPriceCell";
import type { ProductTableRow } from "../../types";

const RELAMPAGO: PromotionRule = {
  id: 4,
  kind: "flash",
  discountKind: "finalPrice",
  discountValue: 7.5,
  productGroupIds: [825],
  comboQuantity: null,
  validFrom: "2026-10-11T08:00:00",
  validUntil: "2026-10-11T18:00:00",
  maxQuantityPerSale: null,
};

/** Produto simples: é o que tem a edição rápida do preço na célula. */
function simples(shelf?: ShelfPrice): ProductTableRow {
  return {
    id: 987,
    productGroupId: 825,
    name: "COPO AMERICANO",
    productName: "COPO AMERICANO",
    description: null,
    barcode: "7891234567890",
    price: 10,
    shelf,
    costPrice: 5,
    stock: 3,
    minStock: 0,
    status: PRODUCT_STATUS.Active,
    variationCount: 1,
    variations: [],
    productGroup: {
      id: 825,
      name: "COPO AMERICANO",
      description: null,
      hasVariations: false,
      showOnSite: true,
      notes: null,
    },
    category: { id: 5, name: "Utilidades" },
    department: { id: 2, name: "Casa" },
    tags: [],
    images: [],
  };
}

/** Texto sem o espaço inquebrável que o `Intl` põe depois do "R$". */
const texto = (el: HTMLElement) => (el.textContent ?? "").replace(/\u00a0/g, " ");

describe("ProductPriceCell", () => {
  afterEach(cleanup);

  it("sem promoção, é só o campo do preço de tabela", () => {
    const { container } = render(<ProductPriceCell product={simples()} />);

    expect((screen.getByLabelText("Preço de venda") as HTMLInputElement).value).toBe("10,00");
    expect(texto(container)).not.toContain("De");
  });

  it("na relâmpago, o campo vai para o 'De' riscado e o promocional vira o preço principal", () => {
    const shelf: ShelfPrice = { kind: "unit", price: 7.5, referencePrice: 10, promotion: RELAMPAGO };
    const { container } = render(<ProductPriceCell product={simples(shelf)} />);

    const campo = screen.getByLabelText("Preço de tabela (sem a promoção)") as HTMLInputElement;
    expect(campo.value).toBe("10,00");
    expect(campo.className).toContain("line-through");
    expect(texto(container)).toContain("por R$ 7,50");
    expect(texto(container)).toContain("Relâmpago");
  });

  it("o campo riscado continua gravando o preço de TABELA", () => {
    // O promocional é derivado do de tabela a cada leitura; a edição rápida
    // gravar 7,50 baixaria o preço do produto para sempre.
    const onUpdatePrice = vi.fn().mockResolvedValue(undefined);
    const shelf: ShelfPrice = { kind: "unit", price: 7.5, referencePrice: 10, promotion: RELAMPAGO };
    const product = simples(shelf);
    render(<ProductPriceCell product={product} onUpdatePrice={onUpdatePrice} />);

    const campo = screen.getByLabelText("Preço de tabela (sem a promoção)");
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "11,90" } });
    fireEvent.blur(campo);

    expect(onUpdatePrice).toHaveBeenCalledWith(product, 11.9);
  });

  it("no combo, o preço de tabela continua o principal e o selo resume a oferta", () => {
    const combo: ShelfPrice = {
      kind: "combo",
      price: 10,
      offer: "3 por R$ 20,00",
      promotion: {
        ...RELAMPAGO,
        kind: "combo",
        discountKind: "kitPrice",
        discountValue: 20,
        comboQuantity: 3,
      },
    };
    const { container } = render(<ProductPriceCell product={simples(combo)} />);

    expect(screen.getByLabelText("Preço de venda")).toBeTruthy();
    expect(texto(container)).toContain("3 por R$ 20,00");
    expect(texto(container)).not.toContain("De");
  });
});
