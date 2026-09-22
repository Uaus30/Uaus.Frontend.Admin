import { describe, expect, it } from "vitest";
import {
  HEAVY_DROP,
  HEAVY_PARKED_COST,
  alertBadgeLabel,
  archetypeAction,
  archetypeLabel,
  describeDays,
  formatDay,
  isEscalated,
  highlightLevel,
  leaderTone,
  readAlert,
  readArchetype,
  readPerUnit,
  readPosition,
} from "../profit-leaders";
import { liderDeTeste } from "../../__tests__/fixtures";

describe("leaderTone", () => {
  it("guarda o vermelho para quando queda forte e dinheiro parado se somam", () => {
    // Se tudo que preocupa for vermelho, nada é. Aqui não existe produto ruim —
    // todos chegaram ao corte —, então o padrão do alerta é âmbar.
    const soQueda = liderDeTeste({
      archetype: "Declining",
      alert: "ParkedStock",
      trendPercentage: HEAVY_DROP - 10,
      stockCost: HEAVY_PARKED_COST - 1,
    });

    const quedaComDinheiro = liderDeTeste({
      archetype: "Declining",
      alert: "ParkedStock",
      trendPercentage: HEAVY_DROP - 10,
      stockCost: HEAVY_PARKED_COST,
    });

    expect(leaderTone(soQueda)).toBe("atencao");
    expect(leaderTone(quedaComDinheiro)).toBe("ruim");
  });

  it("queda forte sem dinheiro parado continua em ambar", () => {
    const leve = liderDeTeste({
      archetype: "Declining",
      alert: "ParkedStock",
      trendPercentage: -10,
      stockCost: 900,
    });

    expect(leaderTone(leve)).toBe("atencao");
  });

  it("ruptura e estoque curto sao atencao, nunca vermelho", () => {
    expect(leaderTone(liderDeTeste({ archetype: "Declining", alert: "StockOut" }))).toBe("atencao");
    expect(leaderTone(liderDeTeste({ archetype: "Workhorse", alert: "LowCoverage" }))).toBe("atencao");
  });

  it("linha sem alerta e boa, e a estavel e neutra", () => {
    expect(leaderTone(liderDeTeste({ archetype: "Workhorse", alert: "None" }))).toBe("bom");
    expect(leaderTone(liderDeTeste({ archetype: "Steady", alert: "None" }))).toBe("neutro");
  });
});

describe("um valor de enum que o front ainda nao conhece", () => {
  // O backend pode acrescentar um arquetipo ou um alerta a qualquer momento. Sem
  // guarda, o icone vem `undefined` e `<Icon />` estoura em tempo de render: o
  // ErrorBoundary da rota troca a TELA INTEIRA pela tela de recuperacao.
  const desconhecido = liderDeTeste({
    archetype: "Bundle" as never,
    alert: "Seasonal" as never,
  });

  it("nao devolve rotulo vazio", () => {
    expect(archetypeLabel(desconhecido.archetype)).toBeTruthy();
    expect(alertBadgeLabel(desconhecido)).toBeTruthy();
    expect(archetypeAction(desconhecido.archetype)).toBe("");
  });

  it("nao pinta de verde um arquetipo que ninguem sabe o que e", () => {
    // O caminho positivo do tom era por EXCLUSAO: tudo que nao fosse "Steady"
    // caia em "bom". Um arquetipo novo e negativo nasceria pintado de positivo.
    expect(leaderTone(liderDeTeste({ archetype: "Bundle" as never, alert: "None" }))).toBe("neutro");
    expect(leaderTone(liderDeTeste({ archetype: "Declining", alert: "None" }))).toBe("neutro");
  });
});

