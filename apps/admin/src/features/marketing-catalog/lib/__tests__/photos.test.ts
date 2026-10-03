import { describe, expect, it } from "vitest";
import { fitWithin } from "../photos";

describe("fitWithin", () => {
  it("reduz pelo maior lado, mantendo a proporção", () => {
    expect(fitWithin(1600, 1200, 640)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(900, 1600, 640)).toEqual({ width: 360, height: 640 });
  });

  it("nunca amplia: a miniatura de 225 px segue com 225", () => {
    expect(fitWithin(225, 225, 640)).toEqual({ width: 225, height: 225 });
  });

  it("imagem muito comprida não some: o menor lado fica com 1 px", () => {
    expect(fitWithin(4000, 2, 640)).toEqual({ width: 640, height: 1 });
  });

  it("imagem sem tamanho devolve zero em vez de dividir por zero", () => {
    expect(fitWithin(0, 0, 640)).toEqual({ width: 0, height: 0 });
  });
});
