import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProductDeepLink } from "../useProductDeepLink";
import type { EnrichedProduct } from "@/services/mappers";

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

/** Linha da tabela: só o que o hook usa para escolher o alvo. */
function linha(id: number, name: string): EnrichedProduct {
  return { id, name } as EnrichedProduct;
}

/** Coloca a aba no endereço que o PDV abriria. */
function abertoEm(query: string) {
  window.history.replaceState(null, "", `/produtos${query}`);
}

describe("useProductDeepLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    abertoEm("");
  });

  it("abre a modal do produto pedido na URL", async () => {
    // É o fluxo inteiro do balcão: o operador vê preço errado na hora de vender,
    // clica no lápis e espera cair NA EDIÇÃO daquele produto.
    abertoEm("?busca=Caf%C3%A9+Torrado&editar=42");
    const openModal = vi.fn();
    const produtos = [linha(7, "Sacola"), linha(42, "Café Torrado")];

    renderHook(() => useProductDeepLink({ isLoading: false, enrichedProducts: produtos, openModal }));

    await waitFor(() => expect(openModal).toHaveBeenCalledWith(produtos[1]));
  });

  it("não faz nada sem o parâmetro", async () => {
    abertoEm("?busca=Caf%C3%A9");
    const openModal = vi.fn();

    renderHook(() =>
      useProductDeepLink({ isLoading: false, enrichedProducts: [linha(42, "Café")], openModal }),
    );

    await waitFor(() => expect(openModal).not.toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("espera a listagem carregar antes de decidir", async () => {
    // Decidir com a lista ainda vazia daria "produto não encontrado" em todo
    // link que funciona — a listagem carrega os atributos em cascata.
    abertoEm("?editar=42");
    const openModal = vi.fn();
    const { rerender } = renderHook(
      ({ isLoading, produtos }: { isLoading: boolean; produtos: EnrichedProduct[] }) =>
        useProductDeepLink({ isLoading, enrichedProducts: produtos, openModal }),
      { initialProps: { isLoading: true, produtos: [] as EnrichedProduct[] } },
    );

    expect(openModal).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();

    const produtos = [linha(42, "Café Torrado")];
    rerender({ isLoading: false, produtos });

    await waitFor(() => expect(openModal).toHaveBeenCalledWith(produtos[0]));
  });

  it("abre a linha única quando o id não bate — o produto é uma variação", async () => {
    // A tabela mostra um produto REPRESENTANTE por grupo. Se o produto pedido é
    // uma variação, ele não é o representante e o id não aparece na lista; o
    // grupo é o mesmo, e a modal edita o grupo inteiro.
    abertoEm("?busca=Camiseta&editar=99");
    const openModal = vi.fn();
    const produtos = [linha(50, "Camiseta P")];

    renderHook(() => useProductDeepLink({ isLoading: false, enrichedProducts: produtos, openModal }));

    await waitFor(() => expect(openModal).toHaveBeenCalledWith(produtos[0]));
  });

  it("avisa quando o filtro não trouxe o produto", async () => {
    // Silenciar seria o pior desfecho: a aba abre numa lista e nada explica por
    // que a modal não veio.
    abertoEm("?busca=Inexistente&editar=42");
    const openModal = vi.fn();

    renderHook(() => useProductDeepLink({ isLoading: false, enrichedProducts: [], openModal }));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(openModal).not.toHaveBeenCalled();
    expect(mockToast.mock.calls[0][0]).toMatchObject({ variant: "destructive" });
  });

  it("tira o editar da URL, preservando a busca", async () => {
    // O link é instrução de uma vez só: sem limpar, fechar a modal e recarregar
    // abriria tudo de novo.
    abertoEm("?busca=Caf%C3%A9&editar=42");
    const openModal = vi.fn();

    renderHook(() =>
      useProductDeepLink({
        isLoading: false,
        enrichedProducts: [linha(42, "Café")],
        openModal,
      }),
    );

    await waitFor(() => expect(openModal).toHaveBeenCalled());
    expect(window.location.search).toBe("?busca=Caf%C3%A9");
  });

  it("abre uma vez só, mesmo com a lista se atualizando", async () => {
    abertoEm("?editar=42");
    const openModal = vi.fn();
    const produtos = [linha(42, "Café Torrado")];
    const { rerender } = renderHook(
      ({ p }: { p: EnrichedProduct[] }) =>
        useProductDeepLink({ isLoading: false, enrichedProducts: p, openModal }),
      { initialProps: { p: produtos } },
    );

    await waitFor(() => expect(openModal).toHaveBeenCalledTimes(1));

    rerender({ p: [...produtos] });
    rerender({ p: [linha(42, "Café Torrado 500g")] });

    expect(openModal).toHaveBeenCalledTimes(1);
  });
});
