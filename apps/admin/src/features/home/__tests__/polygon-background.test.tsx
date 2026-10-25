import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POLYGON_COLORS, polygonColorAt } from "../polygon-palette";
import { PolygonBackground } from "../components/PolygonBackground";

/**
 * O fundo de polígonos da tela inicial (24/10/2026). É enfeite numa tela que é
 * o destino do "Início" da tela de erro: o que se trava aqui é que ele não
 * derruba a tela e que respeita quem pediu menos movimento.
 */

describe("polygonColorAt", () => {
  it("vai da primeira cor, na borda esquerda, à última, na direita", () => {
    expect(polygonColorAt(0)).toEqual(POLYGON_COLORS[0]);
    expect(polygonColorAt(0.5)).toEqual(POLYGON_COLORS[1]);
    // 0,999 e não 1: a última cor é o fim da escala, alcançado no limite.
    const last = POLYGON_COLORS[POLYGON_COLORS.length - 1];
    polygonColorAt(1).forEach((channel, i) => expect(Math.abs(channel - last[i])).toBeLessThanOrEqual(1));
  });

  it("mistura as duas cores vizinhas no meio do caminho", () => {
    const [a, b] = POLYGON_COLORS;

    expect(polygonColorAt(0.25)).toEqual([0, 1, 2].map((i) => Math.round((a[i] + b[i]) / 2)));
  });

  it("fora de 0..1 vale a cor da borda, e NaN vale a da esquerda em vez de quebrar", () => {
    // NaN sai de uma divisão por largura zero no meio de um redimensionamento;
    // sem a guarda viraria índice NaN e uma leitura de `undefined`.
    expect(polygonColorAt(-3)).toEqual(POLYGON_COLORS[0]);
    expect(polygonColorAt(Number.NaN)).toEqual(POLYGON_COLORS[0]);
    expect(polygonColorAt(Number.POSITIVE_INFINITY)).toEqual(POLYGON_COLORS[0]);
    expect(polygonColorAt(7)).toEqual(polygonColorAt(1));
  });
});

describe("PolygonBackground", () => {
  /** O contexto 2D falso: só os métodos que o desenho chama. Recriado a cada teste, porque o componente grava `strokeStyle` e `fillStyle` nele. */
  function fakeContext() {
    return {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
    };
  }
  let ctx = fakeContext();
  const observers: { disconnect: ReturnType<typeof vi.fn> }[] = [];

  function stubMotion(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced })),
    );
  }

  beforeEach(() => {
    ctx = fakeContext();
    observers.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800,
      height: 600,
    } as DOMRect);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn();
        constructor() {
          observers.push(this);
        }
        observe() {}
      },
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 42),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("é um canvas decorativo: escondido do leitor de tela e sem pegar o toque", () => {
    stubMotion(false);
    render(<PolygonBackground />);

    const canvas = screen.getByTestId("polygon-background");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.className).toContain("pointer-events-none");
  });

  it("desenha a malha logo ao abrir e anima quadro a quadro", () => {
    stubMotion(false);
    render(<PolygonBackground />);

    // 800 x 600 = 480.000 px² → 22 pontos pela área, e o piso sobe para 26.
    expect(ctx.arc).toHaveBeenCalledTimes(26);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  /** O quadro que o componente pediu ao navegador — chamá-lo é "passar o tempo". */
  function nextFrame(): FrameRequestCallback {
    return vi.mocked(window.requestAnimationFrame).mock.calls[0][0];
  }

  it.each([60, 120])("numa tela de %i Hz, desenha 60 quadros por segundo", (hz) => {
    // Andando "um passo por quadro", como no original do Prisma, a tela de
    // 120 Hz desenharia o dobro e a malha correria no dobro da velocidade.
    stubMotion(false);
    render(<PolygonBackground />);
    const step = nextFrame();
    ctx.clearRect.mockClear();

    // O primeiro quadro só acerta o relógio; os outros cobrem um segundo.
    for (let i = 0; i <= hz; i++) step((i * 1000) / hz);

    expect(ctx.clearRect).toHaveBeenCalledTimes(60);
  });

  it("com a aba oculta, não desenha", () => {
    stubMotion(false);
    render(<PolygonBackground />);
    const step = nextFrame();
    ctx.clearRect.mockClear();

    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    for (let i = 0; i <= 60; i++) step((i * 1000) / 60);

    expect(ctx.clearRect).not.toHaveBeenCalled();
  });

  it("com menos movimento pedido pelo aparelho, desenha uma vez e não anima", () => {
    stubMotion(true);
    render(<PolygonBackground />);

    expect(ctx.arc).toHaveBeenCalledTimes(26);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("ao sair da tela, para a animação e o observador de tamanho", () => {
    stubMotion(false);
    const { unmount } = render(<PolygonBackground />);
    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("sem canvas 2D nem ResizeObserver (navegador antigo), não derruba a tela", () => {
    stubMotion(false);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal("ResizeObserver", undefined);

    expect(() => render(<PolygonBackground />)).not.toThrow();
    expect(screen.getByTestId("polygon-background")).toBeTruthy();
  });

  it("sem ResizeObserver mas com canvas, ainda desenha a malha uma vez", () => {
    stubMotion(false);
    vi.stubGlobal("ResizeObserver", undefined);

    expect(() => render(<PolygonBackground />)).not.toThrow();
    expect(ctx.arc).toHaveBeenCalledTimes(26);
  });
});
