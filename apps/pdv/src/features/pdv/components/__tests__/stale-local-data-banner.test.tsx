import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaleLocalDataBanner } from "../stale-local-data-banner";

describe("StaleLocalDataBanner", () => {
  it("sem dia velho, não ocupa a tela", () => {
    const { container } = render(<StaleLocalDataBanner since={null} />);
    expect(container.textContent).toBe("");
  });

  it("diz o dia do caixa e o que fazer, como alerta", () => {
    render(<StaleLocalDataBanner since="06/10/2026" />);

    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("o caixa e os preços de 06/10/2026");
    expect(alerta.textContent).toContain("conecte e abra o PDV antes de vender");
  });

  it("no celular deitado, cabe numa linha baixa, com o texto curto", () => {
    // Junto da faixa do offline, duas linhas aqui comiam a lista do carrinho e
    // cortavam o FINALIZAR num Android de 360px de altura (07/10/2026).
    render(<StaleLocalDataBanner since="06/10/2026" compact />);

    const alerta = screen.getByRole("alert");
    expect(alerta.className).toContain("h-7");
    expect(alerta.querySelector("span")?.className).toContain("truncate");
    expect(alerta.textContent).toContain("Caixa e preços de 06/10/2026");
    expect(alerta.textContent).not.toContain("conecte e abra o PDV");
  });
});
