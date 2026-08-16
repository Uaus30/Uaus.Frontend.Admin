import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomersQueryKey,
  useCreateCustomer,
  useDeleteCustomer,
  useGetCustomerSummaries,
  useUpdateCustomer,
  type CustomerSummaryDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";

import type { CustomerForm, CustomerStats } from "../types";
import { describeApiError } from "@workspace/core";

/**
 * Hook customizado para gerenciar a lógica de negócios, consultas e mutações da feature de Clientes.
 *
 * ## Por que o consolidado vem do servidor (item 4.1)
 *
 * Esta tela calculava "total gasto" e "nº de compras" no navegador: chamava
 * `useAllSales()`, que varria a tabela de vendas INTEIRA — todas as páginas, sem
 * filtro — e somava por cliente. Quinze linhas na tela custavam a operação
 * completa da loja em memória.
 *
 * Os outros `useAll*` do admin são catálogo (departamento, categoria, etiqueta) e
 * estabilizam em centenas de linhas. Venda não estabiliza nunca, e o
 * `fetchAllPages` **lança** ao passar de 20 mil itens em vez de devolver a lista
 * cortada — a tela tinha data marcada para parar de abrir.
 *
 * Hoje `GET /Customers/summary` devolve a página de clientes já com total, número
 * de compras e data da última: **uma requisição, independente do tamanho da
 * base**.
 *
 * @returns Um objeto com estados, dados de clientes, estatísticas e funções de manipulação.
 */
export function useCustomers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchVal, setSearchVal] = useState("");
  const search = useDebounce(searchVal, 300);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<CustomerForm>({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
  });

  // Reseta a página ao buscar
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Query de busca paginada de clientes, já com o consolidado de compras somado
  // pelo banco.
  const { data: customersPage, isLoading } = useGetCustomerSummaries({ search, page, limit: 15 });

  /**
   * Consolidado indexado por id, do jeito que a tabela consome.
   *
   * Não é mais um CÁLCULO: os três números já vêm prontos na linha. O mapa
   * sobrevive porque é o formato que a tabela e a página recebem por prop, e
   * porque indexar quinze linhas é de graça — a conta cara saiu do navegador.
   */
  const statsByCustomerId = useMemo(() => {
    const stats = new Map<number, CustomerStats>();

    (customersPage?.data ?? []).forEach((customer) => {
      stats.set(customer.id, {
        totalPurchases: customer.totalPurchased,
        purchaseCount: customer.purchaseCount,
        lastPurchaseAt: customer.lastPurchaseAt ?? null,
      });
    });

    return stats;
  }, [customersPage?.data]);

  // Mutação para criar cliente
  const { mutate: createCustomer, isPending: isCreating } = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Sucesso", description: "Cliente cadastrado." });
        setModalOpen(false);
      },
      onError: (error) =>
        toast({
          title: "Erro ao cadastrar cliente",
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  // Mutação para atualizar cliente
  const { mutate: updateCustomer, isPending: isUpdating } = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Sucesso", description: "Dados atualizados." });
        setModalOpen(false);
      },
      onError: (error) =>
        toast({
          title: "Erro ao atualizar cliente",
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  // Mutação para remover cliente
  const { mutate: deleteCustomer } = useDeleteCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Removido", description: "Cliente removido." });
      },
      onError: (error) =>
        toast({
          title: "Erro ao remover cliente",
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  /**
   * Abre a modal de cadastro/edição de cliente.
   * Se um cliente for fornecido, preenche o formulário para edição.
   *
   * @param customer Cliente opcional para carregar na edição.
   */
  function handleOpenModal(customer?: CustomerSummaryDto) {
    if (customer) {
      setEditingId(customer.id);
      setFormData({
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        document: customer.document || "",
        address: customer.address || "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", document: "", address: "" });
    }

    setModalOpen(true);
  }

  /**
   * Executa a remoção física/lógica de um cliente.
   *
   * @param id Identificador do cliente a ser removido.
   */
  function handleDeleteCustomer(id: number) {
    if (confirm("Remover este cliente?")) {
      deleteCustomer({ id });
    }
  }

  /**
   * Submete os dados do formulário de cliente para salvar/atualizar.
   *
   * @param payload Objeto contendo os dados do formulário do cliente.
   */
  function handleSaveCustomer(payload: CustomerForm) {
    if (editingId) {
      updateCustomer({ id: editingId, data: payload });
    } else {
      createCustomer({ data: payload });
    }
  }

  return {
    customersPage,
    isLoading,
    searchVal,
    setSearchVal,
    page,
    setPage,
    modalOpen,
    setModalOpen,
    editingId,
    formData,
    statsByCustomerId,
    isSaving: isCreating || isUpdating,
    handleOpenModal,
    handleDeleteCustomer,
    handleSaveCustomer,
  };
}
