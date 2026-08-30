import React from "react";
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CategoryDto, DepartmentDto, ProductDto, ProductGroupDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ getProductsPage: vi.fn() }));

vi.mock("@/services/products.service", () => ({
  getProductsPage: mocks.getProductsPage,
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const { useBarcodeLookup } = await import("../useBarcodeLookup");

const EAN = "7891234567895";

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 42,
    productGroupId: 5,
    name: "COPO TÉRMICO 500ML",
    description: null,
    barcode: EAN,
    price: 39.9,
    costPrice: 18.4,
    stock: 7,
    minStock: 0,
    status: 2,
    canDelete: true,
    createdAt: "2026-08-01T00:00:00",
    updatedAt: null,
    ...overrides,
  };
}

const CATALOGOS = {
  productGroups: [
    { id: 5, name: "COPO TÉRMICO", description: null, categoryId: 9, hasVariations: false },
  ] as unknown as ProductGroupDto[],
  categories: [{ id: 9, name: "Copos", departmentId: 3 }] as unknown as CategoryDto[],
  departments: [{ id: 3, name: "Cozinha" }] as unknown as DepartmentDto[],
  tags: [],
  productTags: [],
  images: [],
  productImages: [],
};

function renderLookup(podeCarregar = true) {
  const carregarProduto = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(
    ({ pode }: { pode: boolean }) => useBarcodeLookup({ ...CATALOGOS, podeCarregar: pode, carregarProduto }),
    { wrapper, initialProps: { pode: podeCarregar } },
  );

  return { ...view, carregarProduto };
}

/** Digita o termo e deixa o tempo do debounce passar. */
async function digitar(result: { current: { lookupBarcode: (v: string) => void } }, termo: string) {
  act(() => result.current.lookupBarcode(termo));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("useBarcodeLookup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.getProductsPage.mockResolvedValue({ data: [produto()], total: 1, totalPages: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("carrega o produto existente e avisa em laranja", async () => {
    const { result, carregarProduto } = renderLookup();

    await digitar(result, EAN);

    expect(mocks.getProductsPage).toHaveBeenCalledWith({ search: EAN, limit: 20 });
    expect(carregarProduto).toHaveBeenCalledTimes(1);

    const linha = carregarProduto.mock.calls[0][0];
    expect(linha).toMatchObject({
      id: 42,
      barcode: EAN,
      productGroup: { id: 5, name: "COPO TÉRMICO" },
      category: { id: 9 },
      department: { id: 3 },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("consulta uma vez só quando o leitor de código digita caractere a caractere", async () => {
    // Um EAN-13 bipado chega como treze eventos em milissegundos. Sem a espera
    // seriam treze consultas, doze delas por prefixos que não são código de
    // ninguém.
    const { result } = renderLookup();

    act(() => {
      for (let i = 8; i <= EAN.length; i++) result.current.lookupBarcode(EAN.slice(0, i));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mocks.getProductsPage).toHaveBeenCalledTimes(1);
    expect(mocks.getProductsPage).toHaveBeenCalledWith({ search: EAN, limit: 20 });
  });

  it("não consulta o que não é código de barras", async () => {
    // O backend decide entre buscar por código e por NOME olhando se o termo é
    // todo numérico. Mandar texto aqui carregaria um produto que ninguém pediu.
    const { result } = renderLookup();

    await digitar(result, "COPO TÉRMICO");
    await digitar(result, "789123");
    await digitar(result, "");

    expect(mocks.getProductsPage).not.toHaveBeenCalled();
  });

  it("exige código IDÊNTICO, não parecido", async () => {
    // O filtro do backend é `Contains`: buscar "78912345678" traz também o
    // EAN-13 que o contém. Duplicata é igualdade, não semelhança.
    mocks.getProductsPage.mockResolvedValue({ data: [produto()], total: 1, totalPages: 1 });
    const { result, carregarProduto } = renderLookup();

    await digitar(result, "789123456789");

    expect(mocks.getProductsPage).toHaveBeenCalled();
    expect(carregarProduto).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("não mexe na tela quando o cadastro não é novo", async () => {
    // Editando, o operador já escolheu o produto: trocá-lo no meio da digitação
    // jogaria fora o que ele preencheu.
    const { result, carregarProduto } = renderLookup(false);

    await digitar(result, EAN);

    expect(mocks.getProductsPage).not.toHaveBeenCalled();
    expect(carregarProduto).not.toHaveBeenCalled();
  });

  it("desiste se a tela deixar de aceitar produto durante a consulta", async () => {
    // Fechar a tela logo depois de bipar não pode fazê-la reabrir sozinha meio
    // segundo depois.
    let liberar: (valor: unknown) => void = () => {};
    mocks.getProductsPage.mockReturnValue(
      new Promise((resolve) => {
        liberar = resolve;
      }),
    );

    const { result, rerender, carregarProduto } = renderLookup();

    act(() => result.current.lookupBarcode(EAN));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    rerender({ pode: false });
    await act(async () => {
      liberar({ data: [produto()], total: 1, totalPages: 1 });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(carregarProduto).not.toHaveBeenCalled();
  });

  it("não deixa erro de rede virar aviso na tela de quem está digitando", async () => {
    // A consulta é conveniência: o backend continua recusando código repetido
    // ao salvar.
    mocks.getProductsPage.mockRejectedValue(new Error("500"));
    const { result, carregarProduto } = renderLookup();

    await digitar(result, EAN);

    expect(carregarProduto).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
