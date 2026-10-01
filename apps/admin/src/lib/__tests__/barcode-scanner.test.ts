import { describe, expect, it } from "vitest";
import { SCAN_REPEAT_COOLDOWN_MS, createScanGate, describeCameraError, scanRegion } from "../barcode-scanner";

describe("createScanGate", () => {
  it("código novo passa na hora; o mesmo, parado na frente da câmera, não repete", () => {
    const gate = createScanGate();

    expect(gate.pick(["789"], 0)).toBe("789");
    // A câmera vê o mesmo código a cada 200ms enquanto continua apontada.
    for (let now = 200; now <= 10_000; now += 200) expect(gate.pick(["789"], now)).toBeNull();
  });

  it("o mesmo código volta a valer depois de ficar fora de vista", () => {
    const gate = createScanGate();

    expect(gate.pick(["789"], 0)).toBe("789");
    expect(gate.pick([], 1000)).toBeNull();
    expect(gate.pick(["789"], SCAN_REPEAT_COOLDOWN_MS + 1)).toBe("789");
  });

  it("duas etiquetas no quadro, com o leitor alternando entre elas, entram uma vez cada", () => {
    const gate = createScanGate();
    const accepted: string[] = [];

    // Com "só o último código" isto virava A, B, A, B, A, B: seis cópias.
    ["A", "B", "A", "B", "A", "B"].forEach((code, frame) => {
      const picked = gate.pick([code], frame * 200);
      if (picked) accepted.push(picked);
    });

    expect(accepted).toEqual(["A", "B"]);
  });

  it("no máximo um código por quadro", () => {
    const gate = createScanGate();

    expect(gate.pick(["A", "B"], 0)).toBe("A");
    expect(gate.pick(["A", "B"], 200)).toBe("B");
    expect(gate.pick(["A", "B"], 400)).toBeNull();
  });

  it("busca lenta não faz o mesmo código entrar de novo quando a leitura volta", () => {
    const gate = createScanGate();

    expect(gate.pick(["789"], 0)).toBe("789");
    // A leitura ficou parada 4s esperando a busca (4G fraco) e o código não
    // foi visto nesse tempo; o touch ao fim da busca renova o relógio.
    gate.touch("789", 4000);

    expect(gate.pick(["789"], 4200)).toBeNull();
  });
});

describe("describeCameraError", () => {
  it("traduz os erros que o navegador dá ao abrir a câmera", () => {
    expect(describeCameraError(new DOMException("x", "NotAllowedError"))).toContain("bloqueado");
    expect(describeCameraError(new DOMException("x", "NotFoundError"))).toContain("Nenhuma câmera");
    expect(describeCameraError(new DOMException("x", "NotReadableError"))).toContain("em uso");
    expect(describeCameraError("qualquer coisa")).toBe("Não foi possível abrir a câmera.");
  });
});

describe("scanRegion", () => {
  it("câmera deitada (1920×1080): largura inteira, metade do meio, sem reduzir", () => {
    // Reduzir deixava as barras com 1 a 2 pixels a um palmo da embalagem.
    expect(scanRegion(1920, 1080)).toEqual({ sx: 0, sy: 270, sw: 1920, sh: 540 });
  });

  it("câmera em pé (1080×1920), como o celular costuma entregar", () => {
    expect(scanRegion(1080, 1920)).toEqual({ sx: 0, sy: 480, sw: 1080, sh: 960 });
  });

  it("vídeo ainda sem tamanho não lê nada", () => {
    expect(scanRegion(0, 0)).toBeNull();
  });
});
