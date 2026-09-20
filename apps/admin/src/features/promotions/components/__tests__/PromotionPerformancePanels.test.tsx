import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type PromotionInvestmentDto, type PromotionScoreDto } from "@workspace/api-client-react";
import { PromotionInvestmentPanel } from "../PromotionInvestmentPanel";
import { PromotionScorePanel } from "../PromotionScorePanel";

/**
 * Os dois painéis da aba Performance.
 *
 * O que está sendo protegido não é o layout: é o que a tela **declara**. A nota
 * precisa aparecer acompanhada da régua que a produziu (sem isso não há como
 * recalibrar peso nenhum depois), o esgotamento precisa se anunciar como
 * inferência, e o saldo precisa vir marcado como estimativa — ele é a única
 * linha da escada que não sai de dado gravado.
 */

function nota(parcial: Partial<PromotionScoreDto> = {}): PromotionScoreDto {
  return {
    score: 82,
    // Pelo NOME, como a API manda de verdade (`JsonStringEnumConverter`). O
    // fixture anterior usava a constante numérica, e foi por isso que o teste
    // passava enquanto a tela saía sem a palavra da faixa.
    class: "Standout",
    rulerOccurrences: 12,
    rulerFellBackToAllDays: false,
    weekdayName: "Sábado",
    renormalizedWithoutTicketAndBasket: false,
    salesOverLimit: 0,
    groupStock: 12,
    components: [
      {
        key: "volume",
        weight: 0.35,
        score: 100,
        measured: 40,
        target: 14,
        targetSource: "meta declarada no cadastro",
        excluded: false,
      },
      {
        key: "dayShare",
        weight: 0.25,
        score: 70,
        measured: 28,
        target: 40,
        targetSource: "p75 do faturamento concentrado nos tickets do campeão",
        excluded: false,
      },
    ],
    ...parcial,
  };
}

function investimento(parcial: Partial<PromotionInvestmentDto> = {}): PromotionInvestmentDto {
  return {
    amount: 37,
    perDay: 37,
    itemProfit: -5,
    dragProfit: 160,
    returnPerInvestedReal: 4.32,
    baselineProfit: 60,
    balance: 95,
    isShowcaseOnly: false,
    ...parcial,
  };
}

