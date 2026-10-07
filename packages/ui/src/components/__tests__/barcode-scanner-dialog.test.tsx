import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O diálogo da câmera: vibrar e fechar quando o produto é encontrado (pedido do
 * dono em 30/09/2026, depois do primeiro uso na loja).
 *
 * A câmera é dublada: o hook entrega ao teste o `onCode` que o diálogo passa a
 * ele, e o teste "lê" um código chamando-o.
 */

const camera = vi.hoisted(() => ({ onCode: null as null | ((code: string) => Promise<void> | void) }));

vi.mock("../../hooks/use-camera-barcode-scanner", () => ({
  useCameraBarcodeScanner: (_video: unknown, onCode: (code: string) => Promise<void> | void) => {
    camera.onCode = onCode;
    return { status: "scanning", error: null };
  },
}));

const { BarcodeScannerDialog, SCAN_SUCCESS_VIBRATION_MS } = await import("../barcode-scanner-dialog");

const vibrate = vi.fn();

function renderDialog(onDetected: Parameters<typeof BarcodeScannerDialog>[0]["onDetected"]) {
  const onOpenChange = vi.fn();
  render(
    <BarcodeScannerDialog
      open
      onOpenChange={onOpenChange}
      title="Ler"
      description="Aponte"
      onDetected={onDetected}
    />,
  );
  return { onOpenChange };
}

describe("BarcodeScannerDialog", () => {
  beforeEach(() => {
    camera.onCode = null;
    vibrate.mockReset();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("produto encontrado vibra o aparelho e fecha o diálogo", async () => {
    const { onOpenChange } = renderDialog(() => ({
      tone: "success",
      message: "CANECA adicionado.",
      close: true,
    }));

    await act(async () => camera.onCode?.("7891234567895"));

    expect(vibrate).toHaveBeenCalledWith(SCAN_SUCCESS_VIBRATION_MS);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("depois de fechar, nenhuma leitura chega mais a quem chamou", async () => {
    // O diálogo fica montado na animação de saída, com a câmera lendo: uma
    // etiqueta vizinha entraria na lista sem o diálogo à vista.
    const onDetected = vi.fn(() => ({ tone: "success" as const, message: "ok", close: true }));
    renderDialog(onDetected);

    await act(async () => camera.onCode?.("789"));
    await act(async () => camera.onCode?.("123"));

    expect(onDetected).toHaveBeenCalledTimes(1);
  });

  it("não encontrado não vibra, não fecha e mostra o aviso", async () => {
    const { onOpenChange } = renderDialog(() => ({
      tone: "warning",
      message: "Nenhum produto com o código 123.",
    }));

    await act(async () => camera.onCode?.("123"));

    expect(vibrate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Nenhum produto com o código 123.")).toBeTruthy();
  });

  it("sem vibração no navegador (iPhone), fecha do mesmo jeito", async () => {
    Reflect.deleteProperty(navigator, "vibrate");
    const { onOpenChange } = renderDialog(() => ({ tone: "success", message: "ok", close: true }));

    await act(async () => camera.onCode?.("789"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
