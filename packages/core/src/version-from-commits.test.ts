/**
 * Teste da regra que transforma a contagem de commits na versão exibida.
 *
 * A regra mora em `scripts/version-from-commits.js`, e não neste pacote, porque
 * quem a consome roda antes do app existir: o hook `pre-commit` e o
 * `vite.config.ts` dos três workspaces. O teste mora aqui porque `scripts/` não
 * tem suíte própria e este é o pacote onde o repositório já guarda as regras
 * puras que mais de um app precisa calcular igual.
 */
import { describe, expect, it } from "vitest";
import { versionFromCommitCount } from "../../../scripts/version-from-commits.js";

describe("versionFromCommitCount", () => {
  it("distribui os dígitos da contagem nos três campos do semver", () => {
    expect(versionFromCommitCount(188)).toBe("1.8.8");
    expect(versionFromCommitCount(189)).toBe("1.8.9");
  });

  it("mantém no major todos os dígitos que sobram acima de mil commits", () => {
    expect(versionFromCommitCount(1025)).toBe("10.2.5");
    expect(versionFromCommitCount(12345)).toBe("123.4.5");
  });

  it("completa com zero à esquerda a contagem com menos de três dígitos", () => {
    expect(versionFromCommitCount(0)).toBe("0.0.0");
    expect(versionFromCommitCount(5)).toBe("0.0.5");
    expect(versionFromCommitCount(42)).toBe("0.4.2");
  });

  it("preserva a ordem do semver nas viradas de faixa", () => {
    // É o que garante que "a versão maior é a mais nova" continue verdade: sem
    // isso, comparar duas versões da tela não diria mais qual delas é o deploy
    // mais recente.
    expect(versionFromCommitCount(99)).toBe("0.9.9");
    expect(versionFromCommitCount(100)).toBe("1.0.0");
    expect(versionFromCommitCount(999)).toBe("9.9.9");
    expect(versionFromCommitCount(1000)).toBe("10.0.0");
  });

  it("nunca regride: cada commit a mais é uma versão maior que a anterior", () => {
    const ordem = (v: string) => v.split(".").map(Number);
    let anterior = ordem(versionFromCommitCount(0));

    for (let count = 1; count <= 1200; count++) {
      const atual = ordem(versionFromCommitCount(count));
      const maior =
        atual[0] > anterior[0] ||
        (atual[0] === anterior[0] &&
          (atual[1] > anterior[1] || (atual[1] === anterior[1] && atual[2] > anterior[2])));
      expect(maior, `contagem ${count} não é maior que a anterior`).toBe(true);
      anterior = atual;
    }
  });

  it("cai em 0.0.0 quando a contagem não é um número utilizável", () => {
    // Acontece quando o `git rev-list` falha (repositório sem histórico, clone
    // superficial): o chamador recorre ao package.json, mas a regra não pode
    // devolver "NaN.a.N" nesse caminho.
    expect(versionFromCommitCount(Number.NaN)).toBe("0.0.0");
    expect(versionFromCommitCount(-7)).toBe("0.0.0");
  });
});
