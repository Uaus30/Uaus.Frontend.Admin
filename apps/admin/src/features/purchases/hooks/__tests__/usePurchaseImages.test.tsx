import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseForm } from "../../types";

const mocks = vi.hoisted(() => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
  optimizeImage: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: mocks.createImageFromFile,
  downloadWebImageAsFile: mocks.downloadWebImageAsFile,
}));

vi.mock("@/lib/imageOptimizer", () => ({ optimizeImage: mocks.optimizeImage }));

const { usePurchaseImages, isHttpUrl } = await import("../usePurchaseImages");

/** Um arquivo de imagem qualquer, do tamanho que a compressão encolheria. */
function imageFile(name = "foto.png"): File {
  return new File(["conteudo"], name, { type: "image/png" });
}

/** O `setForm` de verdade, para conferir o que entrou na lista de fotos. */
function formSpy() {
  let form: PurchaseForm = { productName: "CANECA", images: [] } as unknown as PurchaseForm;
  const setForm = (update: React.SetStateAction<PurchaseForm>) => {
    form = typeof update === "function" ? update(form) : update;
  };
  return { setForm, current: () => form };
}

describe("isHttpUrl", () => {
  it("aceita só http e https", () => {
    expect(isHttpUrl("https://cdn.loja/foto.jpg")).toBe(true);
    expect(isHttpUrl("  http://cdn.loja/foto.jpg  ")).toBe(true);
    // O que não passa aqui não chega ao proxy do backend.
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isHttpUrl("cdn.loja/foto.jpg")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("usePurchaseImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.optimizeImage.mockImplementation(async (file: File) => ({
      file,
      originalSize: 3_000_000,
      optimizedSize: 200_000,
      optimized: true,
    }));
    mocks.createImageFromFile.mockResolvedValue({ id: 42, url: "produtos/foto.jpg", name: "CANECA" });
    mocks.downloadWebImageAsFile.mockResolvedValue(imageFile("baixada.jpg"));
  });

  it("a URL passa pelo proxy e pela compressão antes do upload", async () => {
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    let aceita: boolean | undefined;
    await act(async () => {
      aceita = await result.current.addImageFromUrl("https://cdn.loja/foto.jpg");
    });

    expect(aceita).toBe(true);
    expect(mocks.downloadWebImageAsFile).toHaveBeenCalledWith("https://cdn.loja/foto.jpg", "CANECA");
    // O tratamento de tamanho é o ponto: nenhuma foto sobe sem passar por aqui.
    expect(mocks.optimizeImage).toHaveBeenCalled();
    expect(mocks.createImageFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: "CANECA", type: 3 }),
    );
    await waitFor(() => expect(spy.current().images).toEqual([expect.objectContaining({ imageId: 42 })]));
  });

  it("URL que não é http(s) nem chega ao proxy", async () => {
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    let aceita: boolean | undefined;
    await act(async () => {
      aceita = await result.current.addImageFromUrl("javascript:alert(1)");
    });

    expect(aceita).toBe(false);
    expect(mocks.downloadWebImageAsFile).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("Ctrl+V com imagem na área de transferência envia o arquivo colado", async () => {
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    const file = imageFile();
    const event = pasteEvent({ items: [{ type: "image/png", getAsFile: () => file }] });

    await act(async () => {
      await result.current.handlePaste(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mocks.optimizeImage).toHaveBeenCalled();
    expect(mocks.createImageFromFile).toHaveBeenCalled();
  });

  it("Ctrl+V de uma URL de imagem, que é o que o botão direito do navegador copia", async () => {
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    await act(async () => {
      await result.current.handlePaste(pasteEvent({ items: [], text: "https://cdn.loja/foto.jpg" }));
    });

    expect(mocks.downloadWebImageAsFile).toHaveBeenCalledWith("https://cdn.loja/foto.jpg", "CANECA");
  });

  it("colar dentro de um campo de texto continua colando texto", async () => {
    // O "Link da compra" é justamente uma URL: sequestrar a colagem ali
    // impediria de preencher o campo.
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    const input = document.createElement("input");
    document.body.appendChild(input);

    await act(async () => {
      await result.current.handlePaste(
        pasteEvent({ items: [], text: "https://cdn.loja/foto.jpg", target: input }),
      );
    });

    expect(mocks.downloadWebImageAsFile).not.toHaveBeenCalled();
    input.remove();
  });

  it("colagem sem imagem nem URL é ignorada", async () => {
    const spy = formSpy();
    const { result } = renderHook(() => usePurchaseImages({ productName: "CANECA", setForm: spy.setForm }));

    const event = pasteEvent({ items: [], text: "só um texto" });
    await act(async () => {
      await result.current.handlePaste(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mocks.createImageFromFile).not.toHaveBeenCalled();
  });
});

/** Um `ClipboardEvent` do React, com só o que o handler consulta. */
function pasteEvent({
  items,
  text = "",
  target = document.body,
}: {
  items: { type: string; getAsFile: () => File | null }[];
  text?: string;
  target?: HTMLElement;
}) {
  // `DataTransferItemList` é indexada por número e tem `length` — um array não
  // serve, porque `collectPastedImageFiles` percorre por índice, não itera.
  const list: Record<string | number, unknown> = { length: items.length };
  items.forEach((item, index) => {
    list[index] = item;
  });

  return {
    preventDefault: vi.fn(),
    target,
    clipboardData: {
      items: list as unknown as DataTransferItemList,
      getData: () => text,
    },
  } as unknown as React.ClipboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}
