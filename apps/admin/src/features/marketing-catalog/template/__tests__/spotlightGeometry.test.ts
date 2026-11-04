import { describe, expect, it } from "vitest";
import { FEED, STORY } from "../geometry";
import {
  fitPhoto,
  MAX_PHOTO_UPSCALE,
  SPOTLIGHT_FEED,
  SPOTLIGHT_STORY,
  spotlightBoxes,
} from "../spotlightGeometry";
import { priceDigitsFactor } from "../text";

describe("medidas do banner de destaque", () => {
  it("a moldura é a mesma do banner do catálogo: as artes já estão recortadas nela", () => {
    for (const [spotlight, catalog] of [
      [SPOTLIGHT_STORY, STORY],
      [SPOTLIGHT_FEED, FEED],
    ] as const) {
      expect(spotlight).toMatchObject({
        width: catalog.width,
        height: catalog.height,
        headerArtHeight: catalog.headerArtHeight,
        title: catalog.title,
        panelTop: catalog.panelTop,
        footerHeight: catalog.footerHeight,
      });
    }
  });

  it("no 9:16 a foto fica em cima, e foto e texto preenchem o card sem passar dele", () => {
    const { card, photo, text } = spotlightBoxes(SPOTLIGHT_STORY);

    expect(SPOTLIGHT_STORY.photoMargin + photo.height + text.height).toBe(card.height);
    expect(photo.width + 2 * SPOTLIGHT_STORY.photoMargin).toBe(card.width);
    expect(photo.height).toBeGreaterThan(600);
  });

  it("no 4:5 a foto vai à esquerda e o texto à direita", () => {
    const { card, photo, text } = spotlightBoxes(SPOTLIGHT_FEED);

    expect(SPOTLIGHT_FEED.photoMargin + photo.width + text.width).toBe(card.width);
    expect(photo.height + 2 * SPOTLIGHT_FEED.photoMargin).toBe(card.height);
  });
});

describe("fitPhoto", () => {
  const box = { width: 940, height: 690 };

  it("a foto grande cabe na área, com a proporção dela", () => {
    expect(fitPhoto(box, { width: 1080, height: 1080 })).toEqual({ width: 690, height: 690 });
    expect(fitPhoto(box, { width: 2000, height: 1000 })).toEqual({ width: 940, height: 470 });
  });

  it(`a foto pequena cresce no máximo ${MAX_PHOTO_UPSCALE} vezes, para não borrar`, () => {
    expect(fitPhoto(box, { width: 225, height: 225 })).toEqual({ width: 450, height: 450 });
  });

  it("tamanho desconhecido ocupa a área", () => {
    expect(fitPhoto(box, { width: 0, height: 0 })).toEqual(box);
  });
});

describe("priceDigitsFactor", () => {
  it("até dois dígitos o corpo é o cheio; com mais, encolhe para caber", () => {
    expect(priceDigitsFactor(9.9)).toBe(1);
    expect(priceDigitsFactor(29.9)).toBe(1);
    expect(priceDigitsFactor(129.9)).toBe(0.82);
    expect(priceDigitsFactor(1234.5)).toBe(0.68);
  });
});
