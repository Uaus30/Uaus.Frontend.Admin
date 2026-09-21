import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RevenueFactorDto } from "@workspace/api-client-react";
import { RevenueBridge } from "../RevenueBridge";
import { MixPricePanel } from "../MixPricePanel";
import { EventItems } from "../EventItems";

/**
 * Os três blocos que desenham números sem tabela.
 *
 * O que está sendo protegido é o que a tela AFIRMA. Uma barra com a escala
 * errada, um sinal invertido ou um fator formatado como dinheiro quando é
 * contagem não quebram build nem teste de hook — a tela só passa a apontar para
 * a causa errada, e quem decide o que comprar decide por ela.
 *
 * Os números são os de junho contra agosto de 2026, medidos em produção.
 */
const PONTE: RevenueFactorDto[] = [
  {
    factor: "OpenDays",
    previousValue: 25,
    currentValue: 26,
    changePercentage: 4,
    amount: 352.23,
    shareOfMovement: 4.97,
  },
  {
    factor: "SalesPerDay",
    previousValue: 13.56,
    currentValue: 12.77,
    changePercentage: -5.83,
    amount: -538.21,
    shareOfMovement: 7.6,
  },
  {
    factor: "UnitsPerSale",
    previousValue: 3.06,
    currentValue: 3.73,
    changePercentage: 21.78,
    amount: 1777.08,
    shareOfMovement: 25.1,
  },
  {
    factor: "RevenuePerUnit",
    previousValue: 9.87,
    currentValue: 5.99,
    changePercentage: -39.26,
    amount: -4413.79,
    shareOfMovement: 62.33,
  },
];

describe("RevenueBridge", () => {
  it("mostra o valor cru dos quatro fatores, cada um no seu formato", () => {
    render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    // Dias são contagem; cupons e peças por cupom, decimais; o valor da peça,
    // dinheiro. Formatar tudo igual faria "26 dias" virar "R$ 26,00".
    expect(screen.getByText(/25 → 26/)).toBeTruthy();
    expect(screen.getByText(/13,56 → 12,77/)).toBeTruthy();
    expect(screen.getByText(/3,06 → 3,73/)).toBeTruthy();
    expect(screen.getByText(/9,87.*→.*5,99/)).toBeTruthy();
  });

  it("escreve a alta com sinal e a queda sem inventar outro", () => {
    render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    expect(screen.getByText("+R$ 1.777,08")).toBeTruthy();
    expect(screen.getByText("-R$ 4.413,79")).toBeTruthy();
  });

  it("soma as barras EXIBIDAS, e não o total recebido", () => {
    // Quatro barras de +100 somam +400. Imprimir o `total` faria a linha dizer
    // −2.822,69 e concordar com barras que a contradizem — a conferência que ela
    // promete seria teatro.
    const inflada = PONTE.map((fator) => ({ ...fator, amount: 100 }));

    render(<RevenueBridge bridge={inflada} total={-2822.69} />);

    const soma = screen.getByText(/Soma das \d+ causas/).closest("div")!;
    expect(within(soma).getByText("+R$ 400,00")).toBeTruthy();
    expect(screen.getByText(/não bate com as barras/)).toBeTruthy();
  });

  it("quando fecha, não mostra o aviso de divergência", () => {
    render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    const soma = screen.getByText(/Soma das \d+ causas/).closest("div")!;
    expect(within(soma).getByText("-R$ 2.822,69")).toBeTruthy();
    expect(screen.queryByText(/não bate com as barras/)).toBeNull();
  });

  it("esconde a parcela sem item quando ela é zero dos dois lados", () => {
    const comParcela = [
      ...PONTE,
      {
        factor: "Unattributed" as const,
        previousValue: 0,
        currentValue: 0,
        changePercentage: 0,
        amount: 0,
        shareOfMovement: 0,
      },
    ];

    render(<RevenueBridge bridge={comParcela} total={-2822.69} />);

    expect(screen.queryByText("Venda sem item")).toBeNull();
    expect(screen.getByText("Soma das 4 causas")).toBeTruthy();
  });

  it("mostra a parcela sem item quando há defeito de dado", () => {
    const comParcela = [
      ...PONTE,
      {
        factor: "Unattributed" as const,
        previousValue: 0,
        currentValue: 97.6,
        changePercentage: 0,
        amount: 97.6,
        shareOfMovement: 1.3,
      },
    ];

    render(<RevenueBridge bridge={comParcela} total={-2725.09} />);

    expect(screen.getByText("Venda sem item")).toBeTruthy();
    expect(screen.getByText("Soma das 5 causas")).toBeTruthy();
  });

  it("a maior barra ocupa a linha inteira e as outras são proporcionais a ela", () => {
    const { container } = render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    const larguras = Array.from(container.querySelectorAll<HTMLElement>("[style*='width']")).map((barra) =>
      parseFloat(barra.style.width),
    );

    // O valor da peça é o maior módulo (4.413,79): 100%. Os dias (352,23) são
    // 8% dele. Escala por valor bruto, e não por módulo, esconderia a queda.
    expect(Math.max(...larguras)).toBe(100);
    expect(larguras[0]).toBeCloseTo((352.23 / 4413.79) * 100, 1);
  });
});

