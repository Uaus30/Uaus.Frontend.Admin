import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomersQueryKey,
  useCreateCustomer,
  useDeleteCustomer,
  useGetCustomers,
  useUpdateCustomer,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { buildCustomerStats } from "@/services/mappers";
import { getAllSales } from "@/services/sales.service";
import type { CustomerForm } from "../types";

/**
 * Hook customizado para gerenciar a lógica de negócios, consultas e mutações da feature de Clientes.
 * 
 * @returns Um objeto com estados, dados de clientes, estatísticas e funções de manipulação.
 */
export function useCustomers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchVal, setSearchVal] = useState("");
  const [search, setSearch] = useState("");
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

  // Debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchVal]);

  // Query de busca paginada de clientes
  const { data: customersPage, isLoading } = useGetCustomers({ search, page, limit: 15 });

  // Query de vendas para calcular estatísticas
  const { data: allSales = [] } = useQuery({
    queryKey: ["sales-all-for-customers"],
    queryFn: () => getAllSales(),
  });

  // Cálculo das estatísticas consolidadas de compras por cliente
  const statsByCustomerId = useMemo(() => buildCustomerStats(allSales), [allSales]);

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
          description: error.message,
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
          description: error.message,
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
          description: error.message,
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
  function handleOpenModal(customer?: any) {
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
  function handleSaveCustomer(payload: any) {
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
