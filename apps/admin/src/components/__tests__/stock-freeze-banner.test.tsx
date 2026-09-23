import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetStockFreezeStatus: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: mocks.useGetStockFreezeStatus,
}));

const { StockFreezeBanner } = await import("../stock-freeze-banner");

describe("StockFreezeBanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem conferência aberta, não ocupa espaço", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });

    render(<StockFreezeBanner />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("enquanto a status carrega, também não — a faixa aparece depois, nunca antes", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: undefined });

    render(<StockFreezeBanner />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("com a conferência aberta, diz o que está pausado e leva a quem pode encerrar", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({
      data: { salesPaused: true, pausedSince: "2026-09-23T18:30:00", pausedReason: "..." },
    });

    render(<StockFreezeBanner />);

    const faixa = screen.getByRole("status");
    expect(faixa.textContent).toContain("Conferência de estoque em andamento desde 23/09/2026");
    expect(faixa.textContent).toContain("vendas, entradas, baixas e cancelamentos estão pausados");
    expect(screen.getByRole("link", { name: "Ver conferência" }).getAttribute("href")).toContain(
      "conferencia",
    );
  });
});
