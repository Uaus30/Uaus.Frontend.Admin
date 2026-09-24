import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
  buildImageProxyUrl: vi.fn((url: string) => url),
}));

const { usePurchaseForm } = await import("../../hooks/usePurchaseForm");
const { PurchaseEditorModal } = await import("../PurchaseEditorModal");

/**
 * O hook de verdade por trás da modal: o que está em teste é o campo
 * controlado reagindo ao estado, e um stub do hook esconderia exatamente isso.
 *
 * A modal abre DURANTE o render, uma vez — num efeito seria o `setState`
 * síncrono que o lint recusa, o mesmo ajuste de `useProductStockEntries`.
 */
function Harness() {
  const form = usePurchaseForm({ onSaved: vi.fn(), suppliers: [], categories: [] });
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    form.openNew();
  }
  return <PurchaseEditorModal form={form} suppliers={[]} departments={[]} />;
}

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe("PurchaseEditorModal — nome do produto", () => {
  afterEach(() => cleanup());

  it("o nome do produto novo é digitado em caixa alta", () => {
    renderModal();
    const input = screen.getByPlaceholderText("COMO VAI SE CHAMAR NO CADASTRO") as HTMLInputElement;

    // Nome de produto é sempre em maiúsculas (regra de 09/09/2026); o backend
    // grava assim de qualquer jeito, e a tela mostra o que vai ser gravado.
    fireEvent.change(input, { target: { value: "Carrinho Caminhonete" } });
    expect(input.value).toBe("CARRINHO CAMINHONETE");
  });
});

describe("PurchaseEditorModal — campo de quantidade", () => {
  afterEach(() => cleanup());

  it("apagar a quantidade deixa o campo vazio, e o que se digita depois não ganha zero à esquerda", () => {
    renderModal();
    const input = screen.getByLabelText("Quantidade comprada") as HTMLInputElement;
    expect(input.value).toBe("1");

    // Backspace até o fim: o estado vira 0, e 0 é "em branco" — não "0".
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    // Digitar "2" e "0" sobre o campo vazio. Sem a regra, o React já teria
    // escrito "0" no campo apagado e o resultado seria "020".
    fireEvent.change(input, { target: { value: `${input.value}2` } });
    fireEvent.change(input, { target: { value: `${input.value}0` } });
    expect(input.value).toBe("20");
  });
});

describe("PurchaseEditorModal — sair sem salvar", () => {
  afterEach(() => cleanup());

  it("fechar com algo digitado pergunta antes de descartar", () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText("COMO VAI SE CHAMAR NO CADASTRO"), {
      target: { value: "CANECA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    // O botão e o clique no fundo saem pelo mesmo `requestClose`. Antes disto,
    // o formulário inteiro ia embora sem aviso.
    expect(screen.getByText("Descartar alterações?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeTruthy();
  });

  it("fechar sem ter digitado nada não pergunta nada", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });
});

describe("PurchaseEditorModal — nota fiscal e leitor de código (24/09/2026)", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("o Nº da Nota Fiscal fica entre a data da compra e a situação, na primeira linha", () => {
    renderModal();
    const rotulos = Array.from(document.querySelectorAll('[role="dialog"] label')).map(
      (rotulo) => rotulo.textContent ?? "",
    );
    const posicao = (texto: string) => rotulos.findIndex((rotulo) => rotulo.startsWith(texto));

    expect(posicao("Data da compra")).toBeGreaterThan(posicao("Fornecedor"));
    expect(posicao("Nº da Nota Fiscal")).toBe(posicao("Data da compra") + 1);
    expect(posicao("Situação")).toBe(posicao("Nº da Nota Fiscal") + 1);
  });

  it("o código de barras fica acima do nome do produto", () => {
    renderModal();
    const codigo = screen.getByLabelText("Código de barras");
    const nome = screen.getByPlaceholderText("COMO VAI SE CHAMAR NO CADASTRO");

    expect(codigo.compareDocumentPosition(nome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("o Enter do fim do bipe não grava a compra, em campo nenhum", () => {
    renderModal();

    // `fireEvent` devolve false quando o evento foi cancelado: sem o cancelamento,
    // o navegador faria o envio implícito do formulário — a compra gravada como
    // produto novo antes de a consulta ao catálogo responder.
    expect(fireEvent.keyDown(screen.getByLabelText("Código de barras"), { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText("Nº da Nota Fiscal"), { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText("Quantidade comprada"), { key: "Enter" })).toBe(false);
    // O resto do teclado segue normal.
    expect(fireEvent.keyDown(screen.getByLabelText("Código de barras"), { key: "7" })).toBe(true);
  });

  it("código que vira código interno mostra o que vai ser gravado", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Código de barras"), { target: { value: "20" } });

    expect(screen.getByText("2000000000206")).toBeTruthy();
  });
});
