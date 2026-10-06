import { describe, expect, it } from "vitest";
import { closedPeriodNotice, findClosing } from "../closed-periods";

const setembro = { id: 3, periodStart: "2026-09-01T00:00:00", periodEnd: "2026-09-30T00:00:00" };

describe("findClosing — o fechamento que cobre o dia (06/10/2026)", () => {
  it("o primeiro e o último dia do período estão dentro; o dia seguinte, fora", () => {
    expect(findClosing([setembro], "2026-09-01")).toBe(setembro);
    expect(findClosing([setembro], "2026-09-30")).toBe(setembro);
    expect(findClosing([setembro], "2026-10-01")).toBeNull();
    expect(findClosing([setembro], "2026-08-31")).toBeNull();
  });

  it("sem fechamento ou sem data, nada", () => {
    expect(findClosing([], "2026-09-15")).toBeNull();
    expect(findClosing([setembro], "")).toBeNull();
  });

  it("o aviso diz o período na data da loja, sem passar por fuso", () => {
    // Fora de Brasília, um `new Date("2026-09-01T00:00:00")` viraria 31/08.
    expect(closedPeriodNotice(setembro)).toContain("de 01/09/2026 a 30/09/2026");
    expect(closedPeriodNotice(setembro)).toContain("desatualizado");
  });
});
