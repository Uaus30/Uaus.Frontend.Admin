import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleSubmit: vi.fn(),
  validateProductForm: vi.fn(),
  onRequestClose: vi.fn(),
  salesPaused: false,
}));

// O congelamento do estoque é a única consulta da própria tela.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: () => ({ data: { salesPaused: mocks.salesPaused } }),
}));

// As abas e as modais não participam da decisão em teste — o que importa é o
// que o submit do formulário faz depois de gravar.
vi.mock("../ProductGeneralTab", () => ({ ProductGeneralTab: () => <div /> }));
vi.mock("../ProductStockTab", () => ({ ProductStockTab: () => <div /> }));
vi.mock("../ProductEditorDialogs", () => ({ ProductEditorDialogs: () => null }));
vi.mock("../VariationGradesModal", () => ({ VariationGradesModal: () => null }));
vi.mock("../ProductWebImageSearch", () => ({ ProductWebImageSearch: () => null }));
vi.mock("../../editor/ProductOptionalFields", () => ({ ProductOptionalFields: () => <div /> }));
// O histórico consulta o servidor; aqui importa só que a aba o monte.
vi.mock("../../ProductHistoryTimeline", () => ({
  ProductHistoryTimeline: ({ productGroupId }: { productGroupId: number }) => (
    <p>histórico do grupo {productGroupId}</p>
  ),
}));
// A tarja da conferência consulta o servidor; aqui ela não decide nada.
vi.mock("@/features/inventory-count/components/ProductConferenceBanner", () => ({
  ProductConferenceBanner: () => null,
}));

// A validação tem teste próprio; aqui ela só precisa deixar o salvar seguir.
vi.mock("../../../lib/validateProductForm", () => ({
  validateProductForm: mocks.validateProductForm,
}));

const { ProductDetailScreen } = await import("../ProductDetailScreen");

/** O mínimo do `useProductEditor` que a tela lê. */
function fakeEditor(extras: Record<string, unknown> = {}) {
  return {
    isDirty: true,
    form: { productGroupName: "CANECA", hasVariations: false, images: [], notes: "" },
    productEditor: { id: 7, name: "CANECA", barcode: "7891234567890" },
    variationDrafts: [],
    editingGroupId: 7,
    setImages: vi.fn(),
    // A galeria alimenta a pergunta da primeira foto (`useFirstPhotoSitePrompt`).
    galleryImages: [],
    setForm: vi.fn(),
    saving: false,
    handleSubmit: mocks.handleSubmit,
    handleDeleteVariation: vi.fn(),
    selectedGrades: [],
    hasSavedVariations: false,
    applyGrades: vi.fn(),
    purchaseContext: null,
    completePurchaseReceipt: vi.fn(),
    ...extras,
  } as unknown as Parameters<typeof ProductDetailScreen>[0]["editor"];
}

function renderScreen(extras: Record<string, unknown> = {}) {
  return render(<ProductDetailScreen editor={fakeEditor(extras)} onRequestClose={mocks.onRequestClose} />);
}

/** O cadastro NOVO que veio do "Lançar recebimento" de uma compra. */
const vindoDaCompra = {
  editingGroupId: null,
  purchaseContext: { purchaseId: 7, supplierId: 1, quantity: 20, unitCost: 4.5, productName: "SACOLA" },
};

describe("ProductDetailScreen — cadastro da compra com o estoque congelado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateProductForm.mockReturnValue({ errors: {}, firstErrorElementId: null });
    mocks.handleSubmit.mockResolvedValue(true);
  });

  it("não cria o produto: a entrada seria recusada e a compra ficaria sem vínculo", async () => {
    // Depois do encerramento, a compra ainda sem produto mandaria criar o
    // cadastro DE NOVO — dois produtos iguais.
    mocks.salesPaused = true;
    renderScreen(vindoDaCompra);

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.validateProductForm).toHaveBeenCalled());
    expect(mocks.handleSubmit).not.toHaveBeenCalled();
    mocks.salesPaused = false;
  });

  it("com o estoque solto, o cadastro da compra salva normalmente", async () => {
    renderScreen(vindoDaCompra);

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
  });

  it("editar um produto que já existe segue liberado com o estoque congelado", async () => {
    mocks.salesPaused = true;
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    mocks.salesPaused = false;
  });
});

describe("ProductDetailScreen — o que cada botão faz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateProductForm.mockReturnValue({ errors: {}, firstErrorElementId: null });
    mocks.handleSubmit.mockResolvedValue(true);
  });

  it("Salvar grava e CONTINUA na tela (decisão do dono, 23/09/2026)", async () => {
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    // Voltar para a listagem é o botão de voltar, e só ele.
    expect(mocks.onRequestClose).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /dados/i }).getAttribute("aria-selected")).toBe("true");
  });

  it("a aba Histórico mostra o histórico do grupo sem sair do cadastro", async () => {
    renderScreen();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /histórico/i }));

    expect(await screen.findByText("histórico do grupo 7")).toBeTruthy();
  });

  it("cadastro novo não tem histórico ainda: a aba fica travada", () => {
    renderScreen({ editingGroupId: null });

    expect(screen.getByRole("tab", { name: /histórico/i }).hasAttribute("disabled")).toBe(true);
  });

  it("Salvar que o servidor recusou mantém a pessoa na tela", async () => {
    mocks.handleSubmit.mockResolvedValue(false);
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    expect(mocks.onRequestClose).not.toHaveBeenCalled();
  });

  it("Salvar barrado pela validação nem chega a gravar", async () => {
    mocks.validateProductForm.mockReturnValue({ errors: { barcode: true }, firstErrorElementId: null });
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

    expect(mocks.handleSubmit).not.toHaveBeenCalled();
    expect(mocks.onRequestClose).not.toHaveBeenCalled();
  });

  it("Avançar grava e CONTINUA na tela, na aba seguinte", async () => {
    // É a diferença entre os dois botões: terminar o cadastro e continuar nele.
    renderScreen();

    fireEvent.click(screen.getAllByRole("button", { name: /avançar/i })[0]);

    await waitFor(() => expect(mocks.handleSubmit).toHaveBeenCalled());
    expect(mocks.onRequestClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /estoque/i }).getAttribute("aria-selected")).toBe("true"),
    );
  });
});
