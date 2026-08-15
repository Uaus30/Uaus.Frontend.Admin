import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { normalizeSearchText } from "@workspace/core";
import { getEnumOptions } from "@/services/core";
import {
  createSupplier,
  deleteSupplier,
  getSuppliersPage,
  updateSupplier,
} from "@/services/suppliers.service";
import type { SupplierForm } from "../types";

export const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#3b82f6", "#0ea5e9", "#84cc16",
  "#d946ef", "#e11d48", "#059669", "#0284c7", "#7c3aed",
];

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

/**
 * Retorna uma cor aleatória do catálogo de cores de avatar.
 */
export function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/**
 * Remove acentos e caracteres especiais para normalizar o nome de status.
 *
 * Mantido com o nome que descreve o uso na tela; a regra de normalizacao e a
 * mesma do resto do sistema e vive em `@workspace/core`.
 */
export function normalizeStatusName(name: string): string {
  return normalizeSearchText(name);
}

/**
 * Cria a URL do WhatsApp a partir de um telefone.
 */
export function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

/**
 * Hook customizado para gerenciar a lógica de negócios da feature de Fornecedores.
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
  const [saving, setSaving] = useState(false);

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
  });

  // Reseta a página ao buscar
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Consulta das opções de status
  const { data: statusOptions = [] } = useQuery({
    queryKey: ["supplier-status-options"],
    queryFn: () => getEnumOptions("/Suppliers/enums/supplier-status"),
  });

  const statusLabelById = useMemo(
    () => Object.fromEntries(statusOptions.map((item) => [item.id, item.name])),
    [statusOptions],
  );

  const selectableSupplierStatusOptions = useMemo(
    () =>
      statusOptions.filter(
        (item) =>
          item.allowSelect &&
          ["ativo", "inativo"].includes(normalizeStatusName(item.name)),
      ),
    [statusOptions],
  );

  const activeStatusValue = useMemo(
    () => selectableSupplierStatusOptions.find((item) => normalizeStatusName(item.name) === "ativo")?.id.toString() ?? "",
    [selectableSupplierStatusOptions],
  );

  // Garante que o status do formulário tenha o valor ativo por padrão
  useEffect(() => {
    if (!modalOpen || !activeStatusValue || selectableSupplierStatusOptions.length === 0) return;

    setForm((current) => {
      const statusIsAllowed = selectableSupplierStatusOptions.some((item) => String(item.id) === current.status);
      if (statusIsAllowed) return current;
      return { ...current, status: activeStatusValue };
    });
  }, [activeStatusValue, modalOpen, selectableSupplierStatusOptions]);

  // O status vai para o SERVIDOR e entra na queryKey. Antes ele era aplicado
  // depois, sobre a página já paginada: filtrar por "Inativo" numa base de 200
  // fornecedores mostrava só os inativos que por acaso caíram nos 20 da página
  // corrente, e o contador de páginas continuava contando todos.
  const statusParam = statusFilter === "all" ? undefined : Number(statusFilter);

  const { data: suppliersPage, isLoading, isError, error } = useQuery({
    queryKey: ["suppliers-page", { search, status: statusParam, page, limit }],
    queryFn: () => getSuppliersPage({ search, status: statusParam, page, limit }),
  });


  // Notifica caso o servidor esteja indisponível
  useEffect(() => {
    if (isError && error) {
      const apiError = error as any;
      if (apiError.status >= 500) {
        toast({
          title: "Servidor indisponível",
          description: "O servidor está indisponível no momento. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    }
  }, [isError, error, toast]);

  // O filtro já foi aplicado pelo servidor — aqui só se lê o que veio.
  const suppliers = suppliersPage?.data ?? [];

  /**
   * Abre a modal de cadastro/edição de fornecedor.
   * 
   * @param supplier Fornecedor a ser carregado em modo de edição (opcional).
   */
  function handleOpenModal(supplier?: any) {
    if (supplier) {
      setEditingId(supplier.id);
      const supplierStatus = supplier.status == null ? "" : String(supplier.status);
      const statusIsAllowed = selectableSupplierStatusOptions.some((item) => String(item.id) === supplierStatus);

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
    if (!formData.name.trim() || formData.minimumPurchaseValue === "" || Number.isNaN(minimumPurchaseValue) || minimumPurchaseValue < 0) {
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

    setSaving(true);

    try {
      const payload = {
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
      };

      if (editingId) {
        await updateSupplier({
          id: editingId,
          ...payload,
        });
        toast({ title: "Fornecedor atualizado." });
      } else {
        await createSupplier(payload);
        toast({ title: "Fornecedor cadastrado." });
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers-page"] });
      setModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar fornecedor",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Remove um fornecedor do sistema.
   * 
   * @param id Identificador do fornecedor a ser removido.
   * @param name Nome do fornecedor (para fins de confirmação).
   */
  async function handleDeleteSupplier(id: number, name: string) {
    if (confirm(`Remover o fornecedor "${name}"?`)) {
      try {
        await deleteSupplier(id);
        queryClient.invalidateQueries({ queryKey: ["suppliers-page"] });
        toast({ title: "Fornecedor removido." });
      } catch (error: any) {
        toast({
          title: "Erro ao remover fornecedor",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      }
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
