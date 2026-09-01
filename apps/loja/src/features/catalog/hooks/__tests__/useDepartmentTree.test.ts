import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontDepartmentDto } from "@workspace/api-client-react";
import type { CatalogFilters } from "@/routes";
import { useDepartmentTree } from "../useDepartmentTree";

const mocks = vi.hoisted(() => ({
  useGetStorefrontDepartments: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorefrontDepartments: mocks.useGetStorefrontDepartments,
}));

const CASA: StorefrontDepartmentDto = {
  id: 2,
  name: "Casa",
  productCount: 3,
  categories: [
    { id: 10, name: "Cozinha", productCount: 2 },
    { id: 11, name: "Banho", productCount: 1 },
  ],
};

/**
 * O hook lê o endpoint duas vezes: com a busca (a lista que a tela mostra) e
 * sem ela (o retrato do catálogo, de onde saem nomes e existência). O dublê
 * responde por argumento para os dois papéis não se confundirem.
 */
function givenTree(filtered: StorefrontDepartmentDto[], all: StorefrontDepartmentDto[] = filtered) {
  mocks.useGetStorefrontDepartments.mockImplementation((search?: string) => ({
    data: search ? filtered : all,
    isLoading: false,
    isError: false,
  }));
}

function renderTree(filters: CatalogFilters) {
  return renderHook((props: CatalogFilters) => useDepartmentTree(props), { initialProps: filters });
}

describe("useDepartmentTree", () => {
  afterEach(() => vi.clearAllMocks());

  it("resolve o departamento e a categoria escolhidos", () => {
    givenTree([CASA]);

    const { result } = renderTree({ departmentId: 2, categoryId: 10 });

    expect(result.current.selectedDepartmentName).toBe("Casa");
    expect(result.current.selectedCategoryName).toBe("Cozinha");
    expect(result.current.totalCount).toBe(3);
    expect(result.current.isUnknownFilter).toBe(false);
  });

  it("acusa filtro que não existe no catálogo", () => {
    givenTree([CASA]);

    const { result } = renderTree({ categoryId: 999 });

    // Link velho ou cadastro removido: a tela oferece o caminho de volta em vez
    // de uma grade vazia sem explicação.
    expect(result.current.isUnknownFilter).toBe(true);
  });

  it("não acusa filtro inexistente quando foi a busca que estreitou a lista", () => {
    // A categoria 10 sumiu da lista filtrada, mas continua no catálogo: isso é
    // "nada casou", que é outra mensagem — e outro conserto — que "esse filtro
    // saiu do site".
    givenTree([], [CASA]);

    const { result } = renderTree({ departmentId: 2, categoryId: 10, search: "xyz" });

    expect(result.current.isUnknownFilter).toBe(false);
  });

  it("mantém o nome do filtro que a busca tirou da lista", () => {
    givenTree([], [CASA]);

    const { result } = renderTree({ departmentId: 2, categoryId: 10, search: "xyz" });

    // Sem isso o chip apareceria sem rótulo justamente quando a vitrine ficou
    // vazia — o momento em que o visitante mais precisa saber o que está ligado.
    expect(result.current.selectedDepartmentName).toBe("Casa");
    expect(result.current.selectedCategoryName).toBe("Cozinha");
  });

  it("lê o endpoint com a busca e também sem ela", () => {
    givenTree([CASA]);

    renderTree({ search: "panela" });

    expect(mocks.useGetStorefrontDepartments).toHaveBeenCalledWith("panela");
    expect(mocks.useGetStorefrontDepartments).toHaveBeenCalledWith(undefined);
  });
});
