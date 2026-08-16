import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { generateRandomTagColor } from "@/lib/tag-colors";
import { createTag, deleteTag, getTagsPage, updateTag } from "@/services/tags.service";
import { getTagReport } from "@/services/reports.service";
import type { TagForm, EnrichedTag, TagReport } from "../types";
import { describeApiError } from "@workspace/core";
import { STALE_TIME } from "@workspace/api-client-react";

export type SortDir = "asc" | "desc";
export type SortBy = "name" | "productCount" | "createdAt";

/**
 * useTags
 *
 * Hook customizado para gerenciar o estado, consultas, mutations e ordenação
 * da tela de gerenciamento de etiquetas (Tags).
 *
 * Funcionalidades centrais:
 * - Paginação, busca textual e ordenação local da listagem.
 * - Gerenciamento de formulário de criação/edição.
 * - Carregamento sob demanda do relatório de vendas da etiqueta selecionada.
 * - Deleção de etiquetas.
 */
export function useTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados de busca, ordenação e paginação
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Estados dos Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Estado do formulário de criação/edição
  const [formData, setFormData] = useState<TagForm>({
    name: "",
    color: generateRandomTagColor(),
    isPublic: false,
  });
  const [saving, setSaving] = useState(false);

  // Query do TanStack Query para carregar a página de etiquetas
  const { data: tagPage, isLoading } = useQuery({
    queryKey: [...RESOURCE_KEYS.tags, "page", { search: debouncedSearch, page, limit }],
    queryFn: () => getTagsPage({ search: debouncedSearch, page, limit }),
  });

  // Lista de etiquetas enriquecidas e ordenadas localmente
  const tagsWithCount = useMemo<EnrichedTag[]>(() => {
    const current = (tagPage?.data ?? []).map((tag: any) => ({
      ...tag,
      productCount: tag.productCount ?? 0,
    }));

    current.sort((left, right) => {
      const direction = sortDir === "asc" ? 1 : -1;

      if (sortBy === "name") {
        return left.name.localeCompare(right.name, "pt-BR") * direction;
      }

      if (sortBy === "productCount") {
        return (left.productCount - right.productCount) * direction;
      }

      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    });

    return current;
  }, [sortBy, sortDir, tagPage?.data]);

  // Relatório da etiqueta selecionada.
  //
  // Só dispara quando o modal é aberto: é uma agregação sobre os itens de venda
  // do período, e carregá-la para todas as etiquetas da página seria pagar por um
  // dado que o usuário pediu de uma.
  const { data: selectedReport = null, isLoading: isReportLoading } = useQuery<TagReport>({
    queryKey: ["tag-report", selectedTagId],
    queryFn: () => getTagReport(selectedTagId as number),
    enabled: !!selectedTagId && reportModalOpen,
    staleTime: STALE_TIME.catalogo,
  });

  /**
   * Altera ou inverte a coluna ativa de ordenação.
   * @param column Coluna de ordenação a ser aplicada.
   */
  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  }

  /**
   * Abre o modal de cadastro/edição de etiqueta.
   * @param tag Caso passado, ativa modo de edição populando o formulário; caso contrário reseta para nova etiqueta.
   */
  function openModal(tag?: EnrichedTag) {
    if (tag) {
      setEditingId(tag.id);
      setFormData({
        name: tag.name,
        color: tag.color,
        isPublic: tag.isPublic ?? false,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        color: generateRandomTagColor(),
        isPublic: false,
      });
    }
    setModalOpen(true);
  }

  /**
   * Gera uma nova cor aleatória e atualiza o estado do formulário.
   */
  function randomizeColor() {
    setFormData((current) => ({ ...current, color: generateRandomTagColor() }));
  }

  /**
   * Valida os campos e submete o formulário de cadastro/edição.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        await updateTag({
          id: editingId,
          name: formData.name.trim(),
          color: formData.color,
          isPublic: formData.isPublic,
        });
        toast({ title: "Etiqueta atualizada." });
      } else {
        await createTag({
          name: formData.name.trim(),
          color: formData.color,
          isPublic: formData.isPublic,
        });
        toast({ title: "Etiqueta criada." });
      }

      await queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.tags });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar etiqueta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Remove uma etiqueta pelo seu ID.
   * @param tagId ID único da etiqueta.
   */
  async function handleDelete(tagId: number) {
    try {
      await deleteTag(tagId);
      await queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.tags });
      toast({ title: "Etiqueta removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover etiqueta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  return {
    search,
    setSearch,
    sortBy,
    sortDir,
    page,
    setPage,
    limit,
    setLimit,
    modalOpen,
    setModalOpen,
    reportModalOpen,
    setReportModalOpen,
    selectedTagId,
    setSelectedTagId,
    editingId,
    formData,
    setFormData,
    saving,
    tagPage,
    isLoading,
    tagsWithCount,
    selectedReport,
    isReportLoading,
    toggleSort,
    openModal,
    randomizeColor,
    handleSubmit,
    handleDelete,
  };
}
