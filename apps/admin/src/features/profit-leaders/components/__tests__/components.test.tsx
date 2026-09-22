import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfitSparkline } from "../ProfitSparkline";
import { ProfitPodium } from "../ProfitPodium";
import { ProfitRanking } from "../ProfitRanking";
import { ProfitHeadline } from "../ProfitHeadline";
import { ProfitRow } from "../ProfitRow";
import { productDetailPathname } from "@/features/products/product-detail-route";
import { BUCKETS_DE_TESTE, RELATORIO_DE_TESTE, liderDeTeste } from "../../__tests__/fixtures";

describe("ProfitSparkline", () => {
  const historico = BUCKETS_DE_TESTE.map((_, i) => i * 10);

  it("traceja o trecho que toca um intervalo ainda aberto", () => {
    // O ultimo intervalo quase sempre e' parcial — em 30 dias a quinta semana
    // cobre dois dias. Sem a distincao, o grafico de TODO produto da tela termina
    // num mergulho que nao aconteceu, e e' justamente o fim da linha que se olha
    // para decidir se o produto ainda vende.
    const { container } = render(
      <ProfitSparkline history={historico} buckets={BUCKETS_DE_TESTE} label="Evolução" />,
    );

    const segmentos = [...container.querySelectorAll("line")];
    const tracejados = segmentos.filter((linha) => linha.getAttribute("stroke-dasharray"));

    expect(segmentos).toHaveLength(BUCKETS_DE_TESTE.length - 1);
    expect(tracejados).toHaveLength(1);
    expect(segmentos[segmentos.length - 1]!.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("traceja tambem o PRIMEIRO intervalo quando e' ele o recortado", () => {
    // Em "Desde a inauguracao" o primeiro balde tambem e' parcial: a loja abriu em
    // 05/03 e o mes de marco comeca no dia 1o. Com o fixture marcando so o ultimo,
    // trocar `ponto.parcial || proximo.parcial` por `proximo.parcial` passava
    // despercebido — e todo grafico do preset perdia o tracejado de abertura.
    const comAberturaParcial = BUCKETS_DE_TESTE.map((b, i) => ({ ...b, isPartial: i === 0 }));

    const { container } = render(
      <ProfitSparkline history={historico} buckets={comAberturaParcial} label="Evolução" />,
    );

    const segmentos = [...container.querySelectorAll("line")];
    expect(segmentos[0]!.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(segmentos[1]!.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("mantem o prejuizo DENTRO da caixa do desenho", () => {
    // `Math.max(...history, 0)` limitava so o teto. Um intervalo negativo — uma
    // liquidacao abaixo do custo, que o banco produz — recebia y maior que a
    // altura e era pintado POR CIMA da linha seguinte do ranking, com o
    // `overflow-visible` deixando escapar.
    const comPrejuizo = [-40, 100, 50, 60, 20, 10, 5, 30, 40, 50, 60, 70, 10];

    const { container } = render(
      <ProfitSparkline history={comPrejuizo} buckets={BUCKETS_DE_TESTE} label="Evolução" />,
    );

    const altura = Number(container.querySelector("svg")!.getAttribute("height"));
    const ys = [...container.querySelectorAll("line")].flatMap((l) => [
      Number(l.getAttribute("y1")),
      Number(l.getAttribute("y2")),
    ]);

    expect(Math.max(...ys)).toBeLessThanOrEqual(altura);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it("nao traceja nada quando todos os intervalos fecharam", () => {
    const fechados = BUCKETS_DE_TESTE.map((b) => ({ ...b, isPartial: false }));

    const { container } = render(<ProfitSparkline history={historico} buckets={fechados} label="Evolução" />);

    expect(
      [...container.querySelectorAll("line")].filter((l) => l.getAttribute("stroke-dasharray")),
    ).toHaveLength(0);
  });

  it("sobrevive a um periodo sem lucro nenhum, sem dividir por zero", () => {
    const { container } = render(
      <ProfitSparkline history={BUCKETS_DE_TESTE.map(() => 0)} buckets={BUCKETS_DE_TESTE} label="Evolução" />,
    );

    for (const linha of container.querySelectorAll("line")) {
      expect(Number(linha.getAttribute("y1"))).not.toBeNaN();
    }
  });

  it("nao desenha quando historico e intervalos discordam", () => {
    // Contrato quebrado entre os dois lados: desenhar mesmo assim produziria um
    // grafico deslocado, que mente sem avisar.
    const { container } = render(
      <ProfitSparkline history={[1, 2]} buckets={BUCKETS_DE_TESTE} label="Evolução" />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("aceita largura e altura maiores, para caber no cartao do podio", () => {
    // Sem isso o podio herdaria o tamanho compacto pensado para uma linha de
    // tabela — 132px num cartao de ~260px de largura fica minusculo.
    const { container } = render(
      <ProfitSparkline
        history={historico}
        buckets={BUCKETS_DE_TESTE}
        label="Evolução"
        width={240}
        height={44}
      />,
    );

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 240 44");
    expect(svg.getAttribute("width")).toBe("240");
    expect(svg.getAttribute("height")).toBe("44");
  });

  it("sem largura/altura, continua no tamanho compacto de sempre", () => {
    // Trava de regressao: a linha do ranking nao passa essas props, e nao pode
    // herdar um tamanho pensado para o podio.
    const { container } = render(
      <ProfitSparkline history={historico} buckets={BUCKETS_DE_TESTE} label="Evolução" />,
    );

    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 132 30");
  });

  it("o ponto vazado usa uma cor de CSS valida", () => {
    // `var(--background)` sozinho, sem `hsl(...)`, não é uma cor CSS válida —
    // a variável guarda só os três componentes do HSL. O `fill` resultante
    // ficava com o valor inicial (preto), em vez de vazar para a cor do
    // cartão. A asserção prova a FORMA da cor, não o pixel renderizado, que o
    // jsdom não calcula.
    const comAberturaParcial = BUCKETS_DE_TESTE.map((b, i) => ({
      ...b,
      isPartial: i === BUCKETS_DE_TESTE.length - 1,
    }));
    const { container } = render(
      <ProfitSparkline history={historico} buckets={comAberturaParcial} label="Evolução" />,
    );

    const ponto = container.querySelector("circle")!;
    expect(ponto.getAttribute("fill")).toBe("hsl(var(--card))");
  });
});

describe("ProfitPodium", () => {
  it("o DOM segue a ordem do rank, nao a ordem visual do desktop", () => {
    // A ordem visual (prata-ouro-bronze) e' so' CSS (`order`), que o jsdom nao
    // computa — testar por texto na tela testaria layout que esta ferramenta
    // nao enxerga. O que importa aqui e' o que QUALQUER leitor de tela ou tela
    // empilhada no celular segue: a ordem do RANK, ouro primeiro.
    render(<ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />);

    const medalhas = screen.getAllByText(/^(Ouro|Prata|Bronze)$/).map((n) => n.textContent);

    expect(medalhas).toEqual(["Ouro", "Prata", "Bronze"]);
  });

  it("cada cartao carrega a classe que o reordena no desktop: prata a esquerda, bronze a direita", () => {
    const { container } = render(
      <ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />,
    );

    // `.rounded-2xl` sozinho, e não `.rounded-2xl.border`: o ouro carrega
    // `border-2`, não `border` — um TOKEN de classe diferente, que o seletor
    // CSS de classe não casa por prefixo.
    const [ouro, prata, bronze] = container.querySelectorAll(".rounded-2xl");

    expect(ouro?.className).toContain("md:order-2");
    expect(prata?.className).toContain("md:order-1");
    expect(bronze?.className).toContain("md:order-3");
  });

  it("o selo de situacao sobe ao podio junto com a medalha", () => {
    // O ouro do periodo e' a camiseta da Copa, que vendeu 85 pecas em junho e 3
    // em setembro. A medalha e' dela por merito; sem o selo ao lado, ela vira
    // recomendacao de compra.
    render(<ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />);

    expect(screen.getByText("CAMISETA DO BRASIL")).toBeTruthy();
    expect(screen.getAllByText("Perdendo ritmo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estoque parado").length).toBeGreaterThan(0);
  });

  it("mostra o motivo da posicao, e nao so o valor", () => {
    render(<ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />);

    expect(screen.getByText(/47 peças × R\$\s*8,23 de lucro cada/)).toBeTruthy();
  });

  it("nao estoura com menos de tres colocados", () => {
    const acao = () =>
      render(<ProfitPodium podium={RELATORIO_DE_TESTE.leaders.slice(0, 1)} buckets={BUCKETS_DE_TESTE} />);

    expect(acao).not.toThrow();
  });

  it("so o 1o lugar carrega a moldura dupla e o brilho", () => {
    // O destaque do ouro agora vem do proprio cartao (borda + brilho), nao de
    // uma barra crescendo embaixo dele — a barra sumiu junto com a ideia de
    // que este podio fosse sobre magnitude.
    const { container } = render(
      <ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />,
    );

    const cartoes = [...container.querySelectorAll(".rounded-2xl")];

    expect(cartoes).toHaveLength(3);
    expect(cartoes.filter((c) => c.className.includes("border-2"))).toHaveLength(1);
  });

  it("sobrevive a um arquetipo que o front ainda nao conhece", () => {
    // O icone de tendencia do cartao busca direto no mapa de arquetipos; sem
    // fallback, um valor novo do backend devolveria `undefined` e `<Icone />`
    // estouraria em render — a mesma classe de defeito corrigida na linha do
    // ranking.
    const podioComDesconhecido = [
      liderDeTeste({ archetype: "Bundle" as never, alert: "None" }),
      ...RELATORIO_DE_TESTE.leaders.slice(1),
    ];

    const acao = () => render(<ProfitPodium podium={podioComDesconhecido} buckets={BUCKETS_DE_TESTE} />);

    expect(acao).not.toThrow();
  });

  it("o grafico do cartao usa o tamanho largo do cartao, nao o compacto da linha", () => {
    const { container } = render(
      <ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />,
    );

    const svg = container.querySelector("svg[role='img']");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 240 44");
  });
});

describe("ProfitRanking", () => {
  function renderRanking(overrides: Partial<React.ComponentProps<typeof ProfitRanking>> = {}) {
    const props = {
      leaders: RELATORIO_DE_TESTE.leaders,
      buckets: BUCKETS_DE_TESTE,
      median: 4.98,
      counts: new Map([
        ["Declining", 1],
        ["Steady", 1],
        ["Workhorse", 1],
      ] as const),
      search: "",
      onSearchChange: vi.fn(),
      archetype: null,
      onToggleArchetype: vi.fn(),
      isFiltered: false,
      periodKey: "jun|set",
      ...overrides,
    } as React.ComponentProps<typeof ProfitRanking>;

    return { props, ...render(<ProfitRanking {...props} />) };
  }

  it("mostra a posicao do corte inteiro, mesmo filtrado", () => {
    renderRanking({ leaders: [RELATORIO_DE_TESTE.leaders[1]!], isFiltered: true });

    expect(screen.getByText("2º")).toBeTruthy();
  });

  it("a pastilha do arquetipo avisa o pai", () => {
    const { props } = renderRanking();

    fireEvent.click(screen.getByRole("button", { name: /Perdendo ritmo/ }));

    expect(props.onToggleArchetype).toHaveBeenCalledWith("Declining");
  });

  it("diz que nao ha resultado sem sugerir que a loja nao lucrou", () => {
    renderRanking({ leaders: [], isFiltered: true });

    expect(screen.getByText(/Nenhum campeão corresponde ao filtro/)).toBeTruthy();
  });

  it("separa lista vazia por filtro de lista vazia por falta de lucro", () => {
    renderRanking({ leaders: [], isFiltered: false });

    expect(screen.getByText(/Nenhum produto deu lucro no período/)).toBeTruthy();
  });

  it("o ? do cartao ensina a ler a multiplicacao da linha", () => {
    renderRanking();

    fireEvent.click(screen.getByLabelText("O que é O ranking completo"));

    const balao = screen.getByText(/peças × lucro por peça/);
    expect(balao).toBeTruthy();
    expect(screen.getByText(/Aqui não existe produto ruim/)).toBeTruthy();
  });
});

describe("ProfitRow", () => {
  function renderRow(leader = liderDeTeste(), median = 4.98) {
    return render(
      <ul>
        <ProfitRow leader={leader} buckets={BUCKETS_DE_TESTE} median={median} />
      </ul>,
    );
  }

  it("mostra os quatro andares: posicao, motivo, o que e', e o que fazer", () => {
    renderRow(
      liderDeTeste({
        rank: 7,
        archetype: "Declining",
        alert: "ParkedStock",
        stock: 24,
        stockCost: 264,
        profitPerUnit: 0.81,
      }),
    );

    expect(screen.getByText("7º")).toBeTruthy();
    expect(screen.getByText(/275 peças × R\$\s*0,81 de lucro cada/)).toBeTruthy();
    expect(screen.getByText("Perdendo ritmo")).toBeTruthy();
    expect(screen.getByText(/24 peças em casa/)).toBeTruthy();
  });

  it("sobrevive a um arquetipo e a um alerta que o front ainda nao conhece", () => {
    // O backend pode acrescentar um membro ao enum a qualquer momento. Sem guarda,
    // o icone vem `undefined`, `<Icon />` estoura em tempo de render, e o
    // ErrorBoundary da rota troca a TELA INTEIRA pela tela de recuperacao — nao e'
    // uma linha quebrada, e' a tela sumindo.
    const acao = () => renderRow(liderDeTeste({ archetype: "Bundle" as never, alert: "Seasonal" as never }));

    expect(acao).not.toThrow();
  });

  it("situa a linha contra a regua de lucro por peca do corte", () => {
    renderRow(liderDeTeste({ profitPerUnit: 0.81 }), 4.98);

    expect(screen.getByText(/compensa no giro/)).toBeTruthy();
  });

  it("nao desenha grafico quando o periodo nao rendeu intervalos", () => {
    // Pelo rotulo, e nao por `querySelector("svg")`: os icones das pilulas
    // tambem sao SVG, e a asercao passaria a medir a presenca deles.
    renderRow(liderDeTeste({ history: [] }));

    expect(screen.queryByLabelText(/Evolução do lucro/)).toBeNull();
  });

  it("desenha o grafico quando ha intervalos", () => {
    renderRow();

    expect(screen.getByLabelText(/Evolução do lucro de POTE OVAL/)).toBeTruthy();
  });

  it("o icone ao lado do nome abre o cadastro do GRUPO em nova aba", () => {
    // productGroupId, e nao productId: a rota de detalhe edita o grupo, e um
    // id de variacao no link abriria (ou erraria) o produto errado.
    renderRow(liderDeTeste({ productGroupId: 42, productName: "POTE OVAL COM TAMPA 1 LITRO" }));

    const link = screen.getByRole("link", { name: /Abrir POTE OVAL COM TAMPA 1 LITRO no cadastro/ });

    expect(link.getAttribute("href")).toBe(productDetailPathname(42));
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("o estoque fica visivel em qualquer tela, nao so a partir do breakpoint sm", () => {
    // RTL/jsdom não aplicam CSS: um `hidden sm:block` esquecido aqui passaria
    // pelo `getByText` do mesmo jeito, porque a arvore continua tendo o nó. A
    // asserção precisa olhar a CLASSE — é exatamente o defeito que a coluna
    // inteira tinha antes: no celular ela sumia junto com peças e vendas.
    renderRow(liderDeTeste({ stock: 24 }));

    const estoque = screen.getByText(/24 em casa/);
    expect(estoque.className.split(/\s+/)).not.toContain("hidden");
  });

  it("sem estoque tambem fica visivel em qualquer tela", () => {
    renderRow(liderDeTeste({ stock: 0 }));

    const estoque = screen.getByText("sem estoque");
    expect(estoque.className.split(/\s+/)).not.toContain("hidden");
  });
});

describe("ProfitHeadline", () => {
  it("a manchete e a concentracao, nao o podio", () => {
    // O podio inteiro carrega menos de 10% do lucro; a concentracao e' o que
    // muda a conversa.
    render(<ProfitHeadline report={RELATORIO_DE_TESTE} />);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/de 513 produtos que venderam/)).toBeTruthy();
  });

  it("chama o dinheiro parado atras dos campeoes que desaceleraram", () => {
    render(<ProfitHeadline report={RELATORIO_DE_TESTE} />);

    expect(screen.getByText(/25 campeões perderam/)).toBeTruthy();
    expect(screen.getByText(/463 peças em casa/)).toBeTruthy();
  });

  it("cala o aviso quando nao ha ninguem perdendo ritmo", () => {
    render(
      <ProfitHeadline
        report={{
          ...RELATORIO_DE_TESTE,
          summary: { ...RELATORIO_DE_TESTE.summary, decliningLeaders: 0, decliningStockCost: 0 },
        }}
      />,
    );

    expect(screen.queryByText(/perderam ritmo/)).toBeNull();
  });

  it("o ? explica o corte sem repetir o manual da tela", () => {
    render(<ProfitHeadline report={RELATORIO_DE_TESTE} />);

    fireEvent.click(screen.getByLabelText("O que é Quem faz metade do lucro"));

    const balao = screen.getByText(/50% do lucro do período/).closest("div")!;
    expect(within(balao).getByText(/50% do lucro do período/)).toBeTruthy();
  });
});
