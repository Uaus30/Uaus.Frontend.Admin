import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PieceData } from "../../types";
import type { RenderRequest, RenderResponse } from "../render.worker";

/**
 * A porta do desenho: worker quando dá, thread principal quando não dá.
 *
 * O desenho em si (`rasterize`) é dublado — precisa de WebAssembly. O que se
 * protege aqui é a rede de segurança: nenhuma falha do worker pode deixar o
 * dono sem a peça.
 */

const mocks = vi.hoisted(() => ({ rasterize: vi.fn(), warmUp: vi.fn() }));

vi.mock("../rasterize", () => ({ rasterize: mocks.rasterize, warmUp: mocks.warmUp }));

const { preloadRenderer, renderPiece, resetRendererForTests } = await import("../renderer");

const DATA = { title: "Destaques", cards: [] } as unknown as PieceData;
const HERE = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
const FROM_WORKER = { data: new Uint8ClampedArray(8), width: 2, height: 1 };

/** Um worker de mentira: guarda o que recebeu e deixa o teste responder. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failToStart = false;

  onmessage: ((event: MessageEvent<RenderResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  received: RenderRequest[] = [];
  terminated = false;

  constructor() {
    if (FakeWorker.failToStart) throw new Error("worker de módulo não suportado");
    FakeWorker.instances.push(this);
  }

  postMessage(message: RenderRequest) {
    this.received.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(response: RenderResponse) {
    this.onmessage?.({ data: response } as MessageEvent<RenderResponse>);
  }
}

const lastWorker = () => FakeWorker.instances.at(-1)!;

describe("renderPiece", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.failToStart = false;
    vi.stubGlobal("Worker", FakeWorker);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.rasterize.mockResolvedValue(HERE);
    mocks.warmUp.mockResolvedValue(undefined);
    resetRendererForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("manda a peça para o worker e devolve os pixels que ele responder", async () => {
    const pending = renderPiece("story", DATA);
    await vi.waitFor(() => expect(lastWorker().received).toHaveLength(1));

    const request = lastWorker().received[0];
    expect(request).toMatchObject({ kind: "render", piece: "story", data: DATA });
    lastWorker().reply({ id: request.id, ok: true, pixels: FROM_WORKER });

    await expect(pending).resolves.toBe(FROM_WORKER);
    expect(mocks.rasterize).not.toHaveBeenCalled();
  });

  it("o mesmo worker serve as peças seguintes, e cada resposta volta para o pedido dela", async () => {
    const first = renderPiece("page", DATA);
    const second = renderPiece("page", DATA);
    await vi.waitFor(() => expect(lastWorker().received).toHaveLength(2));
    const [a, b] = lastWorker().received;

    // Respostas fora de ordem.
    lastWorker().reply({ id: b.id, ok: true, pixels: FROM_WORKER });
    lastWorker().reply({ id: a.id, ok: true, pixels: HERE });

    await expect(first).resolves.toBe(HERE);
    await expect(second).resolves.toBe(FROM_WORKER);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("sem Worker no navegador, desenha na thread principal", async () => {
    vi.stubGlobal("Worker", undefined);

    await expect(renderPiece("feed", DATA)).resolves.toBe(HERE);
    expect(mocks.rasterize).toHaveBeenCalledWith("feed", DATA);
  });

  it("worker que não sobe (navegador antigo): desenha na thread principal, sem tentar de novo", async () => {
    FakeWorker.failToStart = true;

    await expect(renderPiece("story", DATA)).resolves.toBe(HERE);
    await expect(renderPiece("story", DATA)).resolves.toBe(HERE);

    expect(mocks.rasterize).toHaveBeenCalledTimes(2);
  });

  it("erro do desenho dentro do worker: a mesma peça é desenhada na thread principal", async () => {
    const pending = renderPiece("story", DATA);
    await vi.waitFor(() => expect(lastWorker().received).toHaveLength(1));

    lastWorker().reply({ id: lastWorker().received[0].id, ok: false, message: "wasm não carregou" });

    await expect(pending).resolves.toBe(HERE);
    expect(console.warn).toHaveBeenCalled();
  });

  it("worker que quebra no meio: quem esperava é atendido na thread principal, e ele não é mais usado", async () => {
    const pending = renderPiece("story", DATA);
    await vi.waitFor(() => expect(lastWorker().received).toHaveLength(1));
    const broken = lastWorker();

    broken.onerror?.();

    await expect(pending).resolves.toBe(HERE);
    expect(broken.terminated).toBe(true);

    await expect(renderPiece("story", DATA)).resolves.toBe(HERE);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(broken.received).toHaveLength(1);
  });

  it("se o desenho falha também na thread principal, o erro chega a quem chamou", async () => {
    vi.stubGlobal("Worker", undefined);
    mocks.rasterize.mockRejectedValue(new Error("molde inválido"));

    await expect(renderPiece("story", DATA)).rejects.toThrow("molde inválido");
  });
});

describe("preloadRenderer", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.failToStart = false;
    vi.stubGlobal("Worker", FakeWorker);
    mocks.warmUp.mockResolvedValue(undefined);
    resetRendererForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("aquece o worker, e a primeira peça usa o MESMO worker", async () => {
    preloadRenderer();
    expect(lastWorker().received[0]).toMatchObject({ kind: "warm" });

    void renderPiece("story", DATA);
    await vi.waitFor(() => expect(lastWorker().received).toHaveLength(2));

    expect(FakeWorker.instances).toHaveLength(1);
    expect(mocks.warmUp).not.toHaveBeenCalled();
  });

  it("sem worker, aquece a thread principal — e falha de rede aqui não vira erro solto", async () => {
    vi.stubGlobal("Worker", undefined);
    mocks.warmUp.mockRejectedValue(new Error("sem rede"));

    expect(() => preloadRenderer()).not.toThrow();
    await vi.waitFor(() => expect(mocks.warmUp).toHaveBeenCalledTimes(1));
  });
});