describe("MixPricePanel", () => {
  it("separa os dois efeitos e traduz cada um em reais do período", () => {
    render(
      <MixPricePanel
        mixPrice={{
          measuredBy: "Category",
          previousRevenuePerUnit: 9.87,
          currentRevenuePerUnit: 5.99,
          change: -3.88,
          mixEffect: -2.06,
          priceEffect: -1.82,
          mixAmount: -2550.28,
          priceAmount: -2253.16,
          contributions: [],
        }}
      />,
    );

    expect(screen.getByText(/medido por categoria/)).toBeTruthy();
    expect(screen.getByText("Mix")).toBeTruthy();
    expect(screen.getByText("Preço")).toBeTruthy();
    expect(screen.getByText("-R$ 2.550,28")).toBeTruthy();
    expect(screen.getByText("-R$ 2.253,16")).toBeTruthy();
    expect(screen.getByText(/R\$ 9,87.*→.*R\$ 5,99/)).toBeTruthy();
  });

  it.each([
    ["Category" as const, "outras categorias", "a mesma categoria"],
    ["Department" as const, "outros departamentos", "o mesmo departamento"],
    ["Product" as const, "outros produtos", "o mesmo produto"],
    ["Supplier" as const, "outros fornecedores", "o mesmo fornecedor"],
  ])("escreve o plural e o gênero certos para %s", (medidaPor, plural, singular) => {
    // `${rotulo}s` escrevia "outras fornecedors" e "a mesma produto".
    render(
      <MixPricePanel
        mixPrice={{
          measuredBy: medidaPor,
          previousRevenuePerUnit: 10,
          currentRevenuePerUnit: 8,
          change: -2,
          mixEffect: -1,
          priceEffect: -1,
          mixAmount: -100,
          priceAmount: -100,
          contributions: [],
        }}
      />,
    );

    expect(screen.getByText(new RegExp(`a loja passou a vender ${plural}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${singular} saiu por outro preço`))).toBeTruthy();
  });
});

describe("RevenueBridge — escala e moldura", () => {
  it("a maior barra ocupa a linha inteira mesmo com valores de centavos", () => {
    // Piso de R$ 1 fazia a maior barra ocupar 40% quando os dois períodos eram
    // quase idênticos — justamente onde a escala relativa é a única leitura.
    const miudas = PONTE.map((fator, i) => ({ ...fator, amount: [0.4, -0.3, 0.2, -0.1][i] }));

    const { container } = render(<RevenueBridge bridge={miudas} total={0.2} />);

    const larguras = Array.from(container.querySelectorAll<HTMLElement>("[style*='width']")).map((barra) =>
      parseFloat(barra.style.width),
    );

    expect(Math.max(...larguras)).toBe(100);
  });

  it("o subtítulo anuncia a parcela sem item quando ela aparece", () => {
    const { rerender } = render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    // Sem a parcela, a identidade é o produto dos quatro fatores.
    expect(screen.queryByText(/\+ venda sem item/)).toBeNull();

    rerender(
      <RevenueBridge
        bridge={[
          ...PONTE,
          {
            factor: "Unattributed" as const,
            previousValue: 0,
            currentValue: 97.6,
            changePercentage: null,
            amount: 97.6,
            shareOfMovement: 1.3,
          },
        ]}
        total={-2725.09}
      />,
    );

    // Com ela, cinco barras sob a fórmula de quatro se contradiziam na moldura.
    expect(screen.getByText(/\+ venda sem item/)).toBeTruthy();
  });

  it("não imprime percentual quando o servidor não mandou um", () => {
    const semBase = [
      {
        factor: "Unattributed" as const,
        previousValue: 0,
        currentValue: 97.6,
        changePercentage: null,
        amount: 97.6,
        shareOfMovement: 100,
      },
    ];

    render(<RevenueBridge bridge={semBase} total={97.6} />);

    // Sair de zero não é 0% de variação. Um "(+0,0%)" ao lado de +R$ 97,60 seria
    // a tela dizendo que o fator que mais mexeu não mexeu.
    expect(screen.getByText(/R\$ 0,00 → R\$ 97,60/).textContent).not.toContain("%");
  });
});

