import { describe, expect, it } from "vitest";
import { isPlanTrip, shortDate, lastPurchaseLabel, supplierCityOptions } from "../shopping-list";

describe("supplierCityOptions", () => {
  it("junta grafias da mesma cidade sem caixa, acento e espaço sobrando", () => {
    const opcoes = supplierCityOptions([
      { city: "Maringa" },
      { city: "MARINGÁ" },
      { city: "  Maringá  " },
      { city: "Maringá" },
      { city: "Umuarama" },
    ]);

    // A grafia mais usada vence ("Maringá" aparece duas vezes depois de aparada).
    expect(opcoes).toEqual([
      { value: "maringa", label: "Maringá" },
      { value: "umuarama", label: "Umuarama" },
    ]);
  });

  it("no empate de contagem, a grafia acentuada vence", () => {
    expect(supplierCityOptions([{ city: "Maringa" }, { city: "Maringá" }])).toEqual([
      { value: "maringa", label: "Maringá" },
    ]);
  });

  it("ignora fornecedor sem cidade e ordena em ordem alfabética", () => {
    const opcoes = supplierCityOptions([
      { city: "" },
      { city: "   " },
      { city: "Umuarama" },
      { city: "Apucarana" },
    ]);

    expect(opcoes.map((opcao) => opcao.label)).toEqual(["Apucarana", "Umuarama"]);
  });

  it("espaço repetido no meio do nome também não separa a cidade", () => {
    expect(supplierCityOptions([{ city: "São  Paulo" }, { city: "São Paulo" }])).toHaveLength(1);
  });
});

describe("lastPurchaseLabel", () => {
  it("mostra quantidade e data com o ano, lidos do texto da API sem passar por fuso", () => {
    expect(lastPurchaseLabel({ lastPurchaseQuantity: 3, lastPurchaseDate: "2026-09-25T00:00:00" })).toBe(
      "3 un. em 25/09/26",
    );
    // A compra de um ano atrás não pode parecer a da semana passada.
    expect(lastPurchaseLabel({ lastPurchaseQuantity: 3, lastPurchaseDate: "2025-09-25T00:00:00" })).toBe(
      "3 un. em 25/09/25",
    );
  });

  it("sem compra registrada — campos omitidos pela API — mostra traço", () => {
    expect(lastPurchaseLabel({})).toBe("—");
  });

  it("com quantidade e sem data, mostra só a quantidade", () => {
    expect(lastPurchaseLabel({ lastPurchaseQuantity: 2 })).toBe("2 un.");
  });

  it("formato de data inesperado volta como veio", () => {
    expect(shortDate("25/09/2026")).toBe("25/09/2026");
  });
});

describe("isPlanTrip", () => {
  it("só com o controle desligado E o motivo Planejar viagem", () => {
    expect(isPlanTrip({ stockControlEnabled: false, stockControlDisabledReason: "PlanTrip" })).toBe(true);
    expect(isPlanTrip({ stockControlEnabled: false, stockControlDisabledReason: "EndOfLine" })).toBe(false);
    expect(isPlanTrip({ stockControlEnabled: true, stockControlDisabledReason: null })).toBe(false);
  });
});
