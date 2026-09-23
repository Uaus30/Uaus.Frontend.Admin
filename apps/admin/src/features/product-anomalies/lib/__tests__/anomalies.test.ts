import { describe, expect, it } from "vitest";
import type { ProductAnomalyDto, ProductAnomalyRowDto } from "@workspace/api-client-react";
import {
  ANOMALY_META,
  ANOMALY_ORDER,
  FALLBACK_META,
  anomalyMeta,
  anomalyRank,
  describeAnomaly,
  variationLabel,
  zeroCostIsCorrectable,
} from "../anomalies";
import { bexiga, cumbuca, jarra } from "../../__tests__/fixtures";

describe("catálogo das etiquetas", () => {
  it("todo tipo tem rótulo, ícone, cor e o que fazer — e aparece na ordem", () => {
    for (const tipo of ANOMALY_ORDER) {
      const meta = ANOMALY_META[tipo];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.fix.length).toBeGreaterThan(10);
    }
    expect(new Set(ANOMALY_ORDER).size).toBe(Object.keys(ANOMALY_META).length);
  });

  it("vermelho só para o que perde dinheiro ou trava a venda", () => {
    const vermelhos = ANOMALY_ORDER.filter((tipo) => ANOMALY_META[tipo].tone === "ruim");
    expect(vermelhos).toEqual(["PriceBelowCost", "DraftWithStock"]);
  });

  it("tipo desconhecido cai no fallback e vai para o fim, sem derrubar a tela", () => {
    expect(anomalyMeta("AlgoNovoDoBackend")).toBe(FALLBACK_META);
    expect(anomalyRank("AlgoNovoDoBackend")).toBe(ANOMALY_ORDER.length);
    expect(anomalyRank("PriceBelowCost")).toBe(0);
  });
});

describe("describeAnomaly", () => {
  it("preço abaixo do custo diz quanto cada venda perde", () => {
    expect(describeAnomaly(jarra.anomalies[0]!, jarra)).toMatch(
      /Preço R\$\s14,90 · custo R\$\s15,42 — cada venda perde R\$\s0,52 por unidade\./,
    );
  });

  it("o lote antigo mais caro entra na conta da perda", () => {
    const anomalia: ProductAnomalyDto = { type: "PriceBelowCost", price: 10, costPrice: 8, lotCost: 12 };
    const texto = describeAnomaly(anomalia, jarra);

    expect(texto).toContain("um lote antigo de");
    expect(texto).toMatch(/perde R\$\s2,00 por unidade/);
  });

  it("estoque fantasma escreve a conta por extenso", () => {
    const texto = describeAnomaly(cumbuca.anomalies[0]!, cumbuca);

    expect(texto).toBe(
      "Vendia em 39 de 401 vendas da loja (1 a cada 10). Desde 22/09/2026, a loja fez 31 vendas sem ele — no ritmo, seriam ~3. No sistema: 3 unidades.",
    );
  });

  it("custo zerado aponta a entrada que se corrige", () => {
    expect(describeAnomaly(bexiga.anomalies[0]!, bexiga)).toBe(
      "10 unidades com custo R$ 0,00 · entrada #1011 de 18/08/2026 — o BI conta 100% de margem nelas.",
    );
  });

  it("custo zero numa entrada ANTERIOR diz que a tela não corrige — e não oferece o atalho", () => {
    // Uma compra nova por cima pôs o custo do cadastro acima de zero; as unidades do
    // lote zerado continuam saindo primeiro (revisão, 23/09/2026).
    const escondido: ProductAnomalyDto = {
      type: "ZeroCost",
      productId: 10,
      costPrice: 0.03,
      stock: 70,
      zeroCostUnits: 50,
      lastEntryId: 1200,
      lastEntryDate: "2026-09-20T00:00:00",
      zeroCostEntryId: 1011,
      zeroCostEntryDate: "2026-08-18T00:00:00",
    };

    expect(zeroCostIsCorrectable(escondido)).toBe(false);
    expect(describeAnomaly(escondido, bexiga)).toBe(
      "50 unidades num lote de custo R$ 0,00 da entrada #1011 de 18/08/2026, anterior à última — saem com 100% de margem no BI até acabar, e a tela só corrige a última entrada.",
    );
  });

  it("custo do cadastro zero sem unidade zerada na prateleira", () => {
    const soCadastro: ProductAnomalyDto = { type: "ZeroCost", costPrice: 0, lastEntryId: 7 };

    expect(zeroCostIsCorrectable(soCadastro)).toBe(true);
    expect(describeAnomaly(soCadastro, bexiga)).toBe("Custo do cadastro R$ 0,00 · entrada #7.");
  });

  it("nome repetido conta os outros cadastros", () => {
    expect(describeAnomaly(bexiga.anomalies[1]!, bexiga)).toBe("Outros 2 cadastros têm o mesmo nome.");
    expect(describeAnomaly({ type: "DuplicateName", duplicateGroupIds: [5] }, bexiga)).toBe(
      "Outro cadastro tem o mesmo nome.",
    );
  });

  it("as do cadastro inteiro usam o saldo da linha", () => {
    expect(describeAnomaly({ type: "MissingPhoto" }, cumbuca)).toBe("3 unidades na prateleira sem foto.");
    expect(
      describeAnomaly({ type: "HiddenFromStorefront" }, { ...cumbuca, stock: 1 } as ProductAnomalyRowDto),
    ).toBe("Tem foto e 1 unidade, e “Exibir no site” está desligado.");
  });
});

describe("variationLabel", () => {
  it("só nomeia a variação em cadastro com variações", () => {
    expect(variationLabel(bexiga.anomalies[0]!, bexiga)).toBe("BEXIGA [AZUL]");
    expect(variationLabel(jarra.anomalies[0]!, jarra)).toBeNull();
    expect(variationLabel(bexiga.anomalies[1]!, bexiga)).toBeNull();
  });
});
