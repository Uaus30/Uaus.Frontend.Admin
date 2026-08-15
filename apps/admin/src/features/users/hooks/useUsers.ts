import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useCreateUser,
  useDeleteUser,
  useGetUsers,
  useUpdateUser,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { getEnumOptions } from "@/services/core";
import { getDisplayName, splitFullName, usernameFromEmail } from "@/services/mappers";
import type { UserForm } from "../types";

export const emptyForm: UserForm = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  role: "",
  status: "",
};

/**
 * Hook customizado para centralizar a lógica de negócios da feature de Usuários.
 */
export function useUsers() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  // Consulta paginada dos usuários
  const { data, isLoading, refetch } = useGetUsers({ page, limit: 50 });

  // Consultas das opções de enum
  const { data: roleOptions = [] } = useQuery({
    queryKey: ["user-role-options"],
    queryFn: () => getEnumOptions("/Users/enums/user-role"),
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["user-status-options"],
    queryFn: () => getEnumOptions("/Users/enums/user-status"),
  });

  const selectableRoleOptions = useMemo(
    () => roleOptions.filter((item) => item.allowSelect),
    [roleOptions],
  );
  const selectableStatusOptions = useMemo(
    () => statusOptions.filter((item) => item.allowSelect),
    [statusOptions],
  );

  const roleLabels = useMemo(
    () => Object.fromEntries(roleOptions.map((item) => [item.id, item.name])),
    [roleOptions],
  );
  const statusLabels = useMemo(
    () => Object.fromEntries(statusOptions.map((item) => [item.id, item.name])),
    [statusOptions],
  );

  // Mutações de API
  const { mutate: createUser, isPending: creating } = useCreateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuário criado com sucesso." });
        setDialogOpen(false);
        refetch();
      },
      onError: (error) =>
        toast({
          title: "Erro ao criar usuário",
          description: error.message,
          variant: "destructive",
        }),
    },
  });

  const { mutate: updateUser, isPending: updating } = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuário atualizado com sucesso." });
        setDialogOpen(false);
        refetch();
      },
      onError: (error) =>
        toast({
          title: "Erro ao atualizar usuário",
          description: error.message,
          variant: "destructive",
        }),
    },
  });

  const { mutate: deleteUser, isPending: deleting } = useDeleteUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuário removido." });
        setDeleteId(null);
        refetch();
      },
      onError: (error) =>
        toast({
          title: "Erro ao remover usuário",
          description: error.message,
          variant: "destructive",
        }),
    },
  });

  /**
   * Abre a modal para cadastro de um novo usuário.
   */
  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      role: selectableRoleOptions[0]?.id.toString() ?? "",
      status: selectableStatusOptions[0]?.id.toString() ?? "",
    });
    setDialogOpen(true);
  }

  /**
   * Abre a modal para edição de um usuário existente.
   * 
   * @param user Usuário a ser editado.
   */
  function openEdit(user: any) {
    setEditingId(user.id);
    setForm({
      fullName: getDisplayName(user),
      username: user.username,
      email: user.email,
      password: "",
      role: String(user.role),
      status: String(user.status),
    });
    setDialogOpen(true);
  }

  /**
   * Submete os dados do formulário de usuário.
   * 
   * @param formPayload Objeto do formulário preenchido.
   */
  function handleSubmitUser(formPayload: UserForm) {
    const { firstName, lastName } = splitFullName(formPayload.fullName);

    if (!firstName || !formPayload.username || !formPayload.email || !formPayload.role) {
      toast({
        title: "Preencha os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      updateUser({
        id: editingId,
        data: {
          firstName,
          lastName,
          username: formPayload.username.trim(),
          email: formPayload.email.trim(),
          role: Number(formPayload.role),
          status: Number(formPayload.status),
        },
      });
      return;
    }

    createUser({
      data: {
        firstName,
        lastName,
        username: formPayload.username.trim(),
        email: formPayload.email.trim(),
        password: formPayload.password,
        role: Number(formPayload.role),
        // O `status` faltava aqui: a modal de cadastro oferece o campo e já o
        // preenche com o padrão, mas o valor escolhido era descartado no envio —
        // quem criava um usuário inativo recebia um usuário ativo. A edição
        // sempre mandou. Descoberto ao trocar `data: unknown` pelo tipo real.
        status: Number(formPayload.status),
      },
    });
  }

  /**
   * Executa a remoção física/lógica de um usuário.
   * 
   * @param id Identificador do usuário.
   */
  function handleDeleteUser(id: number) {
    deleteUser({ id });
  }

  return {
    page,
    setPage,
    dialogOpen,
    setDialogOpen,
    editingId,
    deleteId,
    setDeleteId,
    form,
    setForm,
    data,
    isLoading,
    roleOptions,
    statusOptions,
    selectableRoleOptions,
    selectableStatusOptions,
    roleLabels,
    statusLabels,
    creating,
    updating,
    deleting,
    openCreate,
    openEdit,
    handleSubmitUser,
    handleDeleteUser,
    usernameFromEmail,
  };
}
