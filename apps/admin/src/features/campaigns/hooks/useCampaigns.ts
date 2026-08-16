import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  createCampaign,
  deleteCampaign,
  getGetCampaignByIdQueryKey,
  getGetCampaignsQueryKey,
  getGetCouponsQueryKey,
  updateCampaign,
  useGetCampaignById,
  useGetCampaigns,
  useGetCoupons,
  type CampaignDto,
  type SaveCampaignPayload,
} from "@workspace/api-client-react";
import type { CampaignForm, CampaignQuestionDraft } from "../types";
import {
  buildCampaignPayload,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  describeQuestionsProblem,
  draftsFromDto,
  instantToDate,
  instantToTime,
} from "./campaignRules";

/** Itens por página na tabela de campanhas. */
export const PAGE_SIZE = 10;

/** Quantos cupons vinculados a modal lista antes de mandar o usuário à tela de cupons. */
export const LINKED_COUPONS_PAGE_SIZE = 20;

/** Formulário em branco: começa hoje, dia inteiro, campanha ativa. */
function emptyForm(): CampaignForm {
  return {
    name: "",
    description: "",
    startsOnDate: new Date(),
    startsAtTime: DEFAULT_START_TIME,
    endsOnDate: undefined,
    endsAtTime: DEFAULT_END_TIME,
    isActive: true,
  };
}

/**
 * useCampaigns
 *
 * Hook controlador da feature de Campanhas: listagem paginada com busca
 * debounced, formulário de período com data **e hora**, editor de questionário
 * e os cupons vinculados à campanha em edição.
 *
 * A regra que o módulo inteiro serve: a vigência da CAMPANHA decide apenas se o
 * questionário é apresentado no caixa. Quem decide dinheiro é a vigência do
 * CUPOM — cupom válido com campanha encerrada aplica desconto e não pergunta
 * nada.
 */
