import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPublicImageUrl, type ProductDto } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { ProductSearchPicker } from "../product-search-picker";

const mocks = vi.hoisted(() => ({
  getProductsPage: vi.fn(),
  useGetCurrentPromotions: vi.fn(),
}));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductsPage: mocks.getProductsPage,
}));

// Só o que fala com a rede é dublado; `buildPublicImageUrl` e os enums são os reais.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCurrentPromotions: mocks.useGetCurrentPromotions,
}));

function produto(overrides: Partial<ProductDto> & Pick<ProductDto, "id" | "name">): ProductDto {
  return {
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    productGroupId: overrides.id,
    description: null,
    barcode: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    minStock: 0,
    status: "Active",
    canDelete: false,
    displayName: overrides.name,
    variationValues: [],
    ...overrides,
  };
}

/** Os dois do print do dono: mesmo começo de nome, só a foto e o preço separam. */
const COM_FOTO = produto({
  id: 1,
  productGroupId: 41,
  name: "CABO CARREGADOR IPHONE 1M [LEHMOX]",
  barcode: "6920231018121",
  price: 19.9,
  stock: 9,
  imageUrl: "/uploads/cabo-lehmox.jpg",
});
const SEM_FOTO = produto({
  id: 2,
  name: "CABO CARREGADOR IPHONE 1M [ORIGINAL]",
  barcode: "7908657605483",
  price: 49.9,
  stock: 5,
});

function renderNoDialogo(onSelect = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Registrar compra</DialogTitle>
          <DialogDescription>Compra de teste</DialogDescription>
          <ProductSearchPicker onSelect={onSelect} selectedIds={[]} />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>,
  );
  return { onSelect };
}

/** Abre a busca e devolve a linha do produto com foto, já carregada. */
async function abrirBusca() {
  fireEvent.click(screen.getByRole("combobox"));
  const nome = await screen.findByText(COM_FOTO.name);
  return linhaDe(nome);
}

function linhaDe(elemento: HTMLElement) {
  const linha = elemento.closest<HTMLElement>("[cmdk-item]");
  if (!linha) throw new Error("linha da busca não encontrada");
  return linha;
}

describe("ProductSearchPicker", () => {
  beforeAll(() => {
    // O jsdom não tem nenhum dos dois; o Popper do Radix mede o gatilho e o cmdk
    // rola o item destacado para a vista.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    mocks.getProductsPage.mockResolvedValue({ data: [COM_FOTO, SEM_FOTO] });
    mocks.useGetCurrentPromotions.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("a roda do mouse rola a lista mesmo com a busca dentro de um diálogo", async () => {
    renderNoDialogo();
    const linha = await abrirBusca();

    // O jsdom não faz layout: a lista ganha à mão o que rolar, senão a trava de
    // rolagem não teria o que liberar e cancelaria por falta de espaço.
    const lista = document.querySelector<HTMLElement>("[cmdk-list]");
    if (!lista) throw new Error("lista da busca não encontrada");
    lista.style.overflowY = "auto";
    Object.defineProperty(lista, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(lista, "clientHeight", { configurable: true, value: 360 });

    const roda = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    linha.dispatchEvent(roda);

    // Cancelado é a roda morta do relato: a trava do diálogo engolia o evento
    // porque a lista mora num portal fora da caixa dele.
    expect(roda.defaultPrevented).toBe(false);
  });

  it("mostra a foto, o código, o estoque e o preço de cada produto", async () => {
    renderNoDialogo();
    const linha = await abrirBusca();

    expect(linha.querySelector("img")?.getAttribute("src")).toBe(
      buildPublicImageUrl("/uploads/cabo-lehmox.jpg"),
    );
    expect(linha.textContent).toContain("6920231018121 · Estoque: 9");
    expect(linha.textContent).toContain(formatCurrency(19.9));

    // Sem foto, o quadro vazio no lugar — a coluna de nomes não desalinha.
    const semFoto = linhaDe(screen.getByText(SEM_FOTO.name));
    expect(semFoto.querySelector("img")).toBeNull();
    expect(semFoto.textContent).toContain(formatCurrency(49.9));
  });

  it("o preço sai com a promoção que vale agora, pelo grupo do produto", async () => {
    mocks.useGetCurrentPromotions.mockReturnValue({
      data: [
        {
          id: 7,
          productGroupId: 41,
          productGroupIds: [41],
          type: "Flash",
          discountType: "FinalPrice",
          discountValue: 9.9,
          validFrom: "2000-01-01T00:00:00",
          validUntil: "2999-12-31T23:59:59",
        },
      ],
    });
    renderNoDialogo();
    const linha = await abrirBusca();

    expect(linha.textContent).toContain(formatCurrency(9.9));
    expect(linha.textContent).toContain(formatCurrency(19.9));
    // O grupo 41 é só o do produto com foto; o outro segue no preço de tabela.
    const outro = linhaDe(screen.getByText(SEM_FOTO.name));
    expect(outro.textContent).not.toContain(formatCurrency(9.9));
  });

  it("escolher a linha entrega o produto com a foto e fecha a busca", async () => {
    const { onSelect } = renderNoDialogo();
    const linha = await abrirBusca();

    fireEvent.click(linha);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, productGroupId: 41, imageUrl: "/uploads/cabo-lehmox.jpg" }),
    );
    expect(screen.queryByText(COM_FOTO.name)).toBeNull();
  });

  it("a compra busca todos; a Nova venda pede ao servidor sem o inativo", async () => {
    // Inativo não se vende pelo painel (decisão do dono, 06/10/2026), mas a compra
    // continua enxergando — repor estoque de um inativo é como ele volta.
    renderNoDialogo();
    await abrirBusca();
    expect(mocks.getProductsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeInactive: false }),
    );
    cleanup();

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProductSearchPicker onSelect={vi.fn()} selectedIds={[]} excludeInactive />
      </QueryClientProvider>,
    );
    await abrirBusca();
    expect(mocks.getProductsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeInactive: true }),
    );
  });
});
