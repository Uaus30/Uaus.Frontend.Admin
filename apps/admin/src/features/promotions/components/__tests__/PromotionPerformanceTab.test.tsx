import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromotionPerformanceDto } from "@workspace/api-client-react";

/**
 * A ABA inteira — o container que os testes dos painéis não alcançam.
 *
 * Os dois defeitos que passaram por aqui nasceram exatamente nesse vão: o ramo de
 * erro não existia (a aba girava para sempre) e os dois painéis nunca foram
 * renderizados juntos, então ninguém viu o impulso verde ao lado da frase que diz
 * que a promoção não vendeu nada.
 */

const mocks = vi.hoisted(() => ({ useGetPromotionPerformance: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPromotionPerformance: mocks.useGetPromotionPerformance,
}));

const { PromotionPerformanceTab } = await import("../PromotionPerformanceTab");

function desempenho(parcial: Partial<PromotionPerformanceDto> = {}): PromotionPerformanceDto {
  return {
    promotionId: 5,
    // Pelo NOME, como a API manda de verdade.
    type: "Everyday",
    validFrom: "2026-09-01T00:00:00",
    validUntil: "2026-09-30T23:59:59",
    isRunning: false,
    soldUnits: 0,
    salesCount: 0,
    revenue: 0,
    investment: {
      amount: 0,
      perDay: 0,
      itemProfit: 0,
      dragProfit: 0,
      baselineProfit: 0,
      balance: 0,
      isShowcaseOnly: false,
    },
    everyday: {
      days: 30,
      unitsPerDay: 3.5,
      unitsPerDayBefore: 3.4,
      impulsePercent: 2.9,
      marginPercent: 41,
      marginPercentBefore: 44,
      ticket: 30,
      storeTicket: 27.75,
    },
    companions: [],
    groupHistory: [],
    ...parcial,
  };
}

describe("PromotionPerformanceTab", () => {
  beforeEach(() => mocks.useGetPromotionPerformance.mockReset());

  it("mostra o erro em vez de girar para sempre", () => {
    // REGRESSÃO: sem o ramo de erro, `isLoading` falso com `data` indefinido caía
    // de volta no spinner — sem toast e sem mensagem, com o dono concluindo que a
    // tela travou.
    mocks.useGetPromotionPerformance.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<PromotionPerformanceTab promotionId={5} />);

    expect(screen.getByText(/Não foi possível carregar/)).toBeTruthy();
  });

  it("espera com spinner quando ainda não há dado nem erro", () => {
    // É o estado do navegador OFFLINE: o React Query pausa a consulta e
    // `isLoading` fica falso. Pintar "não foi possível carregar" ali afirmaria
    // uma falha que não aconteceu.
    mocks.useGetPromotionPerformance.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<PromotionPerformanceTab promotionId={5} />);

    expect(screen.getByText(/Medindo a promoção/)).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
  });

  it("avisa que o movimento não é do patamar quando nada foi atribuído a ele", () => {
    // REGRESSÃO: o painel do Dia a Dia passou a medir o GRUPO, então um patamar
    // que nunca se aplicou — coberto pela relâmpago do sábado, ou desativado
    // antes da primeira venda — mostrava "Impulso +2,9%" em VERDE logo acima da
    // escada que diz "nenhuma venda com esta promoção ainda".
    mocks.useGetPromotionPerformance.mockReturnValue({
      data: desempenho({ soldUnits: 0 }),
      isLoading: false,
      isError: false,
    });

    render(<PromotionPerformanceTab promotionId={5} />);

    expect(screen.getByText(/Nenhuma venda foi atribuída a este patamar/)).toBeTruthy();
    expect(screen.getByText(/Nenhuma venda com esta promoção ainda/)).toBeTruthy();
  });

  it("não repete o aviso quando o patamar vendeu", () => {
    mocks.useGetPromotionPerformance.mockReturnValue({
      data: desempenho({ soldUnits: 40, salesCount: 12 }),
      isLoading: false,
      isError: false,
    });

    render(<PromotionPerformanceTab promotionId={5} />);

    expect(screen.queryByText(/Nenhuma venda foi atribuída/)).toBeNull();
  });

  it("nomeia o que cada número mede, porque os dois convivem na tela", () => {
    // "Unidades no preço promocional: 10" logo acima de "Unidades por dia: 2" numa
    // promoção de 11 dias (= 22) é a tela se contradizendo. Um é o CARIMBO, o
    // outro é o MOVIMENTO do produto, e o rótulo passou a dizer qual é qual.
    mocks.useGetPromotionPerformance.mockReturnValue({
      data: desempenho({ soldUnits: 10 }),
      isLoading: false,
      isError: false,
    });

    render(<PromotionPerformanceTab promotionId={5} />);

    expect(screen.getByText("Unidades no preço promocional")).toBeTruthy();
    expect(screen.getByText("Unidades do produto por dia")).toBeTruthy();
    expect(screen.getByText("Margem do produto")).toBeTruthy();
  });
});
