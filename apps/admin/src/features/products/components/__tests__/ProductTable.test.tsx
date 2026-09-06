import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import { ProductTable } from "../ProductTable";
import { productDetailPathname } from "../../product-detail-route";
import type { ProductTableRow } from "../../types";

/** Uma linha da listagem, no formato que a tabela consome. */
function row(overrides: Partial<ProductTableRow> = {}): ProductTableRow {
  return {
    id: 987,
    productGroupId: 825,
    name: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
    productName: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
    description: null,
    barcode: "7891234567890",
    price: 9.9,
    costPrice: 5,
    stock: 3,
    minStock: 0,
    status: PRODUCT_STATUS.Active,
    variationCount: 2,
    productGroup: {
      id: 825,
      name: "COPO INFANTIL PLÁSTICO COM ESTAMPA",
      description: null,
      hasVariations: true,
      showOnSite: true,
    },
    category: { id: 5, name: "Utilidades" },
    department: { id: 2, name: "Casa" },
    tags: [],
    images: [],
    ...overrides,
  };
}

function renderTable(overrides: Partial<React.ComponentProps<typeof ProductTable>> = {}) {
  const onEdit = vi.fn();

  render(
    <ProductTable
      isLoading={false}
      search=""
      setSearch={vi.fn()}
      setDepartmentId={vi.fn()}
      departments={[]}
      setCategoryId={vi.fn()}
      categories={[]}
      setStatus={vi.fn()}
      statusOptions={[]}
      onResetFilters={vi.fn()}
      page={1}
      setPage={vi.fn()}
      limit={20}
      setLimit={vi.fn()}
      totalPages={1}
      productPageTotal={1}
      enrichedProducts={[row()]}
      onEdit={onEdit}
      onOpenStock={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );

  return { onEdit };
}

describe("ProductTable — nome do produto", () => {
  afterEach(cleanup);

  it("o nome é um link para o detalhe do GRUPO", () => {
    // Regressão: o nome era um `<td onClick>`. Ctrl+clique, botão do meio e
    // "abrir em nova aba" do menu do navegador não passam por onClick — a
    // listagem prendia a pessoa numa aba só.
    renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });

    // O id da rota é o do GRUPO (825), não o do produto representante (987).
    // `getAttribute`, e não `toHaveAttribute`: este repo não carrega os matchers
    // do jest-dom.
    expect(link.getAttribute("href")).toBe(productDetailPathname(825));
  });

  it("clique simples abre pela SPA, sem deixar o navegador navegar", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    const evento = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(evento);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it("ctrl+clique NÃO abre na SPA — quem abre a nova aba é o navegador", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { ctrlKey: true });

    // Chamar `onEdit` aqui trocaria a tela ANTES de a nova aba abrir, e o
    // `preventDefault` que vem junto cancelaria a aba que a pessoa pediu.
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("cmd+clique também é do navegador", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { metaKey: true });

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("shift+clique abre em janela nova, também sem a SPA no caminho", () => {
    const { onEdit } = renderTable();

    const link = screen.getByRole("link", { name: "COPO INFANTIL PLÁSTICO COM ESTAMPA" });
    fireEvent.click(link, { shiftKey: true });

    expect(onEdit).not.toHaveBeenCalled();
  });
});