describe("alertBadgeLabel", () => {
  it("escreve a escalada em PALAVRAS, e nao so no matiz", () => {
    // Duas linhas com as mesmas pilulas, os mesmos icones e a mesma frase: a
    // unica diferenca era a cor. Impressa em preto e branco — e esta e' uma tela
    // que se imprime para levar ao balcao — a escalada sumia por completo.
    const leve = liderDeTeste({
      alert: "ParkedStock",
      archetype: "Declining",
      trendPercentage: -20,
      stockCost: 100,
    });
    const grave = liderDeTeste({
      alert: "ParkedStock",
      archetype: "Declining",
      trendPercentage: -60,
      stockCost: 500,
    });

    expect(alertBadgeLabel(leve)).toBe("Estoque parado");
    expect(alertBadgeLabel(grave)).toBe("Estoque parado · urgente");
    expect(alertBadgeLabel(leve)).not.toBe(alertBadgeLabel(grave));
  });

  it("a escalada exige os DOIS gatilhos, exatamente nos numeros do manual", () => {
    const base = { alert: "ParkedStock" as const, archetype: "Declining" as const };

    expect(
      isEscalated(liderDeTeste({ ...base, trendPercentage: HEAVY_DROP, stockCost: HEAVY_PARKED_COST })),
    ).toBe(true);
    expect(
      isEscalated(liderDeTeste({ ...base, trendPercentage: HEAVY_DROP + 1, stockCost: HEAVY_PARKED_COST })),
    ).toBe(false);
    expect(
      isEscalated(liderDeTeste({ ...base, trendPercentage: HEAVY_DROP, stockCost: HEAVY_PARKED_COST - 1 })),
    ).toBe(false);
  });
});

describe("highlightLevel", () => {
  it("o estreante e o que mais salta, e o alerta apaga o destaque", () => {
    // A intensidade segue a FORCA DO SINAL de ascensao, e nao a qualidade geral:
    // esta ja esta codificada na posicao do ranking.
    expect(highlightLevel(liderDeTeste({ archetype: "Newcomer", alert: "None" }))).toBe("forte");
    expect(highlightLevel(liderDeTeste({ archetype: "Rising", alert: "None", trendPercentage: 140 }))).toBe(
      "forte",
    );
    expect(highlightLevel(liderDeTeste({ archetype: "Rising", alert: "None", trendPercentage: 40 }))).toBe(
      "medio",
    );
    expect(highlightLevel(liderDeTeste({ archetype: "Steady", alert: "None" }))).toBeNull();
    expect(highlightLevel(liderDeTeste({ archetype: "Newcomer", alert: "LowCoverage" }))).toBeNull();
  });
});

describe("highlightLevel com tendencia AUSENTE", () => {
  it("quem saiu do zero e' o maior salto, nao o menor", () => {
    // A API OMITE `trendPercentage` quando nao havia ritmo anterior — ou seja,
    // quando o produto saiu do zero. Tratar a ausencia como 0% rebaixava
    // justamente o maior salto possivel: um item que foi de R$ 0 a R$ 310 em tres
    // semanas saltava MENOS que um que so dobrou.
    const doZero = liderDeTeste({ archetype: "Rising", alert: "None", earlierProfit: 0 });
    delete (doZero as { trendPercentage?: number | null }).trendPercentage;

    expect(highlightLevel(doZero)).toBe("forte");
  });
});

describe("describeDays", () => {
  it("concorda o singular", () => {
    expect(describeDays(1)).toBe("1 dia");
    expect(describeDays(90)).toBe("90 dias");
  });
});

describe("readPosition", () => {
  it("abre o lucro na multiplicacao que o produziu", () => {
    // O pedido central do dono: "R$ 237,33" nao distingue giro de valor, e os
    // dois pedem acoes opostas.
    const giro = readPosition(liderDeTeste({ profit: 222.75, units: 275, profitPerUnit: 0.81 }));
    const valor = readPosition(liderDeTeste({ profit: 150.48, units: 14, profitPerUnit: 10.75 }));

    expect(giro).toContain("275 peças");
    expect(giro).toContain("0,81");
    expect(valor).toContain("14 peças");
    expect(valor).toContain("10,75");
  });

  it("concorda o singular quando saiu uma peca so", () => {
    expect(readPosition(liderDeTeste({ units: 1 }))).toContain("1 peça ×");
  });
});

