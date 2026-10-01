import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LoyaltyActionCountsDto, LoyaltyActionRowDto } from "@workspace/api-client-react";
import { LoyaltyActionDialog } from "../LoyaltyActionDialog";
import { LoyaltyActions } from "../LoyaltyActions";

const counts: LoyaltyActionCountsDto = {
  rewardsWaiting: 3,
  oneStampAway: 2,
  expiringSoon: 0,
  inGrace: 1,
  inactive: 4,
  birthdays: 5,
};

const dialogProps = {
  isLoading: false,
  rewardStatus: "available" as const,
  onRewardStatusChange: vi.fn(),
  onClose: vi.fn(),
};

describe("LoyaltyActions", () => {
  it("cada número abre a lista dos clientes que ele conta", () => {
    const onOpen = vi.fn();
    render(<LoyaltyActions counts={counts} isLoading={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /A 1 carimbo de um prêmio\s*2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Aniversariantes do mês\s*5/ }));

    expect(onOpen.mock.calls).toEqual([["one-away"], ["birthdays"]]);
  });

  it("refetch que falha com os números na tela não os apaga", () => {
    render(<LoyaltyActions counts={counts} isLoading={false} isError onRetry={vi.fn()} onOpen={vi.fn()} />);

    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
    expect(screen.getByRole("button", { name: /Aniversariantes do mês\s*5/ })).not.toBeNull();
  });

  it("erro na consulta avisa e deixa tentar de novo, em vez de carregar para sempre", () => {
    const onRetry = vi.fn();
    render(<LoyaltyActions isLoading={false} isError onRetry={onRetry} onOpen={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));

    expect(screen.getByText(/Não foi possível carregar/)).not.toBeNull();
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("LoyaltyActionDialog", () => {
  it("mostra carimbos e prêmio só nas listas que têm, e o aniversário sem o ano", () => {
    render(
      <LoyaltyActionDialog
        {...dialogProps}
        list="birthdays"
        rows={[{ customerId: 1, name: "Ana", phone: "44991234567", date: "1990-10-15T00:00:00" }]}
      />,
    );

    expect(screen.getByText("Ana")).not.toBeNull();
    expect(screen.getByText("15/10")).not.toBeNull();
    expect(screen.queryByText("Carimbos")).toBeNull();
    expect(screen.queryByText("Prêmio")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("lista de prêmios: uma linha por prêmio, com liberação, vencimento e situação", () => {
    const rows: LoyaltyActionRowDto[] = [
      {
        customerId: 1,
        name: "Ana",
        prize: "R$ 5,00",
        unlockedAt: "2026-11-20T10:00:00",
        date: "2027-12-01T23:59:59",
        rewardStatus: "Available",
        expired: false,
      },
      {
        customerId: 1,
        name: "Ana",
        prize: "R$ 5,00",
        unlockedAt: "2026-10-02T10:00:00",
        date: "2027-12-01T23:59:59",
        rewardStatus: "Redeemed",
        redeemedAt: "2026-12-21T10:00:00",
        expired: false,
      },
    ];
    render(<LoyaltyActionDialog {...dialogProps} list="rewards-waiting" rewardStatus="all" rows={rows} />);

    expect(screen.getAllByText("Ana")).toHaveLength(2);
    expect(screen.getByText("Liberado em")).not.toBeNull();
    expect(screen.getByText("Vence em")).not.toBeNull();
    expect(screen.getByText("20/11/2026")).not.toBeNull();
    expect(screen.getByText("Disponível")).not.toBeNull();
    expect(screen.getByText("Trocado em 21/12/2026")).not.toBeNull();
    expect(screen.getByText("2 prêmio(s)")).not.toBeNull();
  });

  it("o filtro de situação troca a lista de prêmios", () => {
    const onRewardStatusChange = vi.fn();
    render(
      <LoyaltyActionDialog
        {...dialogProps}
        list="rewards-waiting"
        rows={[]}
        rewardStatus="expired"
        onRewardStatusChange={onRewardStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Trocados/ }));

    expect(onRewardStatusChange).toHaveBeenCalledWith("redeemed");
    expect(screen.getByText("Nenhum prêmio nesta situação.")).not.toBeNull();
  });

  it("a lista em folga não tem filtro: são os disponíveis de cartão vencido", () => {
    render(<LoyaltyActionDialog {...dialogProps} list="grace" rows={[]} />);

    expect(screen.queryByRole("radio", { name: /Trocados/ })).toBeNull();
    expect(screen.getByText("Ninguém nesta lista hoje.")).not.toBeNull();
  });

  it("erro na lista avisa e deixa tentar de novo", () => {
    const onRetry = vi.fn();
    render(<LoyaltyActionDialog {...dialogProps} list="inactive" isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));

    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByText("A lista não carregou.")).not.toBeNull();
    expect(screen.queryByText("Carregando...")).toBeNull();
  });
});
