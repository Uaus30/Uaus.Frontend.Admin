import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  USER_ROLE,
  USER_STATUS,
  enumCode,
  useCreateUser,
  useDeleteUser,
  useGetUsers,
  useResetUserPassword,
  useUpdateUser,
  type UserRoleCode,
  type UserStatusCode,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { getEnumOptions } from "@/services/core";
import { getDisplayName, splitFullName, usernameFromEmail } from "@/services/mappers";
import type { FirstAccessInfo, UserForm, UserRow } from "../types";
import { describeApiError } from "@workspace/core";

export const emptyForm: UserForm = {
  fullName: "",
  username: "",
  email: "",
  role: "",
  status: "",
};

/**
 * Lógica de negócio da feature de Usuários.
 *
 * O ciclo da senha é o que organiza este hook: cadastrar não escolhe senha (o
 * servidor grava a padrão e deixa o usuário Pendente), o primeiro acesso é quem
 * promove a conta a Ativo, e resetar devolve tudo ao início. Por isso cadastro e
 * reset terminam na mesma modal — a que mostra a senha do primeiro acesso.
 */
export function useUsers() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [firstAccess, setFirstAccess] = useState<FirstAccessInfo | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  /**
   * Status do usuário aberto na edição, como ele veio do servidor.
   *
   * Separado de `form.status`, que muda conforme a pessoa mexe no select: quem
   * decide se "Ativo" pode ser oferecido é o estado GRAVADO, não o escolhido.
   */
  const [statusGravado, setStatusGravado] = useState<number | null>(null);

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

  const selectableRoleOptions = useMemo(() => roleOptions.filter((item) => item.allowSelect), [roleOptions]);
  const selectableStatusOptions = useMemo(
    () => statusOptions.filter((item) => item.allowSelect),
    [statusOptions],
  );

  /**
   * Status oferecidos na edição.
   *
   * De um Pendente some "Ativo": sair de Pendente é, por definição, ter trocado a
   * senha do primeiro acesso, e o servidor recusa a promoção pela edição. Deixar
   * a opção na lista só renderia um erro depois de salvar.
   */
  const pendentePrimeiroAcesso = statusGravado === USER_STATUS.Pending;

  const editableStatusOptions = useMemo(() => {
    if (!pendentePrimeiroAcesso) return selectableStatusOptions;
    return selectableStatusOptions.filter((item) => item.id !== USER_STATUS.Active);
  }, [selectableStatusOptions, pendentePrimeiroAcesso]);

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
      onSuccess: (result) => {
        setDialogOpen(false);
        refetch();

        // A senha do primeiro acesso só existe nesta resposta. Sem mostrá-la, o
        // administrador sai da tela sem ter o que dizer ao operador.
        if (result) {
          setFirstAccess({
            username: result.user.username,
            password: result.firstAccessPassword,
            origem: "cadastro",
          });
          return;
        }

        toast({ title: "Usuário criado com sucesso." });
      },
      onError: (error) =>
        toast({
          title: "Erro ao criar usuário",
          description: describeApiError(error),
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
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  const { mutate: resetPassword, isPending: resetting } = useResetUserPassword({
    mutation: {
      onSuccess: (result) => {
        setResetTarget(null);
        refetch();

        if (result) {
          setFirstAccess({
            username: result.user.username,
            password: result.firstAccessPassword,
            origem: "reset",
          });
          return;
        }

        toast({ title: "Senha resetada." });
      },
      onError: (error) =>
        toast({
          title: "Erro ao resetar a senha",
          description: describeApiError(error),
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
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  /**
   * Abre a modal para cadastro de um novo usuário.
   *
   * Sem status: quem acabou de ser cadastrado nasce Pendente, e não há escolha a
   * oferecer.
   */
  function openCreate() {
    setEditingId(null);
    setStatusGravado(null);
    setForm({
      ...emptyForm,
      role: selectableRoleOptions[0]?.id.toString() ?? "",
    });
    setDialogOpen(true);
  }

  /**
   * Abre a modal de edição já com os dados do usuário.
   *
   * `enumCode` é o que faz Papel e Status aparecerem preenchidos. A API serializa
   * enum pelo NOME (`role: "Seller"`), e a versão anterior fazia `String(user.role)`
   * — procurando a opção `"Seller"` numa lista cujos valores são `"1"` e `"2"`.
   * Os dois campos abriam em branco, sem erro em lugar nenhum, e salvar assim
   * rebaixava o papel do usuário.
   */
  function openEdit(user: UserRow) {
    const status = enumCode(user.status, USER_STATUS);

    setEditingId(user.id);
    setStatusGravado(status);
    setForm({
      fullName: getDisplayName(user),
      username: user.username,
      email: user.email,
      role: String(enumCode(user.role, USER_ROLE)),
      status: String(status),
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

    const comum = {
      firstName,
      lastName,
      username: formPayload.username.trim(),
      email: formPayload.email.trim(),
      role: Number(formPayload.role) as UserRoleCode,
    };

    if (editingId) {
      updateUser({
        id: editingId,
        data: { ...comum, status: Number(formPayload.status) as UserStatusCode },
      });
      return;
    }

    // Sem senha e sem status: o servidor grava a padrão e deixa Pendente. Enviar
    // uma senha aqui foi o defeito que fez o PDV recusar o login recém-criado —
    // a tela pedia a senha e o servidor a descartava.
    createUser({ data: comum });
  }

  /**
   * Executa a remoção física/lógica de um usuário.
   *
   * @param id Identificador do usuário.
   */
  function handleDeleteUser(id: number) {
    deleteUser({ id });
  }

  /** Devolve o usuário à senha padrão e ao status Pendente. */
  function handleResetPassword(id: number) {
    resetPassword({ id });
  }

  return {
    page,
    setPage,
    dialogOpen,
    setDialogOpen,
    editingId,
    deleteId,
    setDeleteId,
    resetTarget,
    setResetTarget,
    firstAccess,
    setFirstAccess,
    form,
    setForm,
    data,
    isLoading,
    roleOptions,
    statusOptions,
    selectableRoleOptions,
    selectableStatusOptions,
    editableStatusOptions,
    pendentePrimeiroAcesso,
    roleLabels,
    statusLabels,
    creating,
    updating,
    deleting,
    resetting,
    openCreate,
    openEdit,
    handleSubmitUser,
    handleDeleteUser,
    handleResetPassword,
    usernameFromEmail,
  };
}
