import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreGauge } from "../ScoreGauge";

/**
 * O medidor da nota.
 *
 * O que está protegido é o que quebra EM SILÊNCIO: o arco que não desenha porque
 * a variável de cor não é uma cor, e o número que fica parado em zero porque a
 * animação nunca dispara. Nenhum dos dois gera erro no console — os dois fazem a
 * tela mentir.
 */
describe("ScoreGauge", () => {
  it("desenha o arco com cor de verdade, e não com a variável crua", () => {
    // `--muted` é `222 47% 13%`, e não uma cor: `var(--muted)` em SVG resolve
    // para `none` e o arco some sem erro nenhum. O certo é `hsl(var(--x))`.
    const { container } = render(<ScoreGauge score={71} />);

    const cores = [...container.querySelectorAll("[stroke], [fill]")].flatMap((el) =>
      [el.getAttribute("stroke"), el.getAttribute("fill")].filter(Boolean),
    );

    expect(cores.length).toBeGreaterThan(0);
    expect(cores.filter((c) => c!.startsWith("var(--"))).toEqual([]);
  });

  it("a extensão do arco aceso é a nota, e não uma animação que pode nunca rodar", async () => {
    const { container } = render(<ScoreGauge score={71} />);

    // O disparo é `setTimeout`, porque o navegador embutido do app não roda
    // `requestAnimationFrame` — com `rAF` o medidor ficaria em zero para sempre.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const aceso = container.querySelectorAll("path")[1];
    const total = Number(aceso.getAttribute("stroke-dasharray"));
    const restante = Number(aceso.getAttribute("stroke-dashoffset"));

    expect(total).toBeGreaterThan(0);
    expect(1 - restante / total).toBeCloseTo(0.71, 2);
  });

  it("mostra a nota com uma casa e a palavra da faixa", () => {
    render(<ScoreGauge score={6.75} rotulo="Parado" />);

    // 6,8 e não 7: a casa decimal é o que separa um parado do outro no ranking.
    expect(screen.getByText("6,8")).toBeTruthy();
    expect(screen.getByText("Parado")).toBeTruthy();
    expect(screen.getByLabelText("Nota 6,8 de 100 — Parado")).toBeTruthy();
  });

  it("nota fora da escala não estoura o arco", () => {
    const { container } = render(<ScoreGauge score={140} />);
    const aceso = container.querySelectorAll("path")[1];

    expect(Number(aceso.getAttribute("stroke-dashoffset"))).toBeGreaterThanOrEqual(0);
    expect(screen.getByText("100,0")).toBeTruthy();
  });
});
