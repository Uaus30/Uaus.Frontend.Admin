import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogProductDetail } from "../../types";
import { ProductBreadcrumb } from "../ProductBreadcrumb";

const PRODUCT: CatalogProductDetail = {
  productGroupId: 42,
  name: "Panela de pressão",
  price: 29,
  hasVariations: false,
  departmentId: 2,
  departmentName: "Casa",
  categoryId: 10,
  categoryName: "Cozinha",
  images: [],
  tags: [],
  variations: [],
};

describe("ProductBreadcrumb", () => {
  it("leva aos dois níveis da vitrine filtrada", () => {
    render(<ProductBreadcrumb product={PRODUCT} />);

    expect(screen.getByRole("link", { name: "Casa" }).getAttribute("href")).toBe("/produtos?departamento=2");
    expect(screen.getByRole("link", { name: "Cozinha" }).getAttribute("href")).toBe(
      "/produtos?departamento=2&categoria=10",
    );
  });

  it("deixa o produto como texto, não como link para a própria página", () => {
    render(<ProductBreadcrumb product={PRODUCT} />);

    // Link para onde o visitante já está é ruído para leitor de tela.
    expect(screen.queryByRole("link", { name: "Panela de pressão" })).toBeNull();
    expect(screen.getByText("Panela de pressão").getAttribute("aria-current")).toBe("page");
  });
});
