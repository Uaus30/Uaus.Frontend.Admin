import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";

/**
 * A busca pela câmera da listagem de produtos (30/09/2026).
 *
 * O diálogo real precisa de câmera; aqui ele é dublado e o teste chama direto o
 * `onDetected` que a tela entrega a ele.
 */

const scanner = vi.hoisted(() => ({
  onDetected: null as null | ((code: string) => unknown),
  canUseCamera: vi.fn(() => true),
}));

vi.mock("@/components/barcode-scanner-dialog", () => ({
  BarcodeScannerDialog: (props: { open: boolean; onDetected: (code: string) => unknown }) => {
    scanner.onDetected = props.open ? props.onDetected : null;
    return null;
  },
}));

vi.mock("@/lib/barcode-scanner", () => ({ canUseCamera: scanner.canUseCamera }));

const { ProductTableFilters } = await import("../ProductTableFilters");

function renderFilters() {
  const props = {
    search: "",
    setSearch: vi.fn(),
    departmentId: 4,
    setDepartmentId: vi.fn(),
    departments: [],
    categoryId: 9,
    setCategoryId: vi.fn(),
    categories: [],
    status: PRODUCT_STATUS.Active,
    setStatus: vi.fn(),
    statusOptions: [],
    onResetFilters: vi.fn(),
  };
  render(<ProductTableFilters {...props} />);
  return props;
}

describe("ProductTableFilters — câmera", () => {
  beforeEach(() => {
    scanner.onDetected = null;
    scanner.canUseCamera.mockReturnValue(true);
  });

  it("o código lido vai para a busca e limpa os outros filtros, inclusive o Ativo", () => {
    // Pedido do dono: com o produto na mão, "nenhum produto" porque ele está
    // inativo ou noutra categoria é resposta errada.
    const props = renderFilters();

    fireEvent.click(screen.getByRole("button", { name: /código de barras, com a câmera/i }));
    scanner.onDetected?.("7891234567895");

    expect(props.setSearch).toHaveBeenCalledWith("7891234567895");
    expect(props.setStatus).toHaveBeenCalledWith(undefined);
    expect(props.setDepartmentId).toHaveBeenCalledWith(undefined);
    expect(props.setCategoryId).toHaveBeenCalledWith(undefined);
  });

  it("sem câmera no navegador, o botão não aparece", () => {
    scanner.canUseCamera.mockReturnValue(false);
    renderFilters();

    expect(screen.queryByRole("button", { name: /código de barras, com a câmera/i })).toBeNull();
  });
});
