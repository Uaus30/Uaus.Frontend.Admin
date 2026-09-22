import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfitSparkline } from "../ProfitSparkline";
import { ProfitPodium } from "../ProfitPodium";
import { ProfitRanking } from "../ProfitRanking";
import { ProfitHeadline } from "../ProfitHeadline";
import { ProfitRow } from "../ProfitRow";
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
});

describe("ProfitPodium", () => {
  it("desenha prata, ouro e bronze nessa ordem visual", () => {
    render(<ProfitPodium podium={RELATORIO_DE_TESTE.leaders} buckets={BUCKETS_DE_TESTE} />);

    const medalhas = screen.getAllByText(/^(Ouro|Prata|Bronze)$/).map((n) => n.textContent);

    expect(medalhas).toEqual(["Prata", "Ouro", "Bronze"]);
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
