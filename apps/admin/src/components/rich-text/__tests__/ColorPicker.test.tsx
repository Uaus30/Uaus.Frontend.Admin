import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";
// O editor é montado aqui: o jsdom precisa das medidas de seleção.
import "./jsdom-layout";
import { RichTextEditingArea } from "../RichTextEditingArea";
import { RichTextEditor } from "../RichTextEditor";

/**
 * Uma área de edição com o editor e, fora dela, outro popover do Radix que pode
 * ser aberto DEPOIS da paleta — vira a camada mais alta, e a paleta deixa de ser
 * a dona do Esc para o Radix.
 */
function Harness({ onCancel }: { onCancel: () => void }) {
  const [otherOpen, setOtherOpen] = useState(false);
  return (
    <>
      <RichTextEditingArea onCancel={onCancel}>
        <RichTextEditor ariaLabel="Solução" onChange={() => undefined} />
      </RichTextEditingArea>
      <button type="button" onClick={() => setOtherOpen(true)}>
        Abrir outra camada
      </button>
      <Popover open={otherOpen} onOpenChange={setOtherOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        {/* Sem puxar o foco: tirá-lo do editor fecharia a paleta por "foco fora". */}
        <PopoverContent onOpenAutoFocus={(event) => event.preventDefault()}>Outra camada</PopoverContent>
      </Popover>
    </>
  );
}

describe("ColorPicker", () => {
  it("Esc no editor com a paleta aberta fecha a paleta e não cancela a edição", async () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    const textbox = screen.getByRole("textbox", { name: "Solução" });

    fireEvent.click(screen.getByRole("button", { name: "Cor do texto" }));
    await screen.findByRole("button", { name: "Vermelho" });

    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: "Vermelho" })).toBeNull());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("vale também quando outra camada do Radix ficou por cima da paleta", async () => {
    // O teste da paleta no quadro de Tarefas falhava às vezes na suíte cheia
    // (07/10/2026): o Esc cancelava a edição com o rascunho. O mecanismo é o
    // da ordem de camadas do Radix — quando a paleta não é a camada que ele
    // considera mais alta, ele não a deixa tratar o Esc, e a tecla seguia até a
    // área de edição. Aqui a ordem é forçada com outra camada aberta depois.
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    const textbox = screen.getByRole("textbox", { name: "Solução" });

    fireEvent.click(screen.getByRole("button", { name: "Cor do texto" }));
    await screen.findByRole("button", { name: "Vermelho" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir outra camada" }));
    await screen.findByText("Outra camada");
    // As duas abertas: a paleta embaixo, a outra camada por cima.
    expect(screen.getByRole("button", { name: "Vermelho" })).toBeTruthy();

    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: "Vermelho" })).toBeNull());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("com a paleta fechada, o Esc no editor é da edição: cancela", () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Solução" }), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