export function useCampaigns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);

  /**
   * Digitar na busca volta para a primeira página.
   *
   * O recuo acontece aqui, no evento, e não num efeito que observa o termo
   * debounced: efeito que chama `setState` dispara um segundo render em
   * cascata, e o lint deste repositório trata isso como erro.
   */
  function handleSearchChange(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  const { data: pagedData, isLoading } = useGetCampaigns({
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [questions, setQuestions] = useState<CampaignQuestionDraft[]>([]);

  // A LISTAGEM devolve `questions: []` sempre; o questionário só vem na consulta
  // por id. Salvar a partir da linha da tabela sem esperar este detalhe mandaria
  // uma lista vazia — e lista vazia é "apague todas as perguntas".
  const { data: detail, isLoading: isLoadingDetail } = useGetCampaignById(editingId ?? undefined);
  const hydratedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!detail || detail.id !== editingId) return;
    if (hydratedIdRef.current === detail.id) return;
    // Uma hidratação por abertura: sem esta trava, um refetch em segundo plano
    // jogaria fora as perguntas que o usuário está digitando.
    hydratedIdRef.current = detail.id;
    setQuestions(draftsFromDto(detail.questions));
  }, [detail, editingId]);

  // Os cupons de uma campanha saem da tabela de cupons filtrada, e não de uma
  // coleção dentro da campanha: é a mesma listagem paginada da outra tela.
  const { data: linkedCoupons, isLoading: isLoadingCoupons } = useGetCoupons(
    { campaignId: editingId ?? undefined, page: 1, limit: LINKED_COUPONS_PAGE_SIZE },
    { query: { enabled: editingId != null } },
  );

  const invalidateCampaigns = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetCampaignByIdQueryKey() });
    // A linha do cupom carrega `campaignName` já resolvido: renomear a campanha
    // aqui deixaria a outra tela exibindo o nome antigo até o cache expirar.
    await queryClient.invalidateQueries({ queryKey: getGetCouponsQueryKey() });
  };

  /** Fecha a modal descartando o que não foi salvo. */
  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    hydratedIdRef.current = null;
  }

  const saveMutation = useMutation({
    mutationFn: (input: { id: number | null; payload: SaveCampaignPayload }) =>
      input.id ? updateCampaign(input.id, input.payload) : createCampaign(input.payload),
    onSuccess: async (_result, input) => {
      await invalidateCampaigns();
      toast({ title: input.id ? "Campanha atualizada." : "Campanha cadastrada." });
      closeModal();
    },
    onError: (error: unknown) => {
      // A remoção de pergunta é lógica e acontece no servidor: é ele quem sabe
      // se ela já foi respondida e se pode sair. O cliente não adivinha isso —
      // ele mostra a frase que voltou.
      toast({
        title: "Erro ao salvar a campanha",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCampaign(id),
    onSuccess: async () => {
      await invalidateCampaigns();
      // Excluir o último item de uma página deixaria a tela presa numa página
      // vazia — se a linha que saiu era a única, recua uma.
      if ((pagedData?.data.length ?? 0) === 1) setPage((current) => Math.max(1, current - 1));
      toast({
        title: "Campanha excluída.",
        description: "Os cupons ligados a ela continuam valendo — só o questionário deixa de aparecer.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao excluir a campanha",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Abre a modal em modo de cadastro, com formulário e questionário em branco. */
  function handleOpenCreate() {
    hydratedIdRef.current = null;
    setEditingId(null);
    setForm(emptyForm());
    setQuestions([]);
    setModalOpen(true);
  }

  /** Abre a modal em modo de edição; o questionário chega pela consulta de detalhe. */
  function handleOpenEdit(campaign: CampaignDto) {
    hydratedIdRef.current = null;
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      startsOnDate: instantToDate(campaign.startsAt),
      startsAtTime: instantToTime(campaign.startsAt, DEFAULT_START_TIME),
      endsOnDate: instantToDate(campaign.endsAt),
      endsAtTime: instantToTime(campaign.endsAt, DEFAULT_END_TIME),
      isActive: campaign.isActive,
    });
    setQuestions([]);
    setModalOpen(true);
  }

  /** Valida o formulário e o questionário INTEIRO e salva. */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim() || !form.startsOnDate) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Informe o nome da campanha e a data de início do período.",
        variant: "destructive",
      });
      return;
    }

    const payload = buildCampaignPayload(form, questions);

    // Instantes no mesmo formato ordenam como string, e a comparação precisa ser
    // de instante e não de dia: uma campanha das 14h às 8h do MESMO dia é
    // inválida, e um confronto por data não pegaria isso.
    if (payload.endsAt != null && payload.endsAt < payload.startsAt) {
      toast({
        title: "Período inválido",
        description: "O fim do período da campanha não pode ser anterior ao início!",
        variant: "destructive",
      });
      return;
    }

    const problem = describeQuestionsProblem(questions);
    if (problem) {
      toast({ title: "Questionário incompleto", description: problem, variant: "destructive" });
      return;
    }

    saveMutation.mutate({ id: editingId, payload });
  }

  /**
   * Exclui a campanha (exclusão lógica no servidor).
   *
   * Devolve a Promise da mutação porque quem confirma é o `ConfirmDialog` da
   * tabela: ele só fecha quando ela resolve e permanece aberto se o servidor
   * recusar. A trava de clique duplo também é do diálogo, e por isso não se
   * repete aqui.
   */
  function handleDelete(campaign: CampaignDto) {
    return deleteMutation.mutateAsync(campaign.id);
  }

  /**
   * Atalho para cadastrar um cupom já vinculado a esta campanha.
   *
   * Cupom sem campanha é cupom sem questionário: o vínculo é o único caminho
   * das perguntas até o caixa, e é justamente o que se esquece quando o cupom é
   * criado pela tela de cupons, solto.
   */
  function handleCreateLinkedCoupon(campaignId: number) {
    setLocation(`/marketing/cupons?campanha=${campaignId}&novo=1`);
  }

  return {
    // Listagem
    campaigns: pagedData?.data ?? [],
    // `pageSize` viaja junto para o rodapé derivar o total de páginas sem que a
    // página reimporte PAGE_SIZE e arrisque divergir do tamanho pedido à API.
    pagination: pagedData
      ? {
          page: pagedData.page,
          pageSize: pagedData.limit || PAGE_SIZE,
          total: pagedData.total,
          totalPages: pagedData.totalPages,
        }
      : undefined,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput: handleSearchChange,

    // Modal / formulário / questionário
    modalOpen,
    editingId,
    form,
    setForm,
    questions,
    setQuestions,
    isLoadingDetail: editingId != null && isLoadingDetail,
    handleOpenCreate,
    handleOpenEdit,
    closeModal,
    handleSubmit,
    isSaving: saveMutation.isPending,

    // Cupons vinculados
    linkedCoupons: linkedCoupons?.data ?? [],
    linkedCouponsTotal: linkedCoupons?.total ?? 0,
    isLoadingCoupons: editingId != null && isLoadingCoupons,
    handleCreateLinkedCoupon,

    // Ações da tabela
    handleDelete,
    isDeleting: deleteMutation.isPending,
  };
}
