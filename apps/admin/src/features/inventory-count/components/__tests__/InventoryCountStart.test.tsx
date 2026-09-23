import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InventoryCountDto } from "@workspace/api-client-react";
import { InventoryCountStart } from "../InventoryCountStart";

const ultima: InventoryCountDto = {
  id: 6,
  status: "Finished",
  statusName: "Encerrada",
  startedAt: "2026-09-22T09:00:00",
  finishedAt: "2026-09-22T18:00:00",
  totalItems: 933,
  reviewedItems: 18,
  pendingItems: 915,
};

describe("InventoryCountStart", () => {
  it("avisa que o estoque congela ANTES de oferecer o botão", () => {
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={null}
        onStart={vi.fn()}
        startingMode={null}
        loadFailed={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/o estoque fica congelado/i)).toBeTruthy();
  });

  it("sem rodada anterior, só há o recomeço do catálogo inteiro", () => {
    const onStart = vi.fn();
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={null}
        onStart={onStart}
        startingMode={null}
        loadFailed={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /continuar de onde parou/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /nova conferência/i }));

    expect(onStart).toHaveBeenCalledWith("Restart");
  });

  it("com pendentes na última rodada, oferece continuar — e recomeçar do zero pede confirmação", async () => {
    // Sem a confirmação, um clique no botão ao lado do Continuar apagaria o
    // ponto de partida da próxima rodada.
    const onStart = vi.fn();
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={ultima}
        onStart={onStart}
        startingMode={null}
        loadFailed={false}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar de onde parou (915)" }));
    expect(onStart.mock.calls).toEqual([["Continue"]]);

    fireEvent.click(screen.getByRole("button", { name: /recomeçar do zero/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo.textContent).toContain("915");

    fireEvent.click(within(dialogo).getByRole("button", { name: /recomeçar do zero/i }));
    await waitFor(() => expect(onStart.mock.calls).toEqual([["Continue"], ["Restart"]]));
  });

  it("sem conseguir carregar, pede nova tentativa em vez de oferecer só o recomeço", () => {
    const onRetry = vi.fn();
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={null}
        onStart={vi.fn()}
        startingMode={null}
        loadFailed
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByRole("button", { name: /nova conferência/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("o andamento aparece no botão clicado, e os dois ficam travados", () => {
    // Era o defeito: clicar em "Recomeçar do zero" girava o "Continuar".
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={ultima}
        onStart={vi.fn()}
        startingMode="Restart"
        loadFailed={false}
        onRetry={vi.fn()}
      />,
    );

    const recomecar = screen.getByRole("button", { name: /montando a lista/i });
    const continuar = screen.getByRole("button", { name: "Continuar de onde parou (915)" });

    expect(within(recomecar).getByRole("status")).toBeTruthy();
    expect(within(continuar).queryByRole("status")).toBeNull();
    expect(recomecar.hasAttribute("disabled")).toBe(true);
    expect(continuar.hasAttribute("disabled")).toBe(true);
  });

  it("última rodada sem pendentes não oferece continuar", () => {
    render(
      <InventoryCountStart
        isLoading={false}
        lastCount={{ ...ultima, reviewedItems: 933, pendingItems: 0 }}
        onStart={vi.fn()}
        startingMode={null}
        loadFailed={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /continuar de onde parou/i })).toBeNull();
    expect(screen.getByRole("button", { name: /nova conferência/i })).toBeTruthy();
  });
});
