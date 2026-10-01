import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductLabelDraftDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  getProductLabelDraft: vi.fn(),
  saveProductLabelDraft: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getProductLabelDraft: mocks.getProductLabelDraft,
  saveProductLabelDraft: mocks.saveProductLabelDraft,
}));

const { useLabelDraft } = await import("../useLabelDraft");

const PHONE_DRAFT: ProductLabelDraftDto = {
  description: "Corredor 3",
  items: [{ productId: 5, labelType: 1, quantity: 1, catalogName: "CANECA", catalogPrice: 12.5 }],
};

const PAYLOAD = {
  description: null,
  items: [{ productId: 5, labelType: 1, quantity: 1, productName: null, price: null }],
};

async function renderDraft() {
  const onLoaded = vi.fn();
  const rendered = renderHook(() => useLabelDraft(onLoaded));
  await waitFor(() => expect(rendered.result.current.loadState).toBe("ready"));
  return { ...rendered, onLoaded };
}

/** A pessoa volta para a janela (computador) ou para o app (celular). */
function returnToScreen() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

describe("useLabelDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProductLabelDraft.mockResolvedValue(null);
    mocks.saveProductLabelDraft.mockResolvedValue(undefined);
  });

  it("falha ao ler deixa a lista travada, com nova tentativa", async () => {
    mocks.getProductLabelDraft.mockRejectedValueOnce(new Error("502"));
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useLabelDraft(onLoaded));

    await waitFor(() => expect(result.current.loadState).toBe("failed"));
    // Sem leitura, gravar sobrescreveria o rascunho do servidor.
    act(() => result.current.schedule(PAYLOAD));
    await act(async () => result.current.flush());
    expect(mocks.saveProductLabelDraft).not.toHaveBeenCalled();

    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(onLoaded).toHaveBeenCalledWith({ description: "", items: [] });
  });

  it("ao voltar para a tela, traz o que foi adicionado no outro aparelho", async () => {
    const { onLoaded } = await renderDraft();
    mocks.getProductLabelDraft.mockResolvedValue(PHONE_DRAFT);

    returnToScreen();

    await waitFor(() =>
      expect(onLoaded).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Corredor 3" })),
    );
  });

  it("não troca a lista da tela quando há alteração local ainda não salva", async () => {
    const { result, onLoaded } = await renderDraft();
    mocks.getProductLabelDraft.mockResolvedValue(PHONE_DRAFT);

    act(() => result.current.schedule(PAYLOAD));
    returnToScreen();

    await act(async () => result.current.flush());
    expect(onLoaded).toHaveBeenCalledTimes(1); // só a abertura
  });

  it("depois de imprimir aqui, o rascunho ausente no servidor não esvazia a tela", async () => {
    const { result, onLoaded } = await renderDraft();

    act(() => result.current.markPrinted(result.current.beginPrint()));
    // A caixa de impressão tira e devolve o foco da janela.
    returnToScreen();
    await waitFor(() => expect(mocks.getProductLabelDraft).toHaveBeenCalledTimes(2));

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("alteração feita durante a impressão continua agendada", async () => {
    const { result } = await renderDraft();

    const changeAtPrint = result.current.beginPrint();
    act(() => result.current.schedule(PAYLOAD));
    act(() => result.current.markPrinted(changeAtPrint));
    await act(async () => result.current.flush());

    expect(mocks.saveProductLabelDraft).toHaveBeenCalledWith(PAYLOAD);
  });

  it("releitura que chega depois de uma alteração já salva não apaga a alteração da tela", async () => {
    const { result, onLoaded } = await renderDraft();
    let answerRefresh: (dto: ProductLabelDraftDto | null) => void = () => {};
    mocks.getProductLabelDraft.mockReturnValueOnce(
      new Promise<ProductLabelDraftDto | null>((resolve) => {
        answerRefresh = resolve;
      }),
    );

    // Volta para a tela: a releitura sai e fica lenta no 4G.
    returnToScreen();
    // Nesse meio-tempo a pessoa bipa um produto, e a gravação TERMINA.
    act(() => result.current.schedule(PAYLOAD));
    await act(async () => result.current.flush());
    expect(result.current.saveState).toBe("saved");

    // Só agora chega a resposta, com a lista de ANTES da alteração.
    await act(async () => answerRefresh(null));

    expect(onLoaded).toHaveBeenCalledTimes(1); // só a abertura
  });

  it("as gravações saem em fila, e a falha volta para a fila", async () => {
    const { result } = await renderDraft();
    mocks.saveProductLabelDraft.mockRejectedValueOnce(new Error("502"));

    act(() => result.current.schedule(PAYLOAD));
    await act(async () => result.current.flush());
    expect(result.current.saveState).toBe("error");

    // "Tentar de novo" manda a mesma lista.
    await act(async () => result.current.flush());
    expect(mocks.saveProductLabelDraft).toHaveBeenCalledTimes(2);
    expect(mocks.saveProductLabelDraft).toHaveBeenLastCalledWith(PAYLOAD);
    expect(result.current.saveState).toBe("saved");
  });

  it("esconder a página grava na hora o que estava esperando", async () => {
    const { result } = await renderDraft();

    act(() => result.current.schedule(PAYLOAD));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    await waitFor(() => expect(mocks.saveProductLabelDraft).toHaveBeenCalledWith(PAYLOAD), { timeout: 300 });
  });
});
