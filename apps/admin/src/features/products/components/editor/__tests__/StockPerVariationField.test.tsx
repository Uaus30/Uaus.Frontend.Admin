import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockPerVariationField } from "../StockPerVariationField";
import type { ProductGroupForm } from "../../../types";

const form: ProductGroupForm = {
  departmentId: "2",
  categoryId: "5",
  productGroupName: "SACOLA ESTAMPADA",
  description: "",
  hasVariations: true,
  isPublic: true,
  notes: "",
};

describe("StockPerVariationField", () => {
  afterEach(cleanup);

  it("não aparece no produto simples: ele é sempre a própria unidade do controle", () => {
    render(<StockPerVariationField form={{ ...form, hasVariations: false }} setForm={vi.fn()} />);

    expect(screen.queryByText("Controlar estoque por variação")).toBeNull();
  });

  it("nasce desligado, explica o total e liga ao clicar", () => {
    const setForm = vi.fn();
    render(<StockPerVariationField form={form} setForm={setForm} />);

    expect(screen.getByText(/olham o total do produto/)).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Controlar estoque por variação" }));

    const atualizar = setForm.mock.calls[0][0] as (atual: ProductGroupForm) => ProductGroupForm;
    expect(atualizar(form).stockPerVariation).toBe(true);
  });

  it("ligado, diz que cada variação é julgada sozinha", () => {
    render(<StockPerVariationField form={{ ...form, stockPerVariation: true }} setForm={vi.fn()} />);

    expect(screen.getByText(/julgam cada variação sozinha/)).toBeTruthy();
  });
});