describe("PromotionScorePanel", () => {
  it("mostra a nota com a régua que a produziu", () => {
    render(<PromotionScorePanel score={nota()} />);

    expect(screen.getByLabelText(/Nota 82 de 100 — Destaque/)).toBeTruthy();
    expect(screen.getByText(/12 sábados/)).toBeTruthy();
    expect(screen.getByText("meta declarada no cadastro")).toBeTruthy();
  });

  it("avisa quando a régua caiu para todos os dias", () => {
    // Sem o aviso, o número pareceria mais forte do que é: três sábados de loja
    // recém-aberta não sustentam um p75.
    render(<PromotionScorePanel score={nota({ rulerOccurrences: 2, rulerFellBackToAllDays: true })} />);

    expect(screen.getByText(/todos os dias/)).toBeTruthy();
  });

  it("diz o MOTIVO de o componente ter saído da conta", () => {
    // REGRESSÃO: a frase era fixa ("com menos de três vendas") e havia DOIS
    // motivos. O segundo — o produto ter saído em poucas vendas da régua — é o
    // caso normal: na dev, 203 dos 241 grupos que venderam nos 12 sábados. A
    // tela escrevia "com menos de três vendas" ao lado de "Vendas: 30".
    const comExcluido = nota({
      renormalizedWithoutTicketAndBasket: true,
      ticketAndBasketExclusionReason: "o produto saiu em só 2 venda(s) das ocorrências anteriores",
      components: [
        {
          key: "ticket",
          weight: 0.2,
          score: 0,
          measured: 17.9,
          target: 41.63,
          targetSource: "1,5× o ticket de Sábado",
          excluded: true,
        },
      ],
    });

    render(<PromotionScorePanel score={comExcluido} />);

    expect(screen.getAllByText(/só 2 venda\(s\) das ocorrências anteriores/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/menos de três vendas/)).toBeNull();
  });

  it("não imprime alvo zerado no componente sem régua", () => {
    // REGRESSÃO: produto que nunca saiu naquele dia da semana tem régua zerada, e
    // a tela mostrava "de R$ 0,00" com a barra CHEIA — `TicketScore(x, 0)` vale
    // 100 — ao lado da frase "fora da conta". São 675 dos 916 grupos da dev.
    const semRegua = nota({
      renormalizedWithoutTicketAndBasket: true,
      ticketAndBasketExclusionReason: "o produto não saiu nenhuma vez nas ocorrências anteriores",
      components: [
        {
          key: "ticket",
          weight: 0.2,
          score: 0,
          measured: 26.5,
          target: 0,
          targetSource: "1,5× o ticket de Sábado",
          excluded: true,
        },
      ],
    });

    render(<PromotionScorePanel score={semRegua} />);

    expect(screen.queryByText(/de R\$\s?0,00/)).toBeNull();
  });

  it("régua vazia não afirma que usou todos os dias", () => {
    // "Medido contra 0 dias anteriores" seguido de "a régua usou todos os dias"
    // é a tela afirmando duas coisas que não aconteceram.
    render(<PromotionScorePanel score={nota({ rulerOccurrences: 0, rulerFellBackToAllDays: true })} />);

    expect(screen.getByText(/Sem histórico anterior/)).toBeTruthy();
    expect(screen.queryByText(/0 dias/)).toBeNull();
  });

  it("trata a faixa que chega pelo nome, como a API manda", () => {
    // REGRESSÃO: `class` chega como "NoSales", e a comparação com o código
    // numérico dava sempre falso — a promoção sem venda mostrava "poucas vendas
    // para medir" em vez de "Sem venda", e o velocímetro saía sem a palavra.
    render(
      <PromotionScorePanel
        score={nota({ class: "NoSales", score: 0, renormalizedWithoutTicketAndBasket: true })}
      />,
    );

    expect(screen.getByText("Sem venda")).toBeTruthy();
    expect(screen.queryByText(/ticket e arraste são ruído/)).toBeNull();
  });

  it("não desenha o velocímetro quando não houve venda", () => {
    // REGRESSÃO: o degradê do velocímetro começa em VERMELHO, então "Sem venda"
    // saía como um zero grande e vermelho — que lê como fracasso. É ausência de
    // medida, e a cor dela é cinza: a promoção pode ter começado há dez minutos.
    render(<PromotionScorePanel score={nota({ class: "NoSales", score: 0 })} />);

    expect(screen.queryByLabelText(/Nota 0 de 100/)).toBeNull();
    expect(screen.getByText(/ausência de medida/)).toBeTruthy();
  });

  it("mostra o peso EFETIVO quando a nota foi renormalizada", () => {
    // REGRESSÃO: o painel imprimia o peso nominal que a API manda (35/25/20/20)
    // mesmo com ticket e arraste fora da conta. Quem multiplicasse o que está
    // escrito chegava a 36 com o ponteiro marcando 60, e o painel existe
    // justamente para a conta fechar.
    const renormalizada = nota({
      score: 60,
      renormalizedWithoutTicketAndBasket: true,
      components: [
        {
          key: "volume",
          weight: 0.35,
          score: 85.71,
          measured: 12,
          target: 14,
          targetSource: "meta",
          excluded: false,
        },
        {
          key: "dayShare",
          weight: 0.25,
          score: 25,
          measured: 10,
          target: 40,
          targetSource: "p75",
          excluded: false,
        },
        {
          key: "ticket",
          weight: 0.2,
          score: 0,
          measured: 0,
          target: 41.63,
          targetSource: "1,5×",
          excluded: true,
        },
        {
          key: "basket",
          weight: 0.2,
          score: 0,
          measured: 0,
          target: 4.23,
          targetSource: "1,5×",
          excluded: true,
        },
      ],
    });

    render(<PromotionScorePanel score={renormalizada} />);

    // 0,35 ÷ 0,60 e 0,25 ÷ 0,60 — os 58,3% / 41,7% que o plano nomeia.
    expect(screen.getByText("peso 58%")).toBeTruthy();
    expect(screen.getByText("peso 42%")).toBeTruthy();
    expect(screen.queryByText("peso 35%")).toBeNull();
    expect(screen.getAllByText("fora da conta")).toHaveLength(2);
  });

  it("concorda no singular quando a régua tem uma ocorrência só", () => {
    render(<PromotionScorePanel score={nota({ rulerOccurrences: 1, rulerFellBackToAllDays: true })} />);

    expect(screen.getByText(/1 dia/)).toBeTruthy();
    expect(screen.queryByText(/anteriores/)).toBeNull();
  });

  it("diz DIAS, e não sábados, quando a régua caiu para todos os dias", () => {
    // "Medido contra 71 sábados anteriores" numa loja que tem 3 sábados é falso,
    // e é a primeira frase que se lê.
    render(<PromotionScorePanel score={nota({ rulerOccurrences: 71, rulerFellBackToAllDays: true })} />);

    expect(screen.getByText(/71 dias/)).toBeTruthy();
    expect(screen.queryByText(/71 sábados/)).toBeNull();
  });

  it("nomeia o dia da semana no impulso quando a régua é dele", () => {
    // A régua é de sábados, e sábado fatura 1,75× o dia médio: chamar a
    // referência de "dia comum" subestimaria o múltiplo.
    render(<PromotionScorePanel score={nota({ impulseMultiplier: 40 })} />);

    expect(screen.getByText(/sábado normal/)).toBeTruthy();
  });

  it("concorda no singular quando uma venda só passou do limite", () => {
    render(<PromotionScorePanel score={nota({ salesOverLimit: 1 })} />);

    expect(screen.getByText(/venda passou do limite/)).toBeTruthy();
  });

  it("não afirma 0× o normal quando não houve venda", () => {
    // `ImpulseMultiplier(0, x)` é 0, e "Vendeu 0× o que o produto sai num sábado
    // normal" é a mesma afirmação de fracasso que o velocímetro logo acima se
    // recusa a fazer.
    render(<PromotionScorePanel score={nota({ class: "NoSales", score: 0, impulseMultiplier: 0 })} />);

    expect(screen.queryByText(/sábado normal/)).toBeNull();
  });

  it("declara que o esgotamento é inferência", () => {
    // A loja não guarda a série do saldo, pelo mesmo motivo que o giro do BI é
    // sell-through. Afirmar "esgotou" sem essa ressalva seria inventar histórico.
    render(<PromotionScorePanel score={nota({ lastSaleAt: "2026-09-19T15:20:00", groupStock: 0 })} />);

    expect(screen.getByText(/é inferência/)).toBeTruthy();
  });

  it("não fala em esgotamento quando ainda há saldo", () => {
    render(<PromotionScorePanel score={nota({ lastSaleAt: "2026-09-19T15:20:00", groupStock: 12 })} />);

    expect(screen.queryByText(/é inferência/)).toBeNull();
  });
});

