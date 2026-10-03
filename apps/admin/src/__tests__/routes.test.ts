import { describe, expect, it } from "vitest";
import { MENU_GROUPS, MENU_ORDER, ROUTES, buildMenu } from "../routes";

/**
 * Contrato do arquivo de rotas.
 *
 * O que está sendo protegido: menu e rota saem da MESMA lista. Enquanto eram
 * duas listas mantidas à mão, elas divergiram — a tela de formas de pagamento
 * respondia em dois caminhos e só um aparecia no menu.
 *
 * Não há autorização por perfil para conferir aqui: não existe perfil de
 * usuário (decisão do dono, 03/10/2026). Toda rota privada abre para quem tem
 * sessão, e o menu mostra todas as visíveis.
 */

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

describe("buildMenu", () => {
  it("o grupo BI fica em ordem ALFABÉTICA, e não na ordem de entrega", () => {
    // As telas de BI não têm sequência de trabalho entre si — nenhuma é "a
    // próxima" depois da outra, como Compras é depois de Produtos. A ordem de
    // entrega só é previsível para quem acompanhou as entregas; a do alfabeto é
    // previsível para quem está procurando um nome numa lista.
    const bi = buildMenu().find((item) => item.name === "BI");
    const nomes = bi?.items?.map((s) => s.name) ?? [];

    expect(nomes).toEqual([
      "Analytics",
      "Anomalias",
      "Curva ABC de Produtos",
      "Desempenho de Fornecedores",
      "Desempenho de Produtos",
      "O que mudou",
      "O que trouxe lucro",
    ]);
    expect(bi?.items?.map((s) => s.href)).toEqual([
      "/bi/analytics",
      "/bi/anomalias",
      "/bi/curva-abc",
      "/bi/fornecedores",
      "/bi/produtos",
      "/bi/o-que-mudou",
      "/bi/o-que-trouxe-lucro",
    ]);

    const alfabetica = [...nomes].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }),
    );
    expect(nomes).toEqual(alfabetica);
  });

  it("Sistema abre com Tarefas antes de Configurações e Logs", () => {
    const sistema = buildMenu().find((item) => item.name === "Sistema");

    expect(sistema?.items?.map((i) => i.name)).toEqual(["Tarefas", "Configurações", "Logs"]);
  });

  it("o grupo Marketing tem as sete telas", () => {
    const menu = buildMenu();
    const marketing = menu.find((item) => item.name === "Marketing");

    // Promoções entra LOGO ABAIXO de Campanhas, a pedido do dono (18/09/2026) —
    // e não no fim do grupo, que seria a posição natural de uma tela nova.
    // Fidelidade (01/10/2026) logo abaixo de Cupons: o prêmio do programa é um cupom.
    expect(marketing?.items?.map((s) => s.href)).toEqual([
      "/marketing/cupons",
      "/marketing/fidelidade",
      "/marketing/campanhas",
      "/marketing/promocoes",
      "/marketing/campanhas/comparativo",
      // O catálogo de divulgação por último (03/10/2026): não tem sequência de
      // trabalho com cupom nem com campanha. O histórico vem colado nele.
      "/marketing/catalogo",
      "/marketing/catalogo/historico",
    ]);
  });

  it("começa pelo Dashboard", () => {
    expect(buildMenu()[0].name).toBe("Dashboard");
  });

  it("não mostra rota oculta", () => {
    const menu = buildMenu();
    const hrefs = menu.flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    // O caminho antigo de formas de pagamento continua respondendo, mas fora do
    // menu: a mesma tela em dois lugares confundiria. Caixas está temporariamente oculto.
    expect(hrefs).not.toContain("/formas-pagamento");
    expect(hrefs).not.toContain("/financeiro/caixas");
    expect(hrefs).toContain("/financeiro/formas-pagamento");
    expect(hrefs).not.toContain("/login");
  });

  it("segue a ordem declarada em MENU_ORDER", () => {
    // A ordem do menu é decisão de produto, não consequência do algoritmo de
    // montagem. Enquanto era implícita — Dashboard, todos os grupos, e as soltas
    // ao fim — não havia como pôr um grupo depois de uma solta, que é
    // exatamente o que "Sistema por último" pede.
    const nomes = buildMenu().map((item) => item.name);

    expect(nomes).toEqual([
      "Dashboard",
      "Estoque",
      "Financeiro",
      "Relatórios",
      // BI vem logo depois de Relatórios: relatório responde "quanto foi", BI
      // responde "o que fazer com isso" — vizinhos, e não o mesmo grupo.
      "BI",
      "Marketing",
      "Mídia",
      "Clientes",
      "Usuários",
      "Sistema",
    ]);
  });

  it("Estoque segue a ordem: Produtos, Compras, Categorias, Departamentos, Fornecedores, Tags, Etiquetas", () => {
    // "Entradas" saiu em 13/09/2026, e a igualdade estrita abaixo é o que impede
    // a volta por descuido. A entrada é sempre de UM produto (regra de
    // 31/08/2026) e a aba Estoque do cadastro já lista as notas daquele produto,
    // com detalhe e cancelamento — a listagem geral cobrava uma busca para
    // chegar no que interessa. Repô-la tem que ser decisão, não acidente.
    const produtos = buildMenu().find((item) => item.name === "Estoque");

    expect(produtos?.items?.map((s) => s.name)).toEqual([
      "Produtos",
      "Compras",
      "Categorias",
      "Departamentos",
      "Fornecedores",
      "Tags",
      "Etiquetas",
    ]);

    expect(produtos?.items?.map((s) => s.href)).toEqual([
      "/produtos",
      "/estoque/compras",
      "/categorias",
      "/departamentos",
      "/fornecedores",
      "/tags",
      "/etiquetas-gondola",
    ]);
  });

  it("Financeiro abre pelo Resumo Financeiro e põe Baixas logo após Vendas", () => {
    // "Resumo Financeiro" é a tela que se chamava "Relatórios" — o rótulo
    // antigo colidiria com o grupo novo de mesmo nome. A posição dos dois é
    // escolhida, não alfabética nem acidental: a ordem dentro do grupo é a
    // ordem das ROUTES.
    const financeiro = buildMenu().find((item) => item.name === "Financeiro");

    expect(financeiro?.items?.map((s) => s.name)).toEqual([
      "Resumo Financeiro",
      "Vendas",
      "Baixas",
      "Fechamentos Mensais",
      "Custos Fixos",
      "Sócios",
      "Formas de Pagamento",
    ]);
  });

  it("Inventário mora no grupo Relatórios, e não no grupo Estoque", () => {
    // O grupo "Estoque" se chamava "Produtos" até 30/08/2026, e antes disso
    // existiu um "Estoque" DIFERENTE, que guardava o Inventário e foi
    // dissolvido. O nome voltou; o Inventário não volta com ele — consulta
    // mora em "Relatórios", e é isso que esta asserção protege.
    const menu = buildMenu();

    const relatorios = menu.find((item) => item.name === "Relatórios");
    expect(relatorios?.items?.map((s) => s.href)).toEqual([
      "/estoque/inventario",
      "/relatorios/estoque-baixo",
    ]);

    const estoque = menu.find((item) => item.name === "Estoque");
    expect(estoque?.items?.map((s) => s.href)).not.toContain("/estoque/inventario");
  });

  it("Usuários é item de primeiro nível, e não item do grupo Sistema", () => {
    const usuarios = ROUTES.find((r) => r.path === "/sistema/usuarios")!;
    const sistema = buildMenu().find((item) => item.name === "Sistema");

    expect(usuarios.group).toBeUndefined();
    expect(sistema?.items?.map((s) => s.href)).toEqual(["/tarefas", "/configuracoes", "/sistema/logs"]);
  });

  it("nenhuma rota visível fica de fora do menu", () => {
    // A garantia que o fallback de `buildMenu` existe para dar: uma tela nova
    // esquecida em MENU_ORDER aparece no lugar errado — nunca some.
    const visiveis = ROUTES.filter((r) => r.label && !r.hidden && !r.publica).map((r) => r.path);
    const hrefs = buildMenu().flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    for (const path of visiveis) expect(hrefs).toContain(path);
  });

  it("toda entrada de MENU_ORDER aponta para um grupo ou uma rota que existe", () => {
    // Erro de digitação aqui não quebra nada: a entrada é simplesmente ignorada
    // e o item cai no fim da lista, longe de onde alguém quis pô-lo.
    const grupos = MENU_GROUPS.map((g) => g.name);
    const paths = ROUTES.map((r) => r.path);

    for (const entrada of MENU_ORDER) {
      expect([...grupos, ...paths]).toContain(entrada);
    }
  });

  it("todo item do menu corresponde a uma rota declarada", () => {
    const paths = new Set(ROUTES.map((r) => r.path));
    const menu = buildMenu();
    const hrefs = menu.flatMap((item) => (item.items ? item.items.map((s) => s.href) : [item.href]));

    // A invariante que o arquivo único existe para garantir: menu e rota não
    // podem divergir nem por um caractere.
    for (const href of hrefs) expect(paths).toContain(href);
  });
});

describe("sem perfil de usuário", () => {
  it("nenhuma rota declara papel", () => {
    // Não existe perfil (03/10/2026): quem tem sessão abre tudo. Um `roles` de
    // volta numa rota seria uma tela sumindo do menu de alguém sem que nada no
    // backend a recuse — a autorização de lá é só a sessão.
    for (const route of ROUTES) expect(route).not.toHaveProperty("roles");
  });

  it("o menu é o mesmo para qualquer pessoa: não recebe papel", () => {
    expect(buildMenu).toHaveLength(0);
  });
});
