import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { chaveDaCombinacao, nomeExibidoDaVariacao } from "../variationNames";

describe("nomeExibidoDaVariacao", () => {
  it("monta o nome igual ao que o backend vai compor", () => {
    // Espelha `ProductDisplayName.Compose`. Divergir daqui é divergir do cupom.
    const nome = nomeExibidoDaVariacao("Camiseta", [
      { gradeType: GRADE_TYPE.Color, value: "Azul" },
      { gradeType: GRADE_TYPE.Size, value: "G" },
    ]);

    expect(nome).toBe("CAMISETA [AZUL, G]");
  });

  it("variação sem valor mostra só o nome do grupo", () => {
    expect(nomeExibidoDaVariacao("Camiseta", [])).toBe("Camiseta");
  });
});

describe("chaveDaCombinacao", () => {
  it("não depende da ordem nem da caixa", () => {
    // Duas variações com a mesma combinação escrita de formas diferentes
    // continuam sendo a mesma variação, e o salvamento precisa recusá-las.
    const a = chaveDaCombinacao([
      { gradeType: GRADE_TYPE.Size, value: "g" },
      { gradeType: GRADE_TYPE.Color, value: "Azul" },
    ]);
    const b = chaveDaCombinacao([
      { gradeType: GRADE_TYPE.Color, value: " AZUL " },
      { gradeType: GRADE_TYPE.Size, value: "G" },
    ]);

    expect(a).toBe(b);
  });

  it("distingue combinações diferentes", () => {
    const azul = chaveDaCombinacao([{ gradeType: GRADE_TYPE.Color, value: "Azul" }]);
    const preto = chaveDaCombinacao([{ gradeType: GRADE_TYPE.Color, value: "Preto" }]);

    expect(azul).not.toBe(preto);
  });
});
