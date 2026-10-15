import { describe, expect, it } from "vitest";
import type { ProductAnomalyDto } from "@workspace/api-client-react";
import { describeInconsistency } from "../inconsistency";
import { ANOMALY_ORDER, anomalyMeta, describeAnomaly } from "../anomalies";

function inconsistencia(campos: Partial<ProductAnomalyDto>): ProductAnomalyDto {
  return { type: "Inconsistency", ...campos };
}

const LINHA = { productGroupId: 1, name: "BALANÇA", hasVariations: true, stock: 3, anomalies: [] };

describe("describeInconsistency", () => {
  it("valor genérico diz o valor e a grade pelo nome em português", () => {
    // A grade chega pelo NOME do enum ("Brand"); a etiqueta tem que dizer Marca.
    const texto = describeInconsistency(
      inconsistencia({ inconsistency: "GenericGradeValue", gradeType: "Brand", gradeValue: "CÓPIA 2" }),
    );

    expect(texto).toContain("“CÓPIA 2”");
    expect(texto).toContain("grade Marca");
  });

  it("grade faltando diz qual grade falta", () => {
    expect(
      describeInconsistency(inconsistencia({ inconsistency: "MissingGradeValue", gradeType: "Color" })),
    ).toContain("grade Cor");
  });

  it("estoque divergente mostra os dois números", () => {
    const texto = describeInconsistency(
      inconsistencia({ inconsistency: "StockDiffersFromLots", stock: 8, lotsStock: 5 }),
    );

    expect(texto).toContain("Estoque 8 no cadastro e 5 nos lotes");
  });

  it("código inválido mostra o código gravado", () => {
    expect(
      describeInconsistency(inconsistencia({ inconsistency: "InvalidBarcode", barcode: "0101" })),
    ).toContain("“0101”");
  });

  it("motivo e grade desconhecidos não derrubam a etiqueta", () => {
    // Backend mais novo que a tela: a lista continua de pé.
    const texto = describeInconsistency(
      inconsistencia({ inconsistency: "Nova" as ProductAnomalyDto["inconsistency"], gradeType: "Material" }),
    );

    expect(texto).toContain("abra o produto");
  });
});

describe("Inconsistência na tela de anomalias", () => {
  it("é a última da prioridade e tem rótulo próprio", () => {
    expect(ANOMALY_ORDER[ANOMALY_ORDER.length - 1]).toBe("Inconsistency");
    expect(anomalyMeta("Inconsistency").label).toBe("Inconsistência");
  });

  it("a frase da etiqueta é a do motivo", () => {
    const anomaly = inconsistencia({ inconsistency: "ZeroPrice", price: 0 });

    expect(describeAnomaly(anomaly, LINHA)).toContain("em produto à venda");
  });
});
