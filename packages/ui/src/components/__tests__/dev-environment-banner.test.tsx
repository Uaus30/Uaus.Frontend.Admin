import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { DevEnvironmentBanner } from "../dev-environment-banner";
import { isDevEnvironment } from "../../lib/environment";

/**
 * O que estes testes protegem.
 *
 * A faixa existe para impedir que alguém opere em produção achando que está em
 * dev. O erro que custa caro é o falso negativo — produção sem faixa, ou pior,
 * um host novo que ninguém cadastrou passando por produção. Por isso o alvo dos
 * testes é a REGRA de host, e não a aparência: os hosts de produção
 * (`admin.uaus.com.br`, `pdv.uaus.com.br` e o site público em `uaus.com.br` /
 * `www.uaus.com.br`) são os únicos que não mostram a faixa; qualquer outro
 * mostra.
 */
describe("isDevEnvironment", () => {
  it("nao acusa desenvolvimento nos hosts de producao", () => {
    expect(isDevEnvironment("admin.uaus.com.br")).toBe(false);
    expect(isDevEnvironment("pdv.uaus.com.br")).toBe(false);
    expect(isDevEnvironment("uaus.com.br")).toBe(false);
    expect(isDevEnvironment("www.uaus.com.br")).toBe(false);
  });

  it("acusa desenvolvimento nos dominios de dev, previews e local", () => {
    expect(isDevEnvironment("admin-dev.uaus.com.br")).toBe(true);
    expect(isDevEnvironment("pdv-dev.uaus.com.br")).toBe(true);
    expect(isDevEnvironment("loja-dev.uaus.com.br")).toBe(true);
    expect(isDevEnvironment("front-admin-git-dev-uaus.vercel.app")).toBe(true);
    expect(isDevEnvironment("localhost")).toBe(true);
  });

  it("ignora caixa no host, que o navegador nao garante", () => {
    expect(isDevEnvironment("ADMIN.UAUS.COM.BR")).toBe(false);
  });

  it("sem host nao afirma desenvolvimento", () => {
    // Render fora do navegador não tem como saber onde está; supor "dev" aqui
    // colocaria a faixa em produção.
    expect(isDevEnvironment("")).toBe(false);
  });
});

describe("DevEnvironmentBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra a faixa fora de producao", () => {
    vi.stubGlobal("location", { ...window.location, hostname: "admin-dev.uaus.com.br" });

    render(<DevEnvironmentBanner />);

    expect(screen.getByText("AMBIENTE DE DESENVOLVIMENTO")).toBeTruthy();
  });

  it("nao renderiza nada em producao", () => {
    vi.stubGlobal("location", { ...window.location, hostname: "admin.uaus.com.br" });

    const { container } = render(<DevEnvironmentBanner />);

    expect(container.innerHTML).toBe("");
  });
});