describe("readPerUnit", () => {
  it("situa a linha contra a regua do proprio corte", () => {
    expect(readPerUnit(liderDeTeste({ profitPerUnit: 12 }), 5)).toContain("Lucra bem em cada peça");
    expect(readPerUnit(liderDeTeste({ profitPerUnit: 0.81 }), 5)).toContain("compensa no giro");
    expect(readPerUnit(liderDeTeste({ profitPerUnit: 5 }), 5)).toBeNull();
  });

  it("cala quando nao ha regua", () => {
    expect(readPerUnit(liderDeTeste({ profitPerUnit: 12 }), 0)).toBeNull();
  });
});

describe("readArchetype", () => {
  it("diz de quanto para quanto, e nao so que caiu", () => {
    // "Perdendo ritmo" sozinho nao diz a magnitude, e e' ela que decide se vale
    // investigar agora ou esperar.
    const frase = readArchetype(
      liderDeTeste({
        archetype: "Declining",
        earlierProfit: 374.55,
        earlierDays: 67,
        recentProfit: 12.46,
        recentDays: 23,
      }),
    );

    expect(frase).toContain("5,59");
    expect(frase).toContain("0,54");
    expect(frase).toContain("23 dias");
  });

  it("o estreante se apresenta pela data da primeira venda", () => {
    const frase = readArchetype(
      liderDeTeste({ archetype: "Newcomer", firstSaleDate: "2026-08-28T14:00:00" }),
    );

    expect(frase).toContain("28/08/26");
  });

  it("periodo de um dia nao anuncia tendencia de ZERO dias", () => {
    // "Mes atual" no dia 1o, ou um Personalizado de um dia: o backend devolve
    // `recentDays: 0`, e a frase generica saia como "— nos ultimos 0 dias".
    const umDia = liderDeTeste({
      archetype: "Steady",
      earlierProfit: 250,
      earlierDays: 1,
      recentProfit: 0,
      recentDays: 0,
    });

    expect(readArchetype(umDia)).toBe("Período curto demais para comparar ritmo.");
  });

  it("o cavalo de batalha se apresenta pelas semanas", () => {
    const frase = readArchetype(
      liderDeTeste({ archetype: "Workhorse", weeksWithSales: 11, periodWeeks: 13 }),
    );

    expect(frase).toContain("11 das 13 semanas");
  });
});

describe("readAlert", () => {
  it("separa caiu COM estoque de caiu SEM estoque", () => {
    // Diagnosticos opostos: um manda investigar a procura, o outro manda comprar.
    // Troca-los manda comprar justamente o que esta encalhado.
    const parado = readAlert(liderDeTeste({ alert: "ParkedStock", stock: 24, stockCost: 264 }));
    const ruptura = readAlert(liderDeTeste({ alert: "StockOut", stock: 0 }));

    expect(parado).toContain("24 peças");
    expect(parado).toContain("264,00");
    expect(ruptura).toContain("faltar o que vender");
  });

  it("estoque curto sem saldo nenhum nao promete dias de cobertura", () => {
    const semSaldo = readAlert(liderDeTeste({ alert: "LowCoverage", stock: 0, coverageDays: 0 }));

    expect(semSaldo).toBe("Está vendendo e não há saldo em casa.");
  });

  it("linha sem alerta nao inventa frase", () => {
    expect(readAlert(liderDeTeste({ alert: "None" }))).toBeNull();
  });
});

describe("formatDay", () => {
  it("le a data como calendario, sem passar por fuso", () => {
    // `new Date("2026-03-05")` e' UTC e volta 04/03 no Brasil — a armadilha 2 do
    // repositorio, na direcao da leitura.
    expect(formatDay("2026-03-05T00:00:00")).toBe("05/03/26");
    expect(formatDay("2026-01-01")).toBe("01/01/26");
  });
});
