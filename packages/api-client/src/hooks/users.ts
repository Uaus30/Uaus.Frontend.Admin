/**
 * Usuários.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  apiGetOrThrow,
  apiPost,
  apiPut,
  apiDelete,
  ApiError,
  getAuthSession,
  setAuthSession,
  useCrudMutation,
  mapPagedResult,
} from "../client";
import { getGetMeQueryKey } from "./auth";
import type {
  BackendPagedResult,
  ChangePasswordPayload,
  CreateUserPayload,
  QueryKey,
  UiPagedResult,
  UpdateUserPayload,
  UserDto,
  UserFirstAccessDto,
  UserListDto,
} from "../models";

export const getGetUsersQueryKey = (): QueryKey => ["users"];

export function useGetUsers(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<UserListDto>, ApiError, UiPagedResult<UserListDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<UserListDto>, ApiError, UiPagedResult<UserListDto>, QueryKey>({
    queryKey: [...getGetUsersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<UserListDto>>("/Users", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Cadastra o usuário. A resposta traz a senha do primeiro acesso — a tela
 * precisa dela para o administrador repassar ao operador.
 */
export function useCreateUser(options?: {
  mutation?: UseMutationOptions<UserFirstAccessDto | null, ApiError, { data: CreateUserPayload }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<UserFirstAccessDto>("/Users", data);
    return response.data;
  }, options);
}

export function useUpdateUser(options?: {
  mutation?: UseMutationOptions<UserDto | null, ApiError, { id: number; data: UpdateUserPayload }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<UserDto>("/Users", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteUser(options?: { mutation?: UseMutationOptions<null, ApiError, { id: number }> }) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Users/${id}`);
    return response.data;
  }, options);
}

/**
 * Troca a senha do PRÓPRIO usuário autenticado.
 *
 * Não recebe id: o servidor tira o alvo do token. Aceitar id deixaria qualquer
 * autenticado reescrever a senha de qualquer outro.
 *
 * Quem estava `Pending` vira `Active` — é o que conclui o primeiro acesso. A
 * sessão guardada é atualizada aqui dentro, no `mutationFn`, e não num
 * `onSuccess`: o `useCrudMutation` espalha as opções de quem chama por cima das
 * nossas, então um `onSuccess` do app substituiria este e a gravação sumiria. O
 * sintoma seria a tela de troca obrigatória reaparecendo para sempre, porque o
 * `localStorage` continuaria dizendo `Pending`. Mesmo motivo pelo qual o
 * `useLogin` grava a sessão dentro do `mutationFn`.
 */
export function useChangePassword(options?: {
  mutation?: UseMutationOptions<UserDto | null, ApiError, { data: ChangePasswordPayload }>;
}) {
  const queryClient = useQueryClient();

  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<UserDto>("/Users/change-password", data);
    const user = response.data;

    if (user) {
      const session = getAuthSession();
      // O token segue valendo: a troca de senha não o invalida, e pedir um novo
      // login logo depois obrigaria o operador a digitar a senha recém-criada
      // numa tela que ele acabou de deixar.
      if (session) setAuthSession({ ...session, user });
      queryClient.setQueryData(getGetMeQueryKey(), user);
    }

    return user;
  }, options);
}

/**
 * Devolve o usuário à senha padrão e ao status Pendente, forçando novo primeiro
 * acesso. Operação de administrador, para quem esqueceu a senha.
 */
export function useResetUserPassword(options?: {
  mutation?: UseMutationOptions<UserFirstAccessDto | null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiPost<UserFirstAccessDto>(`/Users/${id}/reset-password`, {});
    return response.data;
  }, options);
}
