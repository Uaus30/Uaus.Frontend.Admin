import { describe, expect, it } from "vitest";
import type { CatalogPieceDto } from "@workspace/api-client-react";
import { roleLabel } from "../catalogProducts";
import { formatLabel } from "../formats";
import { describeMeasure, describeUnits, unitsDelta } from "../history";
import { themeLabel } from "../themes";

/** Peça como a API manda: enum pelo nome, nulo omitido. */
function piece(overrides: Partial<CatalogPieceDto> = {}): CatalogPieceDto {
  return {
    id: 1,
    sharedAt: "2026-10-03T10:00:00",
    theme: "General",
    format: "Story",
    title: "Destaques da loja",
    measuredDays: 7,
    isComplete: true,
    unitsBefore: 3,
    unitsAfter: 7,
    items: [],
    ...overrides,
  };
}

describe("unitsDelta", () => {
  it("vendeu mais: sinal de mais e tom de alta", () => {
    expect(unitsDelta(3, 7)).toEqual({ tone: "up", label: "+4" });
  });

  it("vendeu menos: o menos tipográfico, e tom de queda", () => {
    expect(unitsDelta(7, 3)).toEqual({ tone: "down", label: "−4" });
  });

  it("igual — inclusive zero dos dois lados — não é alta nem queda", () => {
    expect(unitsDelta(5, 5)).toEqual({ tone: "flat", label: "=" });
    expect(unitsDelta(0, 0)).toEqual({ tone: "flat", label: "=" });
  });
});

describe("describeUnits", () => {
  it("concorda no singular e no plural", () => {
    expect(describeUnits(0)).toBe("0 unidades");
    expect(describeUnits(1)).toBe("1 unidade");
    expect(describeUnits(12)).toBe("12 unidades");
  });
});

describe("describeMeasure", () => {
  it("semana fechada diz quantos dias de cada lado", () => {
    expect(describeMeasure(piece(), 7)).toBe("Semana fechada: 7 dias de cada lado.");
  });

  it("no primeiro dia avisa que ainda é cedo, em vez de mostrar zero contra zero como resultado", () => {
    expect(describeMeasure(piece({ isComplete: false, measuredDays: 0 }), 7)).toMatch(/cedo para comparar/);
  });

  it("pela metade, diz quantos dias mediu e contra o quê compara", () => {
    expect(describeMeasure(piece({ isComplete: false, measuredDays: 1 }), 7)).toBe(
      "Medindo: 1 dia de 7, contra o mesmo trecho da semana anterior.",
    );
    expect(describeMeasure(piece({ isComplete: false, measuredDays: 3 }), 7)).toBe(
      "Medindo: 3 dias de 7, contra o mesmo trecho da semana anterior.",
    );
  });
});

describe("rótulos do que a API devolve pelo nome", () => {
  it("formato", () => {
    expect(formatLabel("Story")).toBe("Banner 9:16");
    expect(formatLabel("Feed")).toBe("Banner 4:5");
    expect(formatLabel("Pdf")).toBe("Catálogo em PDF");
    expect(formatLabel("Outdoor")).toBe("Peça");
  });

  it("tema: os fixos pelo nome da tela, o de departamento pelo departamento", () => {
    expect(themeLabel("General")).toBe("Geral");
    expect(themeLabel("NewsAndOffers")).toBe("Novidades e promoções");
    expect(themeLabel("BestSellers")).toBe("Mais vendidos");
    expect(themeLabel("Finds")).toBe("Achados");
    expect(themeLabel("Department", "Brinquedos")).toBe("Brinquedos");
    // O departamento foi excluído depois: a API omite o nome.
    expect(themeLabel("Department")).toBe("Departamento");
    expect(themeLabel("Sazonal")).toBe("Tema");
  });

  it("papel", () => {
    expect(roleLabel("Offer")).toBe("Promoção");
    expect(roleLabel("Slow")).toBe("Achado");
    expect(roleLabel("Desconhecido")).toBe("—");
  });
});
