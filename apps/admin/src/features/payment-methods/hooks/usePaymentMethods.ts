import { useState, useCallback, useEffect } from "react";
import { useDebounce } from "@workspace/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import {
  useGetPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  getGetPaymentMethodsQueryKey,
  type PaymentMethodDto,
} from "@workspace/api-client-react";
import type { PaymentMethodFormValues, InstallmentFormValue } from "../types";
import { describeApiError } from "@workspace/core";

/**
 * Tamanho fixo da página da listagem.
 *
 * Era um `10` escrito duas vezes — um no `size` pedido à API e outro na conta
 * `page * 10 >= filteredItems` que decidia o botão "Próxima" lá na página.
 * Dois literais que precisavam concordar, em arquivos diferentes, sem nada que
 * garantisse a concordância.
 */
export const PAGE_SIZE = 10;

/**
 * Hook customizado para gerenciar o estado e operações de CRUD das Formas de Pagamento.
 */
export function usePaymentMethods() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<PaymentMethodFormValues>({
    name: "",
    isActive: true,
    installments: [{ installmentNumber: 1, feePercentage: 0, isActive: true }],
  });

  const parsedIsActive = isActiveFilter === "all" ? undefined : isActiveFilter === "true";

  const {
    data: pagedData,
    isLoading,
    refetch,
  } = useGetPaymentMethods({
    search: debouncedSearch.trim() || undefined,
    isActive: parsedIsActive,
    page,
    size: PAGE_SIZE,
  });

  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setFormData({
      name: "",
      isActive: true,
      installments: [{ installmentNumber: 1, feePercentage: 0, isActive: true }],
    });
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((item: PaymentMethodDto) => {
    setEditingId(item.id);
    setFormData({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      installments: item.installments.map((inst) => ({
        id: inst.id,
        installmentNumber: inst.installmentNumber,
        feePercentage: inst.feePercentage,
        isActive: inst.isActive,
      })),
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
  }, []);

  const handleAddInstallment = useCallback(() => {
    setFormData((prev) => {
      const nextNumber =
        prev.installments.length > 0 ? Math.max(...prev.installments.map((i) => i.installmentNumber)) + 1 : 1;
      return {
        ...prev,
        installments: [
          ...prev.installments,
          { installmentNumber: nextNumber, feePercentage: 0, isActive: true },
        ],
      };
    });
  }, []);

  const handleRemoveInstallment = useCallback(
    (index: number) => {
      setFormData((prev) => {
        if (prev.installments.length <= 1) {
          toast({
            title: "Atenção",
            description: "É necessário manter ao menos uma opção de parcelamento (ex: 1x).",
            variant: "destructive",
          });
          return prev;
        }
        const updated = prev.installments.filter((_, i) => i !== index);
        return { ...prev, installments: updated };
      });
    },
    [toast],
  );

  const handleInstallmentChange = useCallback(
    (index: number, field: keyof InstallmentFormValue, value: any) => {
      setFormData((prev) => {
        const updated = [...prev.installments];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, installments: updated };
      });
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Campo Obrigatório",
        description: "O nome da forma de pagamento é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          data: {
            id: editingId,
            name: formData.name.trim(),
            isActive: formData.isActive,
            installments: formData.installments.map((inst) => ({
              id: inst.id,
              installmentNumber: Number(inst.installmentNumber),
              feePercentage: Number(inst.feePercentage),
              isActive: inst.isActive,
            })),
          },
        });
        toast({ title: "Sucesso", description: "Forma de pagamento atualizada com sucesso!" });
      } else {
        await createMutation.mutateAsync({
          data: {
            name: formData.name.trim(),
            isActive: formData.isActive,
            installments: formData.installments.map((inst) => ({
              installmentNumber: Number(inst.installmentNumber),
              feePercentage: Number(inst.feePercentage),
              isActive: inst.isActive,
            })),
          },
        });
        toast({ title: "Sucesso", description: "Forma de pagamento cadastrada com sucesso!" });
      }

      queryClient.invalidateQueries({ queryKey: getGetPaymentMethodsQueryKey() });
      closeModal();
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar",
        description: describeApiError(err, "Ocorreu um erro ao salvar a forma de pagamento."),
        variant: "destructive",
      });
    }
  };

  /**
   * Exclui a forma de pagamento. A confirmação é do `ConfirmDialog` da tabela.
   *
   * Relança o erro depois de mostrar o toast porque o diálogo decide ficar
   * aberto pela rejeição: engolindo aqui, ele fecharia como se a exclusão
   * tivesse dado certo, com o aviso de falha aparecendo por trás.
   */
  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Sucesso", description: "Forma de pagamento excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: getGetPaymentMethodsQueryKey() });
    } catch (err: unknown) {
      toast({
        title: "Erro ao excluir",
        description: describeApiError(err, "Ocorreu um erro ao excluir a forma de pagamento."),
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    items: pagedData?.data ?? [],
    // Nomes iguais aos das outras features (`pageSize`/`total`), e não o
    // `size`/`filteredItems` do backend — o rodapé é um componente só.
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
    search,
    setSearch,
    isActiveFilter,
    setIsActiveFilter,
    modalOpen,
    editingId,
    formData,
    setFormData,
    openCreateModal,
    openEditModal,
    closeModal,
    handleAddInstallment,
    handleRemoveInstallment,
    handleInstallmentChange,
    handleSubmit,
    handleDelete,
    isSaving: createMutation.isPending || updateMutation.isPending,
    refetch,
  };
}
