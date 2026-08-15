import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFixedCost,
  deleteFixedCost,
  getGetFixedCostsQueryKey,
  updateFixedCost,
  useGetFixedCosts,
  type FixedCostDto,
  type SaveFixedCostPayload,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import type { FixedCostForm } from "../types";

/** Tamanho fixo da página da listagem. */
export const PAGE_SIZE = 10;

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Competência atual no formato "yyyy-MM". */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Extrai a competência ("yyyy-MM") de uma data da API ("yyyy-MM-ddT...").
 *
 * O recorte é feito na string de propósito: criar `Date` aqui poderia deslocar
 * o mês por fuso horário, e a competência é um dado de calendário, não de hora.
 */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Converte a competência do form ("yyyy-MM") para a data aceita pelo backend ("yyyy-MM-01"). */
export function monthKeyToPayloadDate(monthKey: string): string {
  return `${monthKey}-01`;
}

/** Formata uma competência ("yyyy-MM" ou data ISO completa) como "ago/2026". */
export function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const label = MONTH_LABELS[Number(month) - 1] ?? "?";
  return `${label}/${year}`;
}

/**
 * Vigente = sem competência final OU final ainda não passou (>= mês atual).
 * Comparação lexicográfica de "yyyy-MM" — o formato ordena como data.
 */
export function isFixedCostActive(cost: FixedCostDto): boolean {
  return cost.endsOn == null || monthKeyOf(cost.endsOn) >= currentMonthKey();
}

/** Formulário em branco: começa com a vigência iniciando na competência atual. */
function emptyForm(): FixedCostForm {
  return { name: "", monthlyAmount: "", startsOn: currentMonthKey(), endsOn: "", notes: "" };
}

/**
 * useFixedCosts
 *
 * Hook controlador da feature de custos fixos: listagem paginada com busca
 * debounced, formulário de cadastro/edição e as ações de encerrar/excluir.
 *
 * Regra do módulo: custo fixo entra no fechamento por competência mensal, sem
 * pró-rata — cada mês tocado pela vigência lança o valor mensal cheio.
 */
