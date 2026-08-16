import { describe, expect, it } from "vitest";
import { USER_ROLE } from "@workspace/api-client-react";
import { MENU_GROUPS, ROUTES, buildMenu, podeAcessar } from "../routes";

/**
 * Contrato do arquivo de rotas.
 *
 * O que está sendo protegido: menu e rota saem da MESMA lista. Enquanto eram
 * duas listas mantidas à mão, elas divergiram — a tela de formas de pagamento
 * respondia em dois caminhos e só um aparecia no menu.
 *
 * E a autorização: `USER_ROLE` existia no api-client sem um único uso no admin,
 * então um Vendedor autenticado navegava para `/sistema/usuarios` e
 * `/financeiro/socios`.
 */

/** Rotas que um operador de caixa não pode abrir. */
const RESTRITAS = [
  "/sistema/usuarios",
  "/sistema/logs",
  "/financeiro/socios",
  "/financeiro/fechamentos",
  "/financeiro/custos-fixos",
  "/financeiro/relatorios",
  "/configuracoes",
  // Marketing inteiro é Admin: todas as actions de CouponsController e
  // CampaignsController são [Authorize(Role.Admin)], e papel de marketing está
  // declarado fora de escopo. Sem isto o Vendedor veria o menu e tomaria 403.
  "/marketing/cupons",
  "/marketing/campanhas",
  "/marketing/campanhas/comparativo",
];

describe("declaração das rotas", () => {
  it("não tem caminho duplicado", () => {
    const paths = ROUTES.map((r) => r.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it("toda rota do menu declara rótulo e destino", () => {
    for (const route of ROUTES.filter((r) => r.label && !r.hidden)) {
      expect(route.path).toMatch(/^\//);
      expect(route.label?.trim()).toBeTruthy();
    }
  });

  it("todo grupo declarado numa rota existe no menu", () => {
    // Um grupo com erro de digitação sumiria do menu em silêncio.
    const conhecidos = MENU_GROUPS.map((g) => g.name);

    for (const route of ROUTES.filter((r) => r.group)) {
      expect(conhecidos).toContain(route.group);
    }
  });

  it("caminho literal vem antes do parametrizado no mesmo prefixo", () => {
    // O `<Switch>` do wouter para no PRIMEIRO casamento. Hoje as duas rotas de
    // campanha têm contagem de segmentos diferente e não colidem; a ordem é o
    // que mantém isso verdadeiro quando alguém acrescentar
    // `/marketing/campanhas/novo`.
    const indices = (path: string) => ROUTES.findIndex((r) => r.path === path);

    expect(indices("/marketing/campanhas/comparativo")).toBeGreaterThan(-1);
    expect(indices("/marketing/campanhas/comparativo")).toBeLessThan(
      indices("/marketing/campanhas/:id/relatorio"),
    );
  });

  it("só /login é pública", () => {
    expect(ROUTES.filter((r) => r.publica).map((r) => r.path)).toEqual(["/login"]);
  });
});

describe("podeAcessar", () => {
  it("rota sem restrição vale para qualquer papel", () => {
    const produtos = ROUTES.find((r) => r.path === "/produtos")!;

    expect(podeAcessar(produtos, USER_ROLE.Admin)).toBe(true);
    expect(podeAcessar(produtos, USER_ROLE.Seller)).toBe(true);
  });

  it.each(RESTRITAS)("recusa %s para o papel Vendedor", (path) => {
    const route = ROUTES.find((r) => r.path === path)!;

    expect(route.roles).toBeDefined();
    expect(podeAcessar(route, USER_ROLE.Seller)).toBe(false);
    expect(podeAcessar(route, USER_ROLE.Admin)).toBe(true);
  });

  it("recusa rota restrita para papel indefinido", () => {
    const socios = ROUTES.find((r) => r.path === "/financeiro/socios")!;

    expect(podeAcessar(socios, undefined)).toBe(false);
  });

  it("o detalhe do log herda a restrição da listagem", () => {
    // Proteger a lista e esquecer o detalhe deixaria a porta dos fundos aberta.
    const detalhe = ROUTES.find((r) => r.path === "/sistema/logs/:id")!;

    expect(podeAcessar(detalhe, USER_ROLE.Seller)).toBe(false);
  });

  it("o relatório de campanha herda a restrição da listagem", () => {
    // Mesmo motivo do detalhe do log: a rota é oculta, mas continua respondendo
    // por link colado. Sem `roles` aqui, o Vendedor abriria o faturamento e o
    // lucro da loja inteira (o denominador do relatório), que o menu esconde.
    const relatorio = ROUTES.find((r) => r.path === "/marketing/campanhas/:id/relatorio")!;

    expect(relatorio.roles).toBeDefined();
    expect(podeAcessar(relatorio, USER_ROLE.Seller)).toBe(false);
    expect(podeAcessar(relatorio, USER_ROLE.Admin)).toBe(true);
  });
});

describe("buildMenu", () => {
  it("esconde do Vendedor o que ele não pode abrir", () => {
    const menu = buildMenu(USER_ROLE.Seller);
    const hrefs = menu.flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    for (const restrita of RESTRITAS) {
      expect(hrefs).not.toContain(restrita);
    }
  });

  it("mostra ao Admin tudo que o Vendedor vê, e mais", () => {
    const admin = buildMenu(USER_ROLE.Admin);
    const seller = buildMenu(USER_ROLE.Seller);

    const contar = (menu: ReturnType<typeof buildMenu>) =>
      menu.reduce((n, item) => n + (item.items ? item.items.length : 1), 0);

    expect(contar(admin)).toBeGreaterThan(contar(seller));
  });

  it("some com o grupo cujos itens são todos restritos", () => {
    // "Sistema" só tem telas de Admin; mostrá-lo vazio ao Vendedor seria pior
    // que não mostrar.
    const menu = buildMenu(USER_ROLE.Seller);

    expect(menu.find((item) => item.name === "Sistema")).toBeUndefined();
    // "Marketing" está na mesma situação: as três telas são de Admin.
    expect(menu.find((item) => item.name === "Marketing")).toBeUndefined();
  });

  it("o Admin vê o grupo Marketing com as três telas", () => {
    const menu = buildMenu(USER_ROLE.Admin);
    const marketing = menu.find((item) => item.name === "Marketing");

    expect(marketing?.items?.map((s) => s.href)).toEqual([
      "/marketing/cupons",
      "/marketing/campanhas",
      "/marketing/campanhas/comparativo",
    ]);
  });

  it("começa pelo Dashboard", () => {
    expect(buildMenu(USER_ROLE.Admin)[0].name).toBe("Dashboard");
  });

  it("não mostra rota oculta", () => {
    const menu = buildMenu(USER_ROLE.Admin);
    const hrefs = menu.flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    // O caminho antigo de formas de pagamento continua respondendo, mas fora do
    // menu: a mesma tela em dois lugares confundiria.
    expect(hrefs).not.toContain("/formas-pagamento");
    expect(hrefs).toContain("/financeiro/formas-pagamento");
    expect(hrefs).not.toContain("/login");
  });

  it("todo item do menu corresponde a uma rota declarada", () => {
    const paths = new Set(ROUTES.map((r) => r.path));
    const menu = buildMenu(USER_ROLE.Admin);
    const hrefs = menu.flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    // A invariante que o arquivo único existe para garantir: menu e rota não
    // podem divergir nem por um caractere.
    for (const href of hrefs) expect(paths).toContain(href);
  });
});
