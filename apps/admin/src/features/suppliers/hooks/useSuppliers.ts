import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { orderCatalogByName } from "@/lib/select-options";
import {
  getGetSuppliersQueryKey,
  useCreateSupplier,
  useDeleteSupplier,
  useGetSuppliers,
  useGetSupplierStatusOptions,
  useUpdateSupplier,
  type SupplierDto,
} from "@workspace/api-client-react";
import { normalizeStatusName, randomColor } from "../constants";
import type { SupplierForm } from "../types";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/**
 * Hook customizado para gerenciar a lógica de negócios da feature de Fornecedores.
 *
 * A listagem, o enum de status e as três mutações vêm do api-client. O que
 * sobra aqui é o que é da tela: busca com debounce, filtro de status, o
 * formulário e a regra de qual status o cadastro assume por padrão.
 */
export function useSuppliers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchVal, setSearchVal] = useState("");
  const search = useDebounce(searchVal, 300);
  const [statusFilter, setStatusFilterState] = useState("all");

  /**
   * Troca o filtro de status e volta para a primeira página.
   *
   * O reset acontece AQUI, e não num efeito: a página 3 do conjunto anterior
   * pode nem existir no novo, e resolver isso reagindo à mudança encadearia uma
   * renderização a mais — é o que a regra `set-state-in-effect` alerta.
   */
  function setStatusFilter(next: string) {
    setStatusFilterState(next);
    setPage(1);
  }
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<SupplierForm>({
    name: "",
    corporateName: "",
    document: "",
    salesRepresentative: "",
    phone: "",
    email: "",
    minimumPurchaseValue: "",
    status: "",
    city: "",
    state: "PR",
    avatarColor: randomColor(),
    description: "",
    isRecurring: false,
    isMarketplace: false,
  });

  // Reseta a página ao buscar
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Consulta das opções de status
  const { data: statusOptions = [] } = useGetSupplierStatusOptions();

  const statusLabelById = useMemo(
    () => Object.fromEntries(statusOptions.map((item) => [item.id, item.name])),
    [statusOptions],
  );

  const selectableSupplierStatusOptions = useMemo(
    () =>
      orderCatalogByName(
        statusOptions.filter(
          (item) => item.allowSelect && ["ativo", "inativo"].includes(normalizeStatusName(item.name)),
        ),
      ),
    [statusOptions],
  );

  const activeStatusValue = useMemo(
    () =>
      selectableSupplierStatusOptions
        .find((item) => normalizeStatusName(item.name) === "ativo")
        ?.id.toString() ?? "",
    [selectableSupplierStatusOptions],
  );

  // Garante que o status do formulário tenha o valor ativo por padrão
  useEffect(() => {
    if (!modalOpen || !activeStatusValue || selectableSupplierStatusOptions.length === 0) return;

    setForm((current) => {
      const statusIsAllowed = selectableSupplierStatusOptions.some(
        (item) => String(item.id) === current.status,
      );
      if (statusIsAllowed) return current;
      return { ...current, status: activeStatusValue };
    });
  }, [activeStatusValue, modalOpen, selectableSupplierStatusOptions]);

  // O status vai para o SERVIDOR e entra na queryKey. Antes ele era aplicado
  // depois, sobre a página já paginada: filtrar por "Inativo" numa base de 200
  // fornecedores mostrava só os inativos que por acaso caíram nos 20 da página
  // corrente, e o contador de páginas continuava contando todos.
  const statusParam = statusFilter === "all" ? undefined : Number(statusFilter);

  const {
    data: suppliersPage,
    isLoading,
    isError,
    error,
  } = useGetSuppliers({ search, status: statusParam, page, limit });

  // O aviso de servidor fora do ar é o mesmo em toda tela — mora num hook só.
  useApiErrorToast(isError, error);

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const saving = createSupplier.isPending || updateSupplier.isPending;

  // O filtro já foi aplicado pelo servidor — aqui só se lê o que veio.
  const suppliers = suppliersPage?.data ?? [];

  /**
   * Invalida o PREFIXO do recurso, não a combinação de parâmetros da tela.
   *
   * Sob `["suppliers"]` estão todas as páginas, todas as buscas e também o
   * catálogo completo que outras telas leem. Invalidar só a página corrente
   * deixava a lista de fornecedores do lançamento de estoque com o nome antigo.
   */
  async function invalidateSuppliers() {
    await queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
  }

  /**
   * Abre a modal de cadastro/edição de fornecedor.
   *
   * @param supplier Fornecedor a ser carregado em modo de edição (opcional).
   */
  function handleOpenModal(supplier?: SupplierDto) {
    if (supplier) {
      setEditingId(supplier.id);
      const supplierStatus = supplier.status == null ? "" : String(supplier.status);
      const statusIsAllowed = selectableSupplierStatusOptions.some(
        (item) => String(item.id) === supplierStatus,
      );

      setForm({
        name: supplier.name || "",
        corporateName: supplier.corporateName || "",
        document: supplier.document || "",
        salesRepresentative: supplier.salesRepresentative || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        minimumPurchaseValue: String(supplier.minimumPurchaseValue ?? ""),
        status: statusIsAllowed ? supplierStatus : activeStatusValue,
        city: supplier.city || "",
        state: supplier.state || "",
        avatarColor: supplier.avatarColor || randomColor(),
        description: supplier.description || "",
        isRecurring: supplier.isRecurring,
        isMarketplace: supplier.isMarketplace,
      });
    } else {
      setEditingId(null);
      setForm({
        name: "",
        corporateName: "",
        document: "",
        salesRepresentative: "",
        phone: "",
        email: "",
        minimumPurchaseValue: "",
        status: activeStatusValue,
        city: "",
        state: "PR",
        avatarColor: randomColor(),
        description: "",
        isRecurring: false,
        isMarketplace: false,
      });
    }

    setModalOpen(true);
  }

  /**
   * Envia os dados do formulário de fornecedor para cadastrar ou atualizar.
   *
   * @param formData Objeto com os campos do formulário preenchidos.
   */
  async function handleSubmitSupplier(formData: SupplierForm) {
    const minimumPurchaseValue = Number(formData.minimumPurchaseValue);
    if (
      !formData.name.trim() ||
      formData.minimumPurchaseValue === "" ||
      Number.isNaN(minimumPurchaseValue) ||
      minimumPurchaseValue < 0
    ) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Informe o nome do fornecedor e o valor mínimo de compra.",
        variant: "destructive",
      });
      return;
    }

    const statusValue = formData.status || activeStatusValue;
    if (!statusValue) {
      toast({
        title: "Status indisponível",
        description: "Aguarde as opções de status carregarem para salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        corporateName: formData.corporateName.trim() || null,
        document: formData.document.trim() || null,
        salesRepresentative: formData.salesRepresentative.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        minimumPurchaseValue,
        status: Number(statusValue),
        city: formData.city.trim(),
        state: formData.state,
        avatarColor: formData.avatarColor,
        description: formData.description.trim() || null,
        isRecurring: formData.isRecurring,
        isMarketplace: formData.isMarketplace,
      };

      if (editingId) {
        await updateSupplier.mutateAsync({ id: editingId, data });
        toast({ title: "Fornecedor atualizado." });
      } else {
        await createSupplier.mutateAsync({ data });
        toast({ title: "Fornecedor cadastrado." });
      }

      await invalidateSuppliers();
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar fornecedor",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  /**
   * Remove um fornecedor do sistema.
   *
   * A confirmação NÃO acontece aqui: quem pergunta é o `ConfirmDialog` da
   * tabela. O `window.confirm` que morava nesta função travava a thread do
   * navegador, ignorava o tema e não tinha como ser coberto por teste — o teste
   * de exclusão precisava dublar `window.confirm` para chegar até a chamada.
   *
   * @param id Identificador do fornecedor a ser removido.
   */
  async function handleDeleteSupplier(id: number) {
    try {
      await deleteSupplier.mutateAsync({ id });
      await invalidateSuppliers();
      toast({ title: "Fornecedor removido." });
    } catch (error) {
      toast({
        title: "Erro ao remover fornecedor",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    }
  }

  return {
    searchVal,
    setSearchVal,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    limit,
    setLimit,
    modalOpen,
    setModalOpen,
    editingId,
    saving,
    form,
    statusOptions,
    statusLabelById,
    selectableSupplierStatusOptions,
    activeStatusValue,
    suppliersPage,
    isLoading,
    isError,
    error,
    suppliers,
    handleOpenModal,
    handleSubmitSupplier,
    handleDeleteSupplier,
  };
}
