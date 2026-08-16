import { afterEach, describe, expect, it, vi } from "vitest";
import { adminBaseUrl, adminHomeUrl, adminProductSearchUrl, openInNewTab } from "./admin-links";

/** Coloca o PDV num endereço específico, como se estivesse servido dali. */
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

describe("adminBaseUrl", () => {
  it("troca o subdomínio pdv por admin", () => {
    // REGRESSÃO: caía em window.location.origin e o menu "Painel
    // Administrativo" abria outra aba do PRÓPRIO PDV. O link funcionava — só
    // apontava para o lugar errado, que ninguém reporta como erro.
    servidoEm("https://pdv.uaus.com.br/");

    expect(adminBaseUrl()).toBe("https://admin.uaus.com.br");
  });

  it("troca apenas o primeiro rótulo, preservando o ambiente", () => {
    // Homologação tem que apontar para o admin DE HOMOLOGAÇÃO. Trocar o domínio
    // inteiro mandaria o operador de teste editar produto em produção.
    servidoEm("https://pdv.homolog.uaus.com.br/");

    expect(adminBaseUrl()).toBe("https://admin.homolog.uaus.com.br");
  });

  it("preserva a porta quando o host tem uma", () => {
    servidoEm("https://pdv.uaus.com.br:8443/");

    expect(adminBaseUrl()).toBe("https://admin.uaus.com.br:8443");
  });

  it("mapeia a porta do dev server do PDV para a do admin", () => {
    servidoEm("http://localhost:5174/");

    expect(adminBaseUrl()).toBe("http://localhost:5173");
  });

  it("VITE_ADMIN_URL vence a derivação", () => {
    vi.stubEnv("VITE_ADMIN_URL", "https://retaguarda.outracoisa.com/");
    servidoEm("https://pdv.uaus.com.br/");

    // A barra final sai: quem monta o caminho é este módulo, e "//produtos"
    // quebraria a rota no admin.
    expect(adminBaseUrl()).toBe("https://retaguarda.outracoisa.com");
  });

  it("devolve null no host que não segue nenhum dos padrões", () => {
    // Preview local, IP na rede da loja, domínio próprio. Cair na origem aqui
    // reabriria o PDV — que é exatamente o defeito que este módulo corrige.
    servidoEm("http://192.168.0.42:4173/");

    expect(adminBaseUrl()).toBeNull();
  });

  it("devolve null sem window", () => {
    vi.stubGlobal("window", undefined);

    expect(adminBaseUrl()).toBeNull();
  });
});

describe("adminHomeUrl e adminProductSearchUrl", () => {
  it("montam o caminho sobre a base derivada", () => {
    servidoEm("https://pdv.uaus.com.br/");

    expect(adminHomeUrl()).toBe("https://admin.uaus.com.br/");
    expect(adminProductSearchUrl("Café 500g")).toBe(
      "https://admin.uaus.com.br/produtos?busca=Caf%C3%A9%20500g",
    );
  });

  it("escapam o termo de busca", () => {
    // Código de barras com & ou # viraria outro parâmetro na query.
    servidoEm("https://pdv.uaus.com.br/");

    expect(adminProductSearchUrl("a&b#c")).toContain("busca=a%26b%23c");
  });

  it("propagam o null em vez de montar um caminho sobre a origem errada", () => {
    servidoEm("http://192.168.0.42:4173/");

    expect(adminHomeUrl()).toBeNull();
    expect(adminProductSearchUrl("qualquer")).toBeNull();
  });
});

describe("openInNewTab", () => {
  it("abre com noopener", () => {
    // Sem noopener a página aberta recebe window.opener e pode navegar a aba do
    // PDV — com o caixa aberto e uma venda na tela.
    servidoEm("https://pdv.uaus.com.br/");

    openInNewTab("https://admin.uaus.com.br/");

    expect(window.open).toHaveBeenCalledWith(
      "https://admin.uaus.com.br/",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("não abre nada quando a URL é null", () => {
    // É o que impede o clique de virar aba em branco quando o admin não é
    // alcançável.
    servidoEm("https://pdv.uaus.com.br/");

    openInNewTab(null);

    expect(window.open).not.toHaveBeenCalled();
  });
});
