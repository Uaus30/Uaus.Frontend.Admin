import { afterEach, describe, expect, it, vi } from "vitest";
import { pdvBaseUrl, pdvHomeUrl } from "../pdv-links";

/** Coloca o admin num endereço específico, como se estivesse servido dali. */
function servidoEm(href: string) {
  const url = new URL(href);

  vi.stubGlobal("window", {
    location: {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      origin: url.origin,
    },
    open: vi.fn(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("pdvBaseUrl", () => {
  it("troca o subdomínio admin por pdv", () => {
    servidoEm("https://admin.uaus.com.br/");

    expect(pdvBaseUrl()).toBe("https://pdv.uaus.com.br");
  });

  it("troca apenas o primeiro rótulo, preservando o ambiente", () => {
    // O admin de homologação tem que abrir o PDV DE HOMOLOGAÇÃO. Trocar o
    // domínio inteiro mandaria quem testa registrar venda em produção.
    servidoEm("https://admin.homolog.uaus.com.br/");

    expect(pdvBaseUrl()).toBe("https://pdv.homolog.uaus.com.br");
  });

  it("preserva a porta quando o host tem uma", () => {
    servidoEm("https://admin.uaus.com.br:8443/");

    expect(pdvBaseUrl()).toBe("https://pdv.uaus.com.br:8443");
  });

  it("mapeia a porta do dev server do admin para a do PDV", () => {
    servidoEm("http://localhost:5173/");

    expect(pdvBaseUrl()).toBe("http://localhost:5174");
  });

  it("VITE_PDV_URL vence a derivação", () => {
    vi.stubEnv("VITE_PDV_URL", "https://caixa.outracoisa.com/");
    servidoEm("https://admin.uaus.com.br/");

    // A barra final sai: quem monta o caminho é este módulo, e "//" quebraria a
    // rota no PDV.
    expect(pdvBaseUrl()).toBe("https://caixa.outracoisa.com");
  });

  it("devolve null no host que não segue nenhum dos padrões", () => {
    // Preview local, IP na rede da loja, domínio próprio. Cair na origem aqui
    // reabriria o admin, e cravar o endereço de produção abriria o caixa REAL a
    // partir do ambiente de teste.
    servidoEm("http://192.168.0.42:4173/");

    expect(pdvBaseUrl()).toBeNull();
  });

  it("devolve null sem window", () => {
    vi.stubGlobal("window", undefined);

    expect(pdvBaseUrl()).toBeNull();
  });
});

describe("pdvHomeUrl", () => {
  it("monta a raiz sobre a base derivada", () => {
    servidoEm("https://admin.uaus.com.br/");

    expect(pdvHomeUrl()).toBe("https://pdv.uaus.com.br/");
  });

  it("propaga o null em vez de montar um caminho sobre a origem errada", () => {
    // É o que faz o botão sumir em vez de virar uma aba do próprio admin.
    servidoEm("http://192.168.0.42:4173/");

    expect(pdvHomeUrl()).toBeNull();
  });
});
