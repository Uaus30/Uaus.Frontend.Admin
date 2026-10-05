import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ROUTES } from "@/routes";
import { AnomaliesShortcut } from "../AnomaliesShortcut";
import { PRODUCT_ANOMALIES_PATH } from "../../anomalies-route";

afterEach(cleanup);

describe("AnomaliesShortcut", () => {
  it("leva à tela BI › Anomalias", () => {
    // O atalho da listagem de produtos (05/10/2026).
    render(<AnomaliesShortcut />);

    const link = screen.getByRole("link", { name: /Anomalias/ });
    expect(link.getAttribute("href")).toBe("/bi/anomalias");
    expect(PRODUCT_ANOMALIES_PATH).toBe("/bi/anomalias");
  });

  it("aponta para a MESMA rota que o menu declara", () => {
    // Rota e atalho saem da mesma constante; um rename numa ponta só levaria o
    // botão à 404.
    const rota = ROUTES.find((r) => r.path === PRODUCT_ANOMALIES_PATH);

    expect(rota?.label).toBe("Anomalias");
    expect(rota?.group).toBe("BI");
  });
});
