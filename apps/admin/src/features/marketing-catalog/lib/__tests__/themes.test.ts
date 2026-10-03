import { describe, expect, it } from "vitest";
import type { CatalogThemeDto } from "@workspace/api-client-react";
import { buildThemeOptions, DEFAULT_THEME_KEY, describeProductCount } from "../themes";

/** A lista como a API manda: enum pelo nome, campos de departamento só no tema dele. */
const fromApi: CatalogThemeDto[] = [
  { theme: "General", products: 608 },
  { theme: "NewsAndOffers", products: 22 },
  { theme: "BestSellers", products: 128 },
  { theme: "Finds", products: 285 },
  { theme: "Department", departmentId: 7, departmentName: "Brinquedos", products: 82 },
  { theme: "Department", departmentId: 3, departmentName: "Cozinha", products: 199 },
];

describe("buildThemeOptions", () => {
  it("monta os quatro temas fixos e um por departamento, na ordem da API", () => {
    const options = buildThemeOptions(fromApi);

    expect(options.map((option) => option.label)).toEqual([
      "Geral (mistura inteligente)",
      "Novidades e promoções",
      "Mais vendidos",
      "Achados",
      "Brinquedos",
      "Cozinha",
    ]);
  });

  it("o título sugerido do departamento é o nome dele", () => {
    const cozinha = buildThemeOptions(fromApi).find((option) => option.label === "Cozinha");

    expect(cozinha).toEqual({
      key: "5:3",
      theme: 5,
      departmentId: 3,
      label: "Cozinha",
      title: "Cozinha",
      products: 199,
    });
  });

  it("cada opção tem chave própria, inclusive os departamentos entre si", () => {
    const keys = buildThemeOptions(fromApi).map((option) => option.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(DEFAULT_THEME_KEY);
  });

  it("o tema geral leva um título de vitrine, e não o rótulo do seletor", () => {
    const geral = buildThemeOptions(fromApi)[0];

    expect(geral.title).toBe("Destaques da loja");
    expect(geral.departmentId).toBeUndefined();
  });

  it("tema que esta versão da tela não conhece fica de fora", () => {
    const options = buildThemeOptions([{ theme: "Sazonal", products: 9 }, ...fromApi]);

    expect(options).toHaveLength(6);
  });

  it("departamento sem id ou sem nome não vira opção sem rótulo", () => {
    const options = buildThemeOptions([
      { theme: "Department", products: 9 },
      { theme: "Department", departmentId: 4, products: 9 },
    ]);

    expect(options).toEqual([]);
  });

  it("tema sem produto continua na lista — quem o desabilita é a tela", () => {
    const options = buildThemeOptions([{ theme: "NewsAndOffers", products: 0 }]);

    expect(options).toHaveLength(1);
    expect(options[0].products).toBe(0);
  });
});

describe("describeProductCount", () => {
  it("concorda o plural", () => {
    expect(describeProductCount(0)).toBe("0 produtos");
    expect(describeProductCount(1)).toBe("1 produto");
    expect(describeProductCount(22)).toBe("22 produtos");
  });
});
