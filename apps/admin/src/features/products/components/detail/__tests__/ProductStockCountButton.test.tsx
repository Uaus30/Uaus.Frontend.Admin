import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
}));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductById: mocks.getProductById,
}));

const { ProductStockCountButton } = await import("../ProductStockCountButton");

function renderButton(
  props: { autoOpen?: boolean; onAutoOpened?: () => void } = {},
  queryClient?: QueryClient,
) {
  const client =
    queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProductStockCountButton
        productId={20}
        productName="BALDE [12L, ORIGINAL]"
        barcode="7891234567890"
        suppliers={[]}
        {...props}
      />
    </QueryClientProvider>,
  );
}

/** O campo do número contado. Por id: o título da modal tem o mesmo texto do rótulo. */
function campoDaContagem() {
  return document.getElementById("contagem-fisica") as HTMLInputElement | null;
}

describe("ProductStockCountButton — o Corrigir estoque da aba Estoque", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("abre a contagem da variação da aba, com o saldo lido do servidor", async () => {
    mocks.getProductById.mockResolvedValue({ id: 20, stock: 4 });
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /corrigir estoque/i }));

    await waitFor(() => expect(campoDaContagem()?.disabled).toBe(false));
    expect(screen.getByText("BALDE [12L, ORIGINAL]")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("o saldo que estava no cache não vale: a contagem espera a leitura nova", async () => {
    // A aba leu 5; o PDV vendeu 2 com a tela aberta. Contar com o 5 diria
    // "falta" e o servidor gravaria outra coisa.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["product-for-entry", 20], { id: 20, stock: 5 });
    let responder: (value: unknown) => void = () => {};
    mocks.getProductById.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    renderButton({}, client);

    fireEvent.click(screen.getByRole("button", { name: /corrigir estoque/i }));

    await waitFor(() => expect(campoDaContagem()).not.toBeNull());
    expect(campoDaContagem()?.disabled).toBe(true);
    responder({ id: 20, stock: 3 });
    await waitFor(() => expect(campoDaContagem()?.disabled).toBe(false));
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("o atalho do PDV abre sozinho, uma vez, e avisa quem pediu", async () => {
    mocks.getProductById.mockResolvedValue({ id: 20, stock: 0 });
    const onAutoOpened = vi.fn();
    renderButton({ autoOpen: true, onAutoOpened });

    await waitFor(() => expect(campoDaContagem()?.disabled).toBe(false));
    expect(onAutoOpened).toHaveBeenCalledTimes(1);
  });

  it("leitura que falhou mostra a mensagem e o Tentar de novo relê", async () => {
    mocks.getProductById.mockRejectedValueOnce(new Error("rede fora"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /corrigir estoque/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(campoDaContagem()?.disabled).toBe(true);

    mocks.getProductById.mockResolvedValue({ id: 20, stock: 6 });
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    await waitFor(() => expect(campoDaContagem()?.disabled).toBe(false));
    expect(screen.getByText("6")).toBeTruthy();
  });
});
