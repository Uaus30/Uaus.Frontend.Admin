import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "../confirm-dialog";

/**
 * O que estes testes protegem.
 *
 * O `window.confirm` que este componente substitui era intestável por
 * definição: a decisão do operador nascia fora do React. O ganho só vale se a
 * substituição cobrir os três casos que o nativo garantia de graça — confirmar
 * executa, cancelar não executa — mais o que ele NÃO garantia: o segundo clique
 * durante a ação em voo não pode disparar a exclusão de novo.
 */
describe("ConfirmDialog", () => {
  function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Remover esta categoria?"
        description="A categoria sai do cadastro e a ação não pode ser desfeita."
        confirmLabel="Remover"
        destructive
        onConfirm={onConfirm}
        {...props}
      />,
    );

    return { onConfirm, onOpenChange };
  }

  it("mostra o que se perde e o nome do item afetado", () => {
    renderDialog({ itemName: "Bebidas geladas" });

    expect(screen.getByText("Remover esta categoria?")).toBeTruthy();
    expect(
      screen.getByText("A categoria sai do cadastro e a ação não pode ser desfeita."),
    ).toBeTruthy();
    expect(screen.getByText("Bebidas geladas")).toBeTruthy();
  });

  it("executa a ação e fecha o diálogo ao confirmar", async () => {
    const { onConfirm, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não executa a ação ao cancelar", async () => {
    const { onConfirm, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("desabilita o botão de confirmar enquanto a ação de fora está em voo", () => {
    const { onConfirm } = renderDialog({ loading: true });

    const confirmButton = screen.getByRole("button", { name: /Remover/ });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignora o segundo clique enquanto a confirmação assíncrona não resolve", async () => {
    let releaseConfirm: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseConfirm = resolve;
        }),
    );
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Remover esta venda?"
        description="A venda e seus itens saem do histórico."
        confirmLabel="Remover"
        destructive
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Remover/ });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Enquanto a promessa não resolve o diálogo continua aberto: fechar aqui
    // faria o operador achar que a exclusão terminou.
    expect(onOpenChange).not.toHaveBeenCalled();

    releaseConfirm?.();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("mantém o diálogo aberto quando a ação falha", async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error("500")));
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Remover este fornecedor?"
        description="O fornecedor sai do cadastro."
        confirmLabel="Remover"
        destructive
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Remover/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalled();
    // E o botão volta a aceitar clique, para o operador tentar de novo.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Remover/ }).hasAttribute("disabled")).toBe(false),
    );
  });
});
