import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetPurchasesSummary: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchasesSummary: mocks.useGetPurchasesSummary,
}));

const { OpenPurchasesAlert } = await import("../OpenPurchasesAlert");

function renderAlert(summary: { pending: number; inTransit: number } | undefined) {
  mocks.useGetPurchasesSummary.mockReturnValue({ data: summary });
  render(<OpenPurchasesAlert />);
}

describe("OpenPurchasesAlert", () => {
  afterEach(() => cleanup());

  it("conta as duas situações separadas, no plural certo", () => {
    renderAlert({ pending: 2, inTransit: 1 });

    // Separadas porque pedem ações diferentes: a pendente espera alguém
    // comprar; a que está a caminho espera a mercadoria chegar.
    expect(screen.getByText("2 compras pendentes e 1 compra a caminho")).toBeTruthy();
    expect(screen.getByTestId("open-purchases-alert").getAttribute("href")).toBe("/estoque/compras");
  });

  it("omite a situação que está zerada", () => {
    renderAlert({ pending: 0, inTransit: 3 });

    expect(screen.getByText("3 compras a caminho")).toBeTruthy();
    expect(screen.queryByText(/pendente/i)).toBeNull();
  });

  it("some quando não há compra em aberto", () => {
    renderAlert({ pending: 0, inTransit: 0 });

    // Faixa permanente no painel vira moldura, e moldura ninguém lê.
    expect(screen.queryByTestId("open-purchases-alert")).toBeNull();
  });

  it("não aparece enquanto a consulta não respondeu", () => {
    renderAlert(undefined);

    expect(screen.queryByTestId("open-purchases-alert")).toBeNull();
  });
});
