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

  it("marca como excluído o componente que saiu da conta", () => {
    const comExcluido = nota({
      renormalizedWithoutTicketAndBasket: true,
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

    expect(screen.getByText("Fora da conta: poucas vendas para medir.")).toBeTruthy();
    expect(screen.getByText(/ticket e arraste são ruído/)).toBeTruthy();
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

    expect(screen.getByLabelText(/Nota 0 de 100 — Sem venda/)).toBeTruthy();
    expect(screen.queryByText(/ticket e arraste são ruído/)).toBeNull();
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
    render(<PromotionInvestmentPanel investment={investimento()} showPerDay={false} />);

    expect(screen.getByText("Investimento")).toBeTruthy();
    expect(screen.getByText("Arraste")).toBeTruthy();
    // Duas linhas da escada são estimativa, e a tela precisa dizer qual é qual.
    expect(screen.getAllByText("estimativa")).toHaveLength(2);
  });

  it("esconde o por dia na relâmpago", () => {
    // "R$ 10 por dia" é decisão numa promoção de 90 dias; numa de quatro horas é
    // o mesmo número do total, escrito duas vezes.
    render(<PromotionInvestmentPanel investment={investimento()} showPerDay={false} />);

    expect(screen.queryByText("Por dia")).toBeNull();
  });

  it("troca a escada pela frase na promoção de destaque", () => {
    // "Retorno por R$ 0,00 investido" não é resposta: ali quem responde é o
    // impulso.
    render(
      <PromotionInvestmentPanel
        investment={investimento({ amount: 0, isShowcaseOnly: true, returnPerInvestedReal: null })}
        showPerDay={false}
      />,
    );

    expect(screen.getByText(/Sem investimento/)).toBeTruthy();
    expect(screen.queryByText("Arraste")).toBeNull();
  });

  it("omite o retorno por real quando não houve investimento a dividir", () => {
    render(
      <PromotionInvestmentPanel
        investment={investimento({ returnPerInvestedReal: null })}
        showPerDay={false}
      />,
    );

    expect(screen.queryByText("Retorno por real investido")).toBeNull();
  });
});
