import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { announceReactivatedProducts, dismissReactivatedProducts } from "@/lib/product-reactivation";
import { ProductReactivationDialog } from "../product-reactivation-dialog";

describe("ProductReactivationDialog", () => {
  beforeEach(() => dismissReactivatedProducts());

  it("não aparece enquanto nenhuma entrada reativou produto", () => {
    render(<ProductReactivationDialog />);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("diz qual produto voltou e de onde ele voltou", () => {
    render(<ProductReactivationDialog />);

    act(() =>
      announceReactivatedProducts([
        { productId: 10, productName: "BALDE PRETO 5L [PRETO]", previousStatus: "OutOfStock" },
      ]),
    );

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Produto reativado")).toBeTruthy();
    expect(screen.getByText("BALDE PRETO 5L [PRETO]")).toBeTruthy();
    expect(screen.getByText("era Sem estoque")).toBeTruthy();
  });

  it("no plural quando a entrada reativou mais de um, e fecha no Entendi", () => {
    render(<ProductReactivationDialog />);

    act(() =>
      announceReactivatedProducts([
        { productId: 10, productName: "BALDE [PRETO]", previousStatus: "OutOfStock" },
        { productId: 11, productName: "BALDE [AZUL]", previousStatus: "Inactive" },
      ]),
    );

    expect(screen.getByText("2 produtos reativados")).toBeTruthy();
    expect(screen.getByText("era Inativo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("ProductReactivationDialog — o que muda para quem compra", () => {
  beforeEach(() => dismissReactivatedProducts());

  it("'Sem estoque' já era vendido no PDV: o aviso fala só do site", () => {
    render(<ProductReactivationDialog />);

    act(() =>
      announceReactivatedProducts([
        { productId: 10, productName: "BALDE [PRETO]", previousStatus: "OutOfStock" },
      ]),
    );

    const aviso = screen.getByRole("alertdialog").textContent ?? "";
    expect(aviso).toContain("site");
    expect(aviso).not.toContain("PDV");
  });

  it("Inativo volta também ao PDV", () => {
    render(<ProductReactivationDialog />);

    act(() =>
      announceReactivatedProducts([{ productId: 11, productName: "BACIA 1L", previousStatus: "Inactive" }]),
    );

    expect(screen.getByRole("alertdialog").textContent).toContain("PDV");
  });
});
