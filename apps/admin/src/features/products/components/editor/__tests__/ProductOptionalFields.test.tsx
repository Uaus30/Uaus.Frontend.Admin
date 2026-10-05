import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ProductDto } from "@workspace/api-client-react";

// A última compra vem da mesma consulta de "Último custo" (`product-for-entry`);
// o dublê decide o que o servidor respondeu.
const forEntry = vi.hoisted(() => ({ data: undefined as Partial<ProductDto> | undefined }));
vi.mock("../../../hooks/useProductForEntry", () => ({
  useProductForEntry: () => ({ data: forEntry.data, isLoading: false }),
}));

const { ProductOptionalFields } = await import("../ProductOptionalFields");
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
function fakeEditor(
  overrides: Partial<{
    form: ProductGroupForm;
    setForm: unknown;
    productEditor: unknown;
    stockControl: unknown;
  }> = {},
) {
  return {
    form: FORM_BASE,
    setForm: vi.fn(),
    productEditor: createEmptyProductEditor(),
    setProductEditor: vi.fn(),
    tags: [],
    registerTag: vi.fn(),
    stockControl: {
      view: { state: "on", reason: null, disabledCount: 0, total: 1 },
      choose: vi.fn(),
      defaultMinStock: 2,
      forecastStatus: "Controlled",
      monthlySalesMedian: 3.5,
    },
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

describe("ProductOptionalFields — controle de estoque", () => {
  it("mínimo zero aparece vazio, com o padrão da loja e o caminho até ele", () => {
    // Mostrar 0 leria como "mínimo zero"; zero é "usa o padrão da loja".
    renderAba(fakeEditor());

    const campo = screen.getByPlaceholderText("Padrão da loja (2)") as HTMLInputElement;
    expect(campo.value).toBe("");
    const link = screen.getByTitle("Abrir as Configurações de estoque");
    expect(link.getAttribute("href")).toBe("/configuracoes#estoque");
    // Em nova aba: sair da página perderia o cadastro aberto sem perguntar.
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("continua em nova aba também no app do iPhone, onde ela abre no Safari", () => {
    // Decisão do dono (05/10/2026): no iPhone a nova aba pede login no Safari
    // uma vez, mas na mesma janela o que foi digitado no cadastro se perderia.
    // Não troque por `adminNewTabProps` — ele é só para tela de consulta.
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    try {
      renderAba(fakeEditor());

      expect(screen.getByTitle("Abrir as Configurações de estoque").getAttribute("target")).toBe("_blank");
    } finally {
      Reflect.deleteProperty(navigator, "standalone");
    }
  });

  it("mínimo próprio aparece no campo", () => {
    renderAba(fakeEditor({ productEditor: { ...createEmptyProductEditor(), minStock: 7 } }));

    expect((screen.getByPlaceholderText("Padrão da loja (2)") as HTMLInputElement).value).toBe("7");
  });

  it("desligar o interruptor registra a escolha, sem motivo", () => {
    const choose = vi.fn();
    renderAba(
      fakeEditor({
        stockControl: {
          view: { state: "on", reason: null, disabledCount: 0, total: 1 },
          choose,
          defaultMinStock: 2,
          forecastStatus: null,
          monthlySalesMedian: null,
        },
      }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Controlar estoque" }));

    expect(choose).toHaveBeenCalledWith({ enabled: false, reason: null });
  });

  it("conta o que a rotina diária sabe do produto", () => {
    renderAba(
      fakeEditor({
        stockControl: {
          view: { state: "on", reason: null, disabledCount: 0, total: 1 },
          choose: vi.fn(),
          defaultMinStock: 2,
          forecastStatus: "LowTurnover",
          monthlySalesMedian: 0.5,
        },
      }),
    );

    expect(screen.getByText(/Giro baixo \(0,5 por mês\)/)).toBeTruthy();
  });

  it("no grupo com variações desligadas em parte, avisa o estado misto", () => {
    renderAba(
      fakeEditor({
        form: { ...FORM_BASE, hasVariations: true },
        stockControl: {
          view: { state: "mixed", reason: null, disabledCount: 1, total: 3 },
          choose: vi.fn(),
          defaultMinStock: 2,
          forecastStatus: null,
          monthlySalesMedian: null,
        },
      }),
    );

    expect(screen.getByText(/1 de 3 variações estão com o controle desligado/)).toBeTruthy();
  });
});

describe("ProductOptionalFields — última compra abaixo do estoque mínimo (04/10/2026)", () => {
  it("mostra quantas unidades vieram na última compra e quando", () => {
    forEntry.data = { lastPurchaseQuantity: 3, lastPurchaseDate: "2026-09-12T00:00:00" };
    renderAba(fakeEditor({ productEditor: { ...createEmptyProductEditor(), id: 7 } }));

    expect(screen.getByText(/Última compra:/).textContent).toBe("Última compra: 3 un em 12/09/2026");
    forEntry.data = undefined;
  });

  it("sem compra registrada, não mostra nada", () => {
    forEntry.data = {};
    renderAba(fakeEditor({ productEditor: { ...createEmptyProductEditor(), id: 7 } }));

    expect(screen.queryByText(/Última compra:/)).toBeNull();
    forEntry.data = undefined;
  });

  it("o estoque atual saiu daqui: ele já está na aba Dados", () => {
    renderAba(fakeEditor());

    expect(screen.queryByText("Estoque atual")).toBeNull();
  });
});
