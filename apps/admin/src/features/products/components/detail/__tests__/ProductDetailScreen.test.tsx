import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleSubmit: vi.fn(),
  validateProductForm: vi.fn(),
  onRequestClose: vi.fn(),
  onSaved: vi.fn(),
}));

// As abas e as modais não participam da decisão em teste — o que importa é o
// que o submit do formulário faz depois de gravar.
vi.mock("../ProductGeneralTab", () => ({ ProductGeneralTab: () => <div /> }));
vi.mock("../ProductStockTab", () => ({ ProductStockTab: () => <div /> }));
vi.mock("../ProductEditorDialogs", () => ({ ProductEditorDialogs: () => null }));
vi.mock("../VariationGradesModal", () => ({ VariationGradesModal: () => null }));
vi.mock("../ProductWebImageSearch", () => ({ ProductWebImageSearch: () => null }));
vi.mock("../../editor/ProductOptionalFields", () => ({ ProductOptionalFields: () => <div /> }));

// A validação tem teste próprio; aqui ela só precisa deixar o salvar seguir.
vi.mock("../../../lib/validateProductForm", () => ({
  validateProductForm: mocks.validateProductForm,
}));

const { ProductDetailScreen } = await import("../ProductDetailScreen");

/** O mínimo do `useProductEditor` que a tela lê. */
function fakeEditor() {
  return {
    isDirty: true,
    form: { productGroupName: "CANECA", hasVariations: false, images: [] },
    productEditor: { id: 7, name: "CANECA", barcode: "7891234567890" },
    variationDrafts: [],
    activeVariation: null,
    editingGroupId: 7,
    setImages: vi.fn(),
    saving: false,
    handleSubmit: mocks.handleSubmit,
    handleDeleteVariation: vi.fn(),
    selectedGrades: [],
    hasSavedVariations: false,
    applyGrades: vi.fn(),
    purchaseContext: null,
    completePurchaseReceipt: vi.fn(),
  } as unknown as Parameters<typeof ProductDetailScreen>[0]["editor"];
}

function renderScreen() {
  return render(
    <ProductDetailScreen
      editor={fakeEditor()}
      onRequestClose={mocks.onRequestClose}
      onSaved={mocks.onSaved}
    />,
  );
}

describe("ProductDetailScreen — o que cada botão faz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateProductForm.mockReturnValue({ errors: {}, firstErrorElementId: null });
    mocks.handleSubmit.mockResolvedValue(true);
  });

  it("Salvar grava e volta para a listagem", async () => {
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    await waitFor(() => expect(mocks.onSaved).toHaveBeenCalled());
    // NÃO pelo caminho de "pedir para fechar": ali a tela pergunta se quer
    // descartar, e logo depois de gravar o formulário ainda está marcado como
    // alterado — perguntaria sobre o que acabou de ser salvo.
    expect(mocks.onRequestClose).not.toHaveBeenCalled();
  });

  it("Salvar que o servidor recusou mantém a pessoa na tela", async () => {
    mocks.handleSubmit.mockResolvedValue(false);
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    expect(mocks.onSaved).not.toHaveBeenCalled();
  });

  it("Salvar barrado pela validação nem chega a gravar", async () => {
    mocks.validateProductForm.mockReturnValue({ errors: { barcode: true }, firstErrorElementId: null });
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    expect(mocks.handleSubmit).not.toHaveBeenCalled();
    expect(mocks.onSaved).not.toHaveBeenCalled();
  });

  it("Avançar grava e CONTINUA na tela, na aba seguinte", async () => {
    // É a diferença entre os dois botões: terminar o cadastro e continuar nele.
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /avançar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    expect(mocks.onSaved).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /estoque/i }).getAttribute("aria-selected")).toBe("true"),
    );
  });
});
