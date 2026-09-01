import { describe, expect, it } from "vitest";
import { ROUTES } from "@/routes";
import { TITULO_DO_APP, comporTitulo, nomeDaTela } from "../route-title";

describe("nomeDaTela", () => {
  it("acha a tela pelo caminho exato", () => {
    expect(nomeDaTela("/produtos")).toBe("Produtos");
  });

  it("acha a tela a partir de um caminho FILHO", () => {
    // É o caso do detalhe do produto: `/produtos/709/detalhes` é a mesma tela,
    // e sem isto o histórico voltaria a mostrar o título genérico do app.
    expect(nomeDaTela("/produtos/709/detalhes")).toBe("Produtos");
  });

  it("prefere o caminho mais LONGO que casa", () => {
    // `/estoque/entradas` não pode virar "Estoque" só porque outra rota é
    // prefixo dela. Sem a ordenação por comprimento, quem ganharia seria a
    // ordem de declaração — que ninguém pensa em manter estável.
    const entradas = ROUTES.find((rota) => rota.path === "/estoque/entradas");

    expect(entradas?.label).toBeTruthy();
    expect(nomeDaTela("/estoque/entradas")).toBe(entradas?.label);
  });

  it("devolve null para caminho que não é de rota conhecida", () => {
    expect(nomeDaTela("/nao-existe")).toBeNull();
  });

  it("não inventa nome para rota sem label", () => {
    // Rota sem `label` não aparece no menu e não tem nome para o histórico.
    const semLabel = ROUTES.find((rota) => !rota.label);

    if (semLabel) expect(nomeDaTela(semLabel.path)).not.toBe("");
  });
});

describe("comporTitulo", () => {
  it("põe o nome da tela ANTES do nome do app", () => {
    // O histórico e a aba cortam o fim: "Produtos · Uaus Admin" continua
    // legível numa aba estreita, "Uaus Admin · Produtos" vira "Uaus Admi…" em
    // todas as telas — que é exatamente o problema que o título fixo criava.
    expect(comporTitulo("Produtos")).toBe(`Produtos · ${TITULO_DO_APP}`);
  });

  it("cai no nome do app quando não há tela", () => {
    expect(comporTitulo(null)).toBe(TITULO_DO_APP);
    expect(comporTitulo(undefined)).toBe(TITULO_DO_APP);
    expect(comporTitulo("   ")).toBe(TITULO_DO_APP);
  });
});

describe("cobertura das rotas", () => {
  it("toda rota do menu tem nome para o histórico", () => {
    // O título sai do `label` do routes.ts — a mesma fonte do menu. Rota nova
    // ganha título sozinha; este teste é o que garante que ela não fica muda.
    const semNome = ROUTES.filter((rota) => rota.label && !nomeDaTela(rota.path));

    expect(semNome.map((rota) => rota.path)).toEqual([]);
  });
});
