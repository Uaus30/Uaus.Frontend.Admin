import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TaskCardMemberDto, TaskLabelDto } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, TooltipProvider } from "@workspace/ui";
import { AssigneePicker, LabelsPicker, PriorityPicker } from "../CardPickers";

const ETIQUETAS: TaskLabelDto[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Etiqueta ${i + 1}`,
  color: "gray",
  priority: 0,
  createdAt: "2026-10-01T00:00:00",
}));

const USUARIOS: TaskCardMemberDto[] = Array.from({ length: 12 }, (_, i) => ({
  userId: i + 1,
  firstName: `Pessoa${i + 1}`,
  fullName: `Pessoa${i + 1} Silva`,
}));

/** Os seletores moram na lateral da tarefa, que é um diálogo (`TaskCardDialog`). */
function noCartao(children: ReactNode) {
  return render(
    <TooltipProvider>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tarefa</DialogTitle>
          <DialogDescription>Tarefa de teste</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    </TooltipProvider>,
  );
}

/**
 * Gira a roda do mouse sobre um item da lista e diz se o evento foi cancelado.
 *
 * O jsdom não faz layout: a lista ganha à mão o que rolar, senão a trava de
 * rolagem não teria o que liberar e cancelaria por falta de espaço.
 */
function rodaCancelada(item: HTMLElement) {
  const lista = item.closest<HTMLElement>("ul");
  if (!lista) throw new Error("lista do seletor não encontrada");
  lista.style.overflowY = "auto";
  Object.defineProperty(lista, "scrollHeight", { configurable: true, value: 600 });
  Object.defineProperty(lista, "clientHeight", { configurable: true, value: 256 });

  const roda = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
  item.dispatchEvent(roda);
  return roda.defaultPrevented;
}

describe("seletores da tarefa dentro do diálogo", () => {
  beforeAll(() => {
    // O Popper do Radix mede o gatilho; o jsdom não tem ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Cancelada é a roda morta: a trava do diálogo engolia o evento porque a lista
  // do popover mora num portal fora da caixa dele.
  it("a roda do mouse rola a lista de etiquetas", () => {
    noCartao(<LabelsPicker labels={ETIQUETAS} selectedIds={[]} onToggle={vi.fn()} onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Etiquetas" }));

    expect(rodaCancelada(screen.getByText("Etiqueta 1"))).toBe(false);
  });

  it("a roda do mouse rola a lista de responsáveis", () => {
    noCartao(<AssigneePicker users={USUARIOS} assignee={USUARIOS[0]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Responsável: Pessoa1 Silva" }));

    expect(rodaCancelada(screen.getAllByText("Pessoa1")[1])).toBe(false);
  });

  it("escolher o responsável troca uma pessoa só e fecha o seletor", () => {
    const onChange = vi.fn();
    noCartao(<AssigneePicker users={USUARIOS} assignee={null} onChange={onChange} />);

    // Sem ninguém (tarefa migrada), o botão pede a escolha.
    fireEvent.click(screen.getByRole("button", { name: "Escolher o responsável" }));
    fireEvent.click(screen.getByText("Pessoa3"));

    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.queryByText("Pessoa4")).toBeNull();
  });

  it("a prioridade é escolhida num toque, com a atual marcada", () => {
    const onChange = vi.fn();
    noCartao(<PriorityPicker value={2} onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Normal" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Urgente" }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("'Gerenciar etiquetas' fecha o seletor antes de abrir o cadastro", () => {
    const onManage = vi.fn();
    noCartao(<LabelsPicker labels={ETIQUETAS} selectedIds={[]} onToggle={vi.fn()} onManage={onManage} />);
    fireEvent.click(screen.getByRole("button", { name: "Etiquetas" }));

    fireEvent.click(screen.getByRole("button", { name: "Gerenciar etiquetas" }));

    expect(onManage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Etiqueta 1")).toBeNull();
  });
});
