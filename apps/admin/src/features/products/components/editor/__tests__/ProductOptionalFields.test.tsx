import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ProductOptionalFields } from "../ProductOptionalFields";
import { createEmptyProductEditor } from "../../../hooks/editor/utils";
import type { ProductGroupForm } from "../../../types";
import type { useProductEditor } from "../../../hooks/useProductEditor";

const FORM_BASE: ProductGroupForm = {
  departmentId: "1",
  categoryId: "1",
  productGroupName: "BEXIGA",
  description: "",
  hasVariations: false,
  isPublic: true,
  notes: "",
};

/** O mínimo do `useProductEditor` que esta aba lê. `setForm` aceita o mock OU o `useState` de verdade do harness. */
function fakeEditor(overrides: Partial<{ form: ProductGroupForm; setForm: unknown }> = {}) {
  return {
    form: FORM_BASE,
    setForm: vi.fn(),
    productEditor: createEmptyProductEditor(),
    setProductEditor: vi.fn(),
    tags: [],
    registerTag: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useProductEditor>;
}

/**
 * A aba hospeda `TagMultiSelect`, que consulta o servidor com `useQuery` — sem
 * provider, `useQueryClient` derruba o render inteiro antes de chegar no
 * campo de Observações, que é o que este arquivo testa.
 */
function renderAba(editor: ReturnType<typeof useProductEditor>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductOptionalFields editor={editor} />
    </QueryClientProvider>,
  );
}

describe("ProductOptionalFields — Observações", () => {
  it("comeca vazio quando o grupo nao tem observacao", () => {
    renderAba(fakeEditor());

    const campo = screen.getByPlaceholderText(/fornecedor demora/i) as HTMLTextAreaElement;
    expect(campo.value).toBe("");
  });

  it("carrega a observacao existente do grupo", () => {
    renderAba(fakeEditor({ form: { ...FORM_BASE, notes: "Troca só com nota fiscal" } }));

    const campo = screen.getByPlaceholderText(/fornecedor demora/i) as HTMLTextAreaElement;
    expect(campo.value).toBe("Troca só com nota fiscal");
  });

  it("digitar preserva os outros campos do form, e so muda notes", () => {
    // O campo é CONTROLADO por `form.notes`. Com um `setForm` mockado que não
    // atualiza estado nenhum, o React reverte o valor do textarea de volta ao
    // que `form.notes` diz assim que o evento termina de disparar — e ler
    // `event.target.value` depois desse ponto (mesmo guardando a função e
    // chamando fora do handler) lê o valor JÁ revertido, não o digitado. Um
    // harness com `useState` de verdade é o que faz o campo continuar
    // mostrando o que foi digitado, do jeito que o formulário real se
    // comporta.
    let formAtual = FORM_BASE;
    function Harness() {
      const [form, setForm] = useState(FORM_BASE);
      formAtual = form;
      return <ProductOptionalFields editor={fakeEditor({ form, setForm })} />;
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText(/fornecedor demora/i), {
      target: { value: "novo texto" },
    });

    expect(formAtual).toEqual({ ...FORM_BASE, notes: "novo texto" });

    const campo = screen.getByPlaceholderText(/fornecedor demora/i) as HTMLTextAreaElement;
    expect(campo.value).toBe("novo texto");
  });
});
