import { afterEach, describe, expect, it } from "vitest";
import { isSaleInFuture, isSaleToday, joinSaleWhen, nowSaleWhen, splitApiDateTime } from "../sale-when";

const fusoOriginal = process.env.TZ;

afterEach(() => {
  process.env.TZ = fusoOriginal;
});

describe("data e hora da venda", () => {
  it("corta a data da API sem passar por new Date — a hora não muda em aparelho fora de Brasília", () => {
    // O CI roda em UTC: com new Date() a hora de 14:32 viraria outra.
    process.env.TZ = "UTC";

    expect(splitApiDateTime("2026-10-05T14:32:10")).toEqual({ date: "2026-10-05", time: "14:32" });
    expect(splitApiDateTime("2026-10-05T14:32:10.123")).toEqual({ date: "2026-10-05", time: "14:32" });
  });

  it("monta o horário da loja sem fuso, no formato que a API grava", () => {
    expect(joinSaleWhen({ date: "2026-10-04", time: "15:20" })).toBe("2026-10-04T15:20:00");
    expect(joinSaleWhen({ date: "2026-10-04", time: "" })).toBe("2026-10-04T00:00:00");
  });

  it("ida e volta preserva a data e a hora até o minuto", () => {
    expect(joinSaleWhen(splitApiDateTime("2026-09-30T23:59:59"))).toBe("2026-09-30T23:59:00");
  });

  it("sabe se é de hoje e se está no futuro", () => {
    const agora = new Date(2026, 9, 6, 15, 0, 0);

    expect(nowSaleWhen(agora)).toEqual({ date: "2026-10-06", time: "15:00" });
    expect(isSaleToday({ date: "2026-10-06", time: "09:00" }, agora)).toBe(true);
    expect(isSaleToday({ date: "2026-10-05", time: "09:00" }, agora)).toBe(false);
    expect(isSaleInFuture({ date: "2026-10-06", time: "15:01" }, agora)).toBe(true);
    expect(isSaleInFuture({ date: "2026-10-06", time: "15:00" }, agora)).toBe(false);
    expect(isSaleInFuture({ date: "2026-10-07", time: "00:00" }, agora)).toBe(true);
  });
});
