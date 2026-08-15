import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import {
  createPartner,
  deletePartner,
  getGetPartnersQueryKey,
  PARTNER_PROFIT_SHARES_QUERY_KEY,
  updatePartner,
  updatePartnerProfitShares,
  useGetPartnerProfitShares,
  useGetPartners,
  type PartnerDto,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api-error";
import type { PartnerFormValues } from "../types";

/** Itens por página na tabela de sócios. */
export const PAGE_SIZE = 10;

const EMPTY_FORM: PartnerFormValues = { name: "", isActive: true };

/** Remove acentos e caixa para a busca local por nome. */
function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Arredonda a 2 casas — mesma precisão do percentual no backend (numeric(5,2)). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * usePartners
 *
 * Hook controlador da feature de Sócios: CRUD do cadastro e edição da
 * distribuição de lucros (percentual de cada sócio ativo, soma obrigatória de
 * 100,00). O endpoint de listagem não tem busca — o filtro por nome é local,
 * sobre a página carregada, com debounce de 300ms.
 */
export function usePartners() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ---------------------------------------------------------------- Cadastro
  const [searchVal, setSearchVal] = useState("");
  const search = useDebounce(searchVal, 300);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerDto | null>(null);
  const [form, setForm] = useState<PartnerFormValues>(EMPTY_FORM);

  // Reseta a página ao buscar
  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: partnersPage, isLoading } = useGetPartners({
    includeInactive: true,
    page,
    limit: PAGE_SIZE,
  });

  // Excluir o último item da última página deixaria a tela presa numa página
  // vazia — quando a página atual deixa de existir, recua para a última.
  useEffect(() => {
    const totalPages = partnersPage?.totalPages;
    if (totalPages != null && totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [partnersPage?.totalPages, page]);

  // Filtro local: o GET /partners não aceita busca; com poucos sócios, filtrar
  // a página carregada resolve sem inventar parâmetro fora do contrato.
  const partners = useMemo(() => {
    const items = partnersPage?.data ?? [];
    const term = normalizeText(search);
    if (!term) return items;
    return items.filter((item) => normalizeText(item.name).includes(term));
  }, [partnersPage?.data, search]);

  const editingId = editingPartner?.id ?? null;

  /**
   * Abre a modal de cadastro/edição de sócio.
   *
   * @param partner Sócio a ser carregado em modo de edição (opcional).
   */
  function handleOpenModal(partner?: PartnerDto) {
    if (partner) {
      setEditingPartner(partner);
      setForm({ name: partner.name, isActive: partner.isActive });
    } else {
      setEditingPartner(null);
      setForm(EMPTY_FORM);
    }

    setModalOpen(true);
  }

  /** Fecha a modal e descarta o formulário. */
  function closeModal() {
    setModalOpen(false);
    setEditingPartner(null);
  }

  const saveMutation = useMutation({
    mutationFn: async (input: { id: number | null; values: PartnerFormValues }) => {
      if (input.id) {
        await updatePartner(input.id, {
          name: input.values.name.trim(),
          isActive: input.values.isActive,
        });
      } else {
        await createPartner({ name: input.values.name.trim() });
      }
    },
    onSuccess: async (_, input) => {
      // A edição pode mudar nome e status — os dois aparecem também na
      // distribuição de lucros, então as duas chaves são invalidadas.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartnersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: PARTNER_PROFIT_SHARES_QUERY_KEY }),
      ]);

      const deactivated = editingPartner?.isActive === true && !input.values.isActive;
      toast({
        title: input.id ? "Sócio atualizado." : "Sócio cadastrado.",
        description: deactivated
          ? "O percentual foi zerado — rebalanceie a distribuição antes do próximo fechamento."
          : undefined,
      });
      closeModal();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar sócio",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /**
   * Envia o formulário de sócio para cadastrar ou atualizar.
   */
  function handleSubmitPartner(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast({
        title: "Preencha o nome do sócio",
        description: "O nome é obrigatório para cadastrar ou editar um sócio.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({ id: editingId, values: form });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePartner(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartnersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: PARTNER_PROFIT_SHARES_QUERY_KEY }),
      ]);
      toast({ title: "Sócio removido." });
    },
    onError: (error: unknown) => {
      // Sócio com fechamento registrado não pode sair: o backend devolve a
      // mensagem orientando a desativar, e ela vai inteira para o toast.
      toast({
        title: "Erro ao remover sócio",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /**
   * Remove um sócio após confirmação.
   *
   * Ignora o clique com uma exclusão em andamento — segundo clique no mesmo
   * botão não pode disparar a mutação duplicada.
   *
   * @param partner Sócio a ser removido (o nome entra na confirmação).
   */
  function handleDeletePartner(partner: PartnerDto) {
    if (deleteMutation.isPending) return;
    if (!window.confirm(`Remover o sócio "${partner.name}"?`)) return;
    deleteMutation.mutate(partner.id);
  }

  // ------------------------------------------------- Distribuição de lucros
  const { data: profitShares, isLoading: isLoadingShares } = useGetPartnerProfitShares();

  /** Somente sócios ATIVOS entram na edição — o backend exige exatamente esse conjunto. */
  const activeShares = useMemo(
    () => (profitShares?.shares ?? []).filter((share) => share.isActive),
    [profitShares?.shares],
  );

  const [draftPercentages, setDraftPercentages] = useState<Record<number, string>>({});

  // A sincronia depende dos VALORES do servidor, não do objeto da query: um
  // refetch que traz os mesmos percentuais não pode apagar o que o usuário
  // digitou e ainda não salvou (mesma doutrina do useCompanySettings).
  const serverFingerprint = useMemo(
    () => activeShares.map((share) => `${share.partnerId}:${share.percentage}`).join("|"),
    [activeShares],
  );

  useEffect(() => {
    const next: Record<number, string> = {};
    if (serverFingerprint) {
      for (const entry of serverFingerprint.split("|")) {
        const [partnerId, percentage] = entry.split(":");
        next[Number(partnerId)] = percentage;
      }
    }
    setDraftPercentages(next);
  }, [serverFingerprint]);

  /** Atualiza o percentual digitado de um sócio. */
  function setSharePercentage(partnerId: number, value: string) {
    setDraftPercentages((current) => ({ ...current, [partnerId]: value }));
  }

  /**
   * Normaliza o percentual digitado para 2 casas ao sair do campo — a precisão
   * que o backend aceita (numeric(5,2)); mais casas seriam recusadas.
   */
  function handleSharePercentageBlur(partnerId: number) {
    const raw = draftPercentages[partnerId];
    if (raw == null || raw.trim() === "") return;

    const value = Number(raw);
    if (!Number.isFinite(value)) return;

    setDraftPercentages((current) => ({ ...current, [partnerId]: String(round2(value)) }));
  }

  // Percentuais na precisão do payload: arredondados a 2 casas POR SÓCIO. O
  // gate da soma usa ESTES números — validar a soma dos valores crus deixaria
  // o cliente liberar um payload que o servidor recusa (ex.: 33,335 + 33,335 +
  // 33,33 soma 100 cru, mas arredondado por sócio vira 100,01).
  const parsedShares = useMemo(
    () =>
      activeShares.map((share) => ({
        partnerId: share.partnerId,
        percentage: round2(Number(draftPercentages[share.partnerId] ?? "")),
      })),
    [activeShares, draftPercentages],
  );

  const sharesAreNumbers = parsedShares.every(
    (share) => Number.isFinite(share.percentage) && share.percentage >= 0,
  );

  /** Soma ao vivo dos percentuais já arredondados — os mesmos números do payload. */
  const sharesSum = round2(
    parsedShares.reduce(
      (total, share) => total + (Number.isFinite(share.percentage) ? share.percentage : 0),
      0,
    ),
  );

  const isSharesSumValid = sharesAreNumbers && sharesSum === 100;

  const sharesDirty = activeShares.some(
    (share) => round2(Number(draftPercentages[share.partnerId] ?? "")) !== round2(share.percentage),
  );

  /** Salvar só libera com soma 100, valores válidos e alguma mudança pendente. */
  const canSaveShares = isSharesSumValid && sharesDirty;

  const sharesMutation = useMutation({
    // `parsedShares` já está arredondado por sócio — o payload envia
    // exatamente os números que o gate da soma validou.
    mutationFn: () => updatePartnerProfitShares({ shares: parsedShares }),
    onSuccess: async () => {
      // O percentual também aparece na listagem de sócios — invalida as duas.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PARTNER_PROFIT_SHARES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: getGetPartnersQueryKey() }),
      ]);
      toast({
        title: "Distribuição de lucros salva.",
        description: "Os novos percentuais valem para os próximos fechamentos.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar a distribuição",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Submete a distribuição de lucros. Sem condição de salvar, não chama a API. */
  function handleSaveShares(event: React.FormEvent) {
    event.preventDefault();
    if (!canSaveShares) return;
    sharesMutation.mutate();
  }

  return {
    // Cadastro
    searchVal,
    setSearchVal,
    page,
    setPage,
    partners,
    pagination: partnersPage
      ? {
          page: partnersPage.page,
          size: PAGE_SIZE,
          filteredItems: partnersPage.total,
          totalPages: partnersPage.totalPages,
        }
      : undefined,
    isLoading,
    modalOpen,
    editingId,
    editingWasActive: editingPartner?.isActive ?? false,
    form,
    setForm,
    handleOpenModal,
    closeModal,
    handleSubmitPartner,
    handleDeletePartner,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // Distribuição de lucros
    activeShares,
    isLoadingShares,
    draftPercentages,
    setSharePercentage,
    handleSharePercentageBlur,
    sharesSum,
    isSharesSumValid,
    canSaveShares,
    handleSaveShares,
    isSavingShares: sharesMutation.isPending,
  };
}
