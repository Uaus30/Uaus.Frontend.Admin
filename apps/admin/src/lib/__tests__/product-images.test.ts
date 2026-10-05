import { describe, expect, it } from "vitest";
import { imageLimitMessage, MAX_PRODUCT_IMAGES, withinImageLimit } from "../product-images";

describe("limite de imagens por produto (04/10/2026)", () => {
  it("é três: a capa e mais duas", () => {
    expect(MAX_PRODUCT_IMAGES).toBe(3);
  });

  it("corta pelo fim, mantendo a ordem e a capa", () => {
    expect(withinImageLimit(["capa", "b", "c", "d", "e"])).toEqual(["capa", "b", "c"]);
    expect(withinImageLimit(["capa"])).toEqual(["capa"]);
    expect(withinImageLimit([])).toEqual([]);
  });

  it("diz quantas ficaram de fora, no singular e no plural", () => {
    expect(imageLimitMessage(1).description).toContain("1 imagem ficou de fora");
    expect(imageLimitMessage(2).description).toContain("2 imagens ficaram de fora");
  });
});