describe("PromotionInvestmentPanel", () => {
  it("separa o exato do estimado", () => {
    render(<PromotionInvestmentPanel investment={investimento()} showPerDay={false} soldUnits={40} />);

    expect(screen.getByText("Investimento")).toBeTruthy();
    expect(screen.getByText("Arraste")).toBeTruthy();
    // Duas linhas da escada são estimativa, e a tela precisa dizer qual é qual.
    expect(screen.getAllByText("estimativa")).toHaveLength(2);
  });

  it("esconde o por dia na relâmpago", () => {
    // "R$ 10 por dia" é decisão numa promoção de 90 dias; numa de quatro horas é
    // o mesmo número do total, escrito duas vezes.
    render(<PromotionInvestmentPanel investment={investimento()} showPerDay={false} soldUnits={40} />);

    expect(screen.queryByText("Por dia")).toBeNull();
  });

  it("troca a escada pela frase na promoção de destaque", () => {
    // "Retorno por R$ 0,00 investido" não é resposta: ali quem responde é o
    // impulso.
    render(
      <PromotionInvestmentPanel
        investment={investimento({ amount: 0, isShowcaseOnly: true, returnPerInvestedReal: null })}
        showPerDay={false}
        soldUnits={40}
      />,
    );

    expect(screen.getByText(/Sem investimento/)).toBeTruthy();
    expect(screen.queryByText("Arraste")).toBeNull();
  });

  it("não chama de destaque a promoção que apenas ainda não vendeu", () => {
    // REGRESSÃO: enquanto "destaque" era "investimento igual a zero", toda
    // relâmpago aberta antes da primeira venda afirmava "esta promoção não corta
    // preço" sobre um cartaz de 43% de desconto — e escondia a escada inteira ao
    // fazê-lo. Quem distingue as duas é a contagem de unidades.
    render(
      <PromotionInvestmentPanel
        investment={investimento({
          amount: 0,
          itemProfit: 0,
          dragProfit: 0,
          returnPerInvestedReal: null,
          isShowcaseOnly: false,
        })}
        showPerDay={false}
        soldUnits={0}
      />,
    );

    expect(screen.getByText(/Nenhuma venda com esta promoção ainda/)).toBeTruthy();
    expect(screen.queryByText(/não corta preço/)).toBeNull();
  });

  it("omite o retorno por real quando não houve investimento a dividir", () => {
    render(
      <PromotionInvestmentPanel
        investment={investimento({ returnPerInvestedReal: null })}
        showPerDay={false}
        soldUnits={40}
      />,
    );

    expect(screen.queryByText("Retorno por real investido")).toBeNull();
  });
});