describe("MixPricePanel — o restante", () => {
  it("mostra o que não coube, calculado contra o total do cabeçalho", () => {
    // O servidor manda até 20 linhas mais um balde; a tela cabe em 8. Truncar em
    // silêncio escondia de 25% a 33% do efeito sem nada dizendo que faltava.
    const contribuicoes = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `CATEGORIA ${i}`,
      previousUnitShare: 5,
      currentUnitShare: 5,
      previousAveragePrice: 10,
      currentAveragePrice: 9,
      mixEffect: -0.1,
      priceEffect: -0.05,
      totalEffect: -0.15,
    }));

    render(
      <MixPricePanel
        mixPrice={{
          measuredBy: "Category",
          previousRevenuePerUnit: 10,
          currentRevenuePerUnit: 8.2,
          change: -1.8,
          mixEffect: -1.2,
          priceEffect: -0.6,
          mixAmount: -120,
          priceAmount: -60,
          contributions: contribuicoes,
        }}
      />,
    );

    // 8 exibidas somam mix −0,80 e preço −0,40; o restante fecha com o cabeçalho.
    const restante = screen.getByText("Todo o restante").closest("div")!;
    expect(within(restante).getByText(/-R\$ 0,40/)).toBeTruthy();
    expect(within(restante).getByText(/-R\$ 0,20/)).toBeTruthy();
  });

  it("não mostra o restante quando tudo coube", () => {
    render(
      <MixPricePanel
        mixPrice={{
          measuredBy: "Category",
          previousRevenuePerUnit: 10,
          currentRevenuePerUnit: 9,
          change: -1,
          mixEffect: -0.6,
          priceEffect: -0.4,
          mixAmount: -60,
          priceAmount: -40,
          contributions: [
            {
              id: 1,
              name: "Utilidades",
              previousUnitShare: 100,
              currentUnitShare: 100,
              previousAveragePrice: 10,
              currentAveragePrice: 9,
              mixEffect: -0.6,
              priceEffect: -0.4,
              totalEffect: -1,
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("Todo o restante")).toBeNull();
  });

  it("sobrevive a uma dimensão que o front ainda não conhece", () => {
    const acao = () =>
      render(
        <MixPricePanel
          mixPrice={{
            measuredBy: "Brand" as never,
            previousRevenuePerUnit: 10,
            currentRevenuePerUnit: 9,
            change: -1,
            mixEffect: -0.6,
            priceEffect: -0.4,
            mixAmount: -60,
            priceAmount: -40,
            contributions: [],
          }}
        />,
      );

    expect(acao).not.toThrow();
  });
});

describe("MixPricePanel — o veredito", () => {
  function comEfeitos(mix: number, preco: number, change: number) {
    return {
      measuredBy: "Category" as const,
      previousRevenuePerUnit: 10,
      currentRevenuePerUnit: 10 + change,
      change,
      mixEffect: mix,
      priceEffect: preco,
      mixAmount: mix * 100,
      priceAmount: preco * 100,
      contributions: [],
    };
  }

  it("aponta PREÇO quando ele domina, e diz o que olhar", () => {
    // Os dois números sozinhos não dizem o que fazer, e a leitura mais natural
    // deles está errada: "mix de −R$ 0,65" soa como "o preço médio caiu R$ 0,65",
    // que é a definição do OUTRO efeito.
    render(<MixPricePanel mixPrice={comEfeitos(-0.65, -1.27, -1.92)} />);

    const veredito = screen.getByText(/da queda veio de PREÇO/);
    expect(veredito.textContent).toContain("66%");
    expect(veredito.textContent).toContain("precificação");
  });

  it("aponta MIX quando ele domina, e manda olhar a compra", () => {
    render(<MixPricePanel mixPrice={comEfeitos(-1.5, -0.5, -2)} />);

    const veredito = screen.getByText(/da queda veio de MIX/);
    expect(veredito.textContent).toContain("75%");
    expect(veredito.textContent).toContain("comprando");
  });

  it("fala de alta quando o valor da peça sobe", () => {
    render(<MixPricePanel mixPrice={comEfeitos(0.5, 1.5, 2)} />);

    expect(screen.getByText(/da alta veio de PREÇO/)).toBeTruthy();
  });

  it("não inventa causa quando nada mudou", () => {
    render(<MixPricePanel mixPrice={comEfeitos(0, 0, 0)} />);

    expect(screen.getByText(/praticamente não mudou/)).toBeTruthy();
  });

  it("o botão de ajuda abre o exemplo que separa mix de preço", async () => {
    render(<MixPricePanel mixPrice={comEfeitos(-0.65, -1.27, -1.92)} />);

    fireEvent.click(screen.getByLabelText("O que é Mix ou preço"));

    const balao = await screen.findByText(/Imagine que a loja venda/);
    expect(balao).toBeTruthy();
    // O exemplo precisa deixar claro que no caso do mix NENHUM preço mudou.
    expect(screen.getByText(/nenhum preço mudou/)).toBeTruthy();
  });
});

describe("RevenueBridge — a ajuda do cartão", () => {
  it("explica a venda sem item quando a barra aparece", async () => {
    render(
      <RevenueBridge
        bridge={[
          ...PONTE,
          {
            factor: "Unattributed" as const,
            previousValue: 30.22,
            currentValue: 0,
            changePercentage: -100,
            amount: -30.22,
            shareOfMovement: 0.4,
          },
        ]}
        total={-2852.91}
      />,
    );

    fireEvent.click(screen.getByLabelText("O que é De onde veio a diferença"));

    // Foi a primeira dúvida do dono ao ver a tela: "não é possível ter uma venda
    // sem nenhum item". O balão precisa dizer que ele está certo, e de onde vem.
    // A busca é por um trecho que SÓ existe no balão: "defeito de dado" também
    // está na legenda da própria barra.
    expect(await screen.findByText(/sete cupons do Mais PDV/)).toBeTruthy();
    expect(screen.getByText(/quatro deles não tinham item nenhum/)).toBeTruthy();
  });

  it("não fala de venda sem item quando a barra não existe", async () => {
    render(<RevenueBridge bridge={PONTE} total={-2822.69} />);

    fireEvent.click(screen.getByLabelText("O que é De onde veio a diferença"));

    await screen.findByText(/identidade/);
    expect(screen.queryByText(/defeito de dado/)).toBeNull();
  });
});

describe("EventItems", () => {
  it("nomeia o item que carregava o período e mostra o estoque que sobrou", () => {
    render(
      <EventItems
        items={[
          {
            productId: 1,
            productName: "CAMISETA DO BRASIL",
            barcode: "1",
            categoryName: "Vestuário e Calçados",
            previousRevenue: 2092,
            currentRevenue: 22,
            revenueDelta: -2070,
            previousShare: 20.42,
            currentShare: 0.3,
            previousUnits: 85,
            currentUnits: 1,
            stock: 24,
            stockCost: 328.08,
            kind: "Vanished",
          },
        ]}
      />,
    );

    expect(screen.getByText("CAMISETA DO BRASIL")).toBeTruthy();
    expect(screen.getByText("Carregava e sumiu")).toBeTruthy();
    expect(screen.getByText(/20,4%.*0,3%/)).toBeTruthy();
    // A frase e' quebrada por um <strong> no meio, entao o matcher de texto nao
    // alcanca a linha inteira: a leitura vem do `textContent` do paragrafo. O
    // `\s` normaliza o espaco NAO-QUEBRAVEL que `formatCurrency` poe entre "R$"
    // e o numero — sem isso a comparacao falha por um caractere invisivel.
    const sobra = screen.getByText(/sobraram/).textContent!.replace(/\s/g, " ");
    expect(sobra).toContain("sobraram 24 em estoque, R$ 328,08 de custo parado");
  });

  it("o ? ensina os DOIS limiares que o backend usa", async () => {
    render(
      <EventItems
        items={[
          {
            productId: 1,
            productName: "CAMISETA DO BRASIL",
            barcode: "1",
            categoryName: "Vestuário e Calçados",
            previousRevenue: 2092,
            currentRevenue: 22,
            revenueDelta: -2070,
            previousShare: 20.42,
            currentShare: 0.3,
            previousUnits: 85,
            currentUnits: 1,
            stock: 24,
            stockCost: 328.08,
            kind: "Vanished",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("O que é Itens que sozinhos moveram o período"));

    // `EventItemDto.MinimumShare = 5` e `ResidualShare = 2`. O manual já ensinou
    // "menos da metade disso" (2,5%), que não é regra nenhuma do código.
    // Os dois limiares estão em <strong> separados; a frase inteira é o pai.
    const frase = (await screen.findByText(/passou de 5%/)).closest("p")!;
    expect(frase.textContent).toContain("passou de 5%");
    expect(frase.textContent).toContain("abaixo de 2%");
  });

  it("some inteiro quando não há item-evento", () => {
    const { container } = render(<EventItems items={[]} />);

    // Um cartão vazio dizendo "nenhum evento" é ruído numa tela de cinco
    // blocos: a ausência de evento é o normal, não uma informação.
    expect(container.innerHTML).toBe("");
  });
});
