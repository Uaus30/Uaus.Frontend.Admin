import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HOME_SHORTCUTS } from "../shortcuts";
import { SHORTCUT_TONES, type ShortcutTone } from "../tones";
import { HomeShortcutGrid } from "../components/HomeShortcutGrid";

/**
 * As cores dos botões da tela inicial (24/10/2026): uma por botão, para o dono
 * achar a tela pela cor, sem pegar emprestado o vocabulário de estado do sistema.
 */

afterEach(cleanup);

const PALETTE = Object.keys(SHORTCUT_TONES) as ShortcutTone[];

/** Os pares de botões que se tocam numa grade de `columns` colunas: lado a lado e um embaixo do outro. */
function neighborPairs(columns: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < HOME_SHORTCUTS.length; i++) {
    const sameRow = (i + 1) % columns !== 0 && i + 1 < HOME_SHORTCUTS.length;
    if (sameRow) pairs.push([i, i + 1]);
    if (i + columns < HOME_SHORTCUTS.length) pairs.push([i, i + columns]);
  }
  return pairs;
}

describe("cores dos atalhos", () => {
  it("cada botão tem a sua cor, sem repetir", () => {
    // Duas telas com a mesma cor desfazem o ponto: "o azul" voltaria a exigir
    // ler o rótulo.
    const tones = HOME_SHORTCUTS.map((s) => s.tone);

    expect(new Set(tones).size).toBe(HOME_SHORTCUTS.length);
  });

  it("nenhuma cor da paleta é cor de estado (verde, âmbar, vermelho, cinza) nem vizinha dela", () => {
    // Verde, âmbar e vermelho dizem positivo, atenção e negativo em todo o
    // sistema (Uaus.Docs/dominio/convencoes-de-interface.md); um "Estoque" âmbar
    // leria como alerta. Esmeralda, amarelo, lima e rosa-avermelhado se
    // confundem com eles de relance.
    const proibidas =
      /\b(?:\w+:)?(?:bg|from|to|via|border|shadow|text)-(?:green|emerald|lime|amber|yellow|red|rose|gray|slate|zinc|neutral|stone|destructive|muted)\b/;

    for (const [tone, classes] of Object.entries(SHORTCUT_TONES)) {
      for (const classe of Object.values(classes)) expect(classe, tone).not.toMatch(proibidas);
    }
  });

  it.each([2, 4])("com %i colunas, botões vizinhos não têm matizes vizinhos", (columns) => {
    // A paleta está em ordem de matiz; vizinhas nela (azul e índigo, ciano e
    // céu) se confundem, então não podem cair em botões que se tocam — nem no
    // celular (duas colunas) nem no desktop (quatro).
    for (const [a, b] of neighborPairs(columns)) {
      const distance = Math.abs(
        PALETTE.indexOf(HOME_SHORTCUTS[a].tone) - PALETTE.indexOf(HOME_SHORTCUTS[b].tone),
      );

      expect(distance, `${HOME_SHORTCUTS[a].label} × ${HOME_SHORTCUTS[b].label}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("o cartão desenha a cor do próprio atalho, no ícone e na borda", () => {
    render(<HomeShortcutGrid shortcuts={HOME_SHORTCUTS} />);

    const links = within(screen.getByRole("navigation", { name: "Atalhos" })).getAllByRole("link");
    HOME_SHORTCUTS.forEach((atalho, i) => {
      const colors = SHORTCUT_TONES[atalho.tone];

      expect(links[i].getAttribute("data-tone")).toBe(atalho.tone);
      expect(links[i].className).toContain(colors.border);
      expect(links[i].innerHTML).toContain(colors.icon);
    });
  });
});