export function useFixedCosts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Busca com debounce de 300ms (padrão useSuppliers): o texto digitado só
  // vira filtro aplicado depois da pausa, e toda busca volta para a página 1.
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: pagedData, isLoading } = useGetFixedCosts({
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });

  // Excluir o último item da última página deixaria a tela presa numa página
  // vazia — quando a página atual deixa de existir, recua para a última.
  useEffect(() => {
    const totalPages = pagedData?.totalPages;
    if (totalPages != null && totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [pagedData?.totalPages, page]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FixedCostForm>(emptyForm);

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: getGetFixedCostsQueryKey() });

  const saveMutation = useMutation({
    // O retorno explícito une os tipos das duas funções puras (update devolve o
    // DTO, create devolve o ID criado) — sem ele o TS recusa a união de Promises.
    mutationFn: async (
      input: { id: number | null; payload: SaveFixedCostPayload },
    ): Promise<FixedCostDto | number | null> =>
      input.id ? updateFixedCost(input.id, input.payload) : createFixedCost(input.payload),
    onSuccess: async (_result, input) => {
      await invalidateList();
      toast({ title: input.id ? "Custo fixo atualizado." : "Custo fixo cadastrado." });
      setModalOpen(false);
      setEditingId(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar o custo fixo",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  const endMutation = useMutation({
    mutationFn: (input: { cost: FixedCostDto; endMonth: string }) =>
      updateFixedCost(input.cost.id, {
        name: input.cost.name,
        monthlyAmount: input.cost.monthlyAmount,
        startsOn: monthKeyToPayloadDate(monthKeyOf(input.cost.startsOn)),
        endsOn: monthKeyToPayloadDate(input.endMonth),
        notes: input.cost.notes,
      }),
    onSuccess: async () => {
      await invalidateList();
      toast({
        title: "Custo fixo encerrado.",
        description: "Ele ainda conta na competência final e sai dos meses seguintes.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao encerrar o custo fixo",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFixedCost(id),
    onSuccess: async () => {
      await invalidateList();
      toast({ title: "Custo fixo excluído." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao excluir o custo fixo",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Abre a modal em modo de cadastro, com o formulário em branco. */
  function handleOpenCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  /** Abre a modal em modo de edição, convertendo as datas da API para "yyyy-MM". */
  function handleOpenEdit(cost: FixedCostDto) {
    setEditingId(cost.id);
    setForm({
      name: cost.name,
      monthlyAmount: String(cost.monthlyAmount),
      startsOn: monthKeyOf(cost.startsOn),
      endsOn: cost.endsOn ? monthKeyOf(cost.endsOn) : "",
      notes: cost.notes ?? "",
    });
    setModalOpen(true);
  }

  /** Fecha a modal descartando o que não foi salvo. */
  function handleCloseModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  /** Valida o formulário e cadastra/atualiza o custo fixo. */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const monthlyAmount = Number(form.monthlyAmount);
    if (!form.name.trim() || !form.startsOn || Number.isNaN(monthlyAmount) || monthlyAmount <= 0) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Informe o nome, um valor mensal maior que zero e o mês de início da vigência.",
        variant: "destructive",
      });
      return;
    }

    // "yyyy-MM" ordena como data, então a comparação de strings basta.
    if (form.endsOn && form.endsOn < form.startsOn) {
      toast({
        title: "Vigência inválida",
        description: "O mês final da vigência deve ser igual ou posterior ao mês de início.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      id: editingId,
      payload: {
        name: form.name.trim(),
        monthlyAmount,
        startsOn: monthKeyToPayloadDate(form.startsOn),
        endsOn: form.endsOn ? monthKeyToPayloadDate(form.endsOn) : null,
        notes: form.notes.trim() || null,
      },
    });
  }

  /**
   * Ação rápida "Encerrar": preenche a competência final com o mês atual.
   *
   * Se o custo só começa num mês futuro, encerra na própria competência
   * inicial — o backend exige `endsOn >= startsOn`.
   */
  function handleEndFixedCost(cost: FixedCostDto) {
    // Segundo clique com a mutação em voo não pode disparar encerramento duplicado.
    if (endMutation.isPending) return;

    const startMonth = monthKeyOf(cost.startsOn);
    const nowMonth = currentMonthKey();
    const endMonth = nowMonth >= startMonth ? nowMonth : startMonth;

    const confirmed = window.confirm(
      `Encerrar o custo "${cost.name}" em ${formatMonth(endMonth)}? ` +
        "Ele deixa de entrar nos fechamentos dos meses seguintes.",
    );
    if (!confirmed) return;

    endMutation.mutate({ cost, endMonth });
  }

  /** Exclui o custo de vez, após confirmação. Fechamentos já confirmados não mudam. */
  function handleDelete(cost: FixedCostDto) {
    // Segundo clique com a mutação em voo não pode disparar exclusão duplicada.
    if (deleteMutation.isPending) return;

    const confirmed = window.confirm(
      `Excluir o custo "${cost.name}" de vez? ` +
        'Fechamentos já confirmados não mudam. Para apenas parar a cobrança, prefira "Encerrar".',
    );
    if (!confirmed) return;

    deleteMutation.mutate(cost.id);
  }

  return {
    // Listagem
    fixedCosts: pagedData?.data ?? [],
    pagination: pagedData
      ? { page: pagedData.page, total: pagedData.total, totalPages: pagedData.totalPages }
      : undefined,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput,

    // Modal / formulário
    modalOpen,
    editingId,
    form,
    setForm,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    isSaving: saveMutation.isPending,

    // Ações da tabela
    handleEndFixedCost,
    handleDelete,
    isEnding: endMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
