import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O zoom com dois dedos voltou ao admin em 06/10/2026 (decisão do dono): saiu o
 * `maximum-scale=1` do `index.html`. Ele também impedia o Safari do iPhone de
 * AMPLIAR a tela ao focar um campo com fonte menor que 16px — e isso agora
 * depende só da regra do `index.css`. O jsdom não avalia `@media`, então o teste
 * confere a regra no texto: quem a apagar ou estreitar fica sabendo aqui, e não
 * pela tela ampliada no celular do dono.
 */
/** A raiz do Vitest é `apps/admin` ou a do monorepo, conforme quem roda (ver `app-install.test.ts`). */
function arquivoDoApp(relativo: string): string {
  const candidatos = [resolve(process.cwd(), relativo), resolve(process.cwd(), `apps/admin/${relativo}`)];
  const encontrado = candidatos.find(existsSync);
  if (!encontrado) throw new Error(`${relativo} não encontrado em: ${candidatos.join(", ")}`);
  return readFileSync(encontrado, "utf8");
}

const css = arquivoDoApp("src/index.css");
const html = arquivoDoApp("index.html");

function regraDoCelular(): string {
  const inicio = css.indexOf("@media (max-width: 767.98px)");
  expect(inicio).toBeGreaterThan(-1);
  return css.slice(inicio, css.indexOf("font-size: 16px", inicio) + "font-size: 16px".length);
}

describe("fonte dos campos no celular", () => {
  it("o viewport não bloqueia mais o zoom", () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1];

    expect(viewport).toBe("width=device-width, initial-scale=1.0");
  });

  it("todo tipo de campo ganha 16px — inclusive o editor de texto rico das Tarefas", () => {
    const regra = regraDoCelular();

    expect(regra).toContain("input:not(");
    expect(regra).toContain("textarea");
    expect(regra).toContain("select");
    // O TipTap das Tarefas (descrição, solução, comentários) é `contenteditable`.
    expect(regra).toContain('[contenteditable]:not([contenteditable="false"])');
  });

  it("é um piso: campo que já é maior não encolhe", () => {
    expect(regraDoCelular()).toContain('[class*="text-lg"]');
  });

  it("fica fora de @layer, para vencer o text-sm e o text-[13px] que o chamador passa", () => {
    const antes = css.slice(0, css.indexOf("@media (max-width: 767.98px)"));
    const abertas = (antes.match(/@layer[^{]*\{/g) ?? []).length;
    // Toda camada aberta antes da regra já fechou: as chaves se equilibram.
    const chaves = [...antes].reduce((saldo, c) => saldo + (c === "{" ? 1 : c === "}" ? -1 : 0), 0);

    expect(abertas).toBeGreaterThan(0);
    expect(chaves).toBe(0);
  });
});
