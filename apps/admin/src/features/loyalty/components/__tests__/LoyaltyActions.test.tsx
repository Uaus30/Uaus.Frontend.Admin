import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LoyaltyActionCountsDto } from "@workspace/api-client-react";
import { LoyaltyActionDialog, LoyaltyActions } from "../LoyaltyActions";

const counts: LoyaltyActionCountsDto = {
  rewardsWaiting: 3,
  oneStampAway: 2,
  expiringSoon: 0,
  inGrace: 1,
  inactive: 4,
  birthdays: 5,
};

describe("LoyaltyActions", () => {
  it("cada número abre a lista dos clientes que ele conta", () => {
    const onOpen = vi.fn();
    render(<LoyaltyActions counts={counts} isLoading={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /A 1 carimbo de um prêmio\s*2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Aniversariantes do mês\s*5/ }));

    expect(onOpen.mock.calls).toEqual([["one-away"], ["birthdays"]]);
  });
});

describe("LoyaltyActionDialog", () => {
  it("mostra carimbos e prêmio só nas listas que têm, e o aniversário sem o ano", () => {
    render(
      <LoyaltyActionDialog
        list="birthdays"
        rows={[{ customerId: 1, name: "Ana", phone: "44991234567", date: "1990-10-15T00:00:00" }]}
        isLoading={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Ana")).not.toBeNull();
    expect(screen.getByText("15/10")).not.toBeNull();
    expect(screen.queryByText("Carimbos")).toBeNull();
    expect(screen.queryByText("Prêmio")).toBeNull();
  });

  it("lista vazia diz que não há ninguém hoje", () => {
    render(<LoyaltyActionDialog list="grace" rows={[]} isLoading={false} onClose={vi.fn()} />);

    expect(screen.getByText("Ninguém nesta lista hoje.")).not.toBeNull();
  });
});
