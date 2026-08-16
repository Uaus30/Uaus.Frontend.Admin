/**
 * Autenticação — sessão do usuário logado, login e logout.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import {
  ApiError,
  useCrudMutation,
  apiRequest,
  getAuthSession,
  setAuthSession,
  clearAuthSession,
  isTokenExpired,
} from "../client";
import type { AuthenticatedUserDto, QueryKey, UserDto } from "../models";

/** Chave de cache do usuário logado. */
export const getGetMeQueryKey = (): QueryKey => ["auth", "me"];

export function useGetMe(options?: {
  query?: Omit<UseQueryOptions<UserDto | null, ApiError, UserDto | null, QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<UserDto | null, ApiError, UserDto | null, QueryKey>({
    queryKey: getGetMeQueryKey(),
    queryFn: async () => {
      const session = getAuthSession();
      if (!session || isTokenExpired(session)) {
        clearAuthSession();
        return null;
      }
      return session.user;
    },
    ...options?.query,
  });
}

export function useLogin(options?: {
  mutation?: UseMutationOptions<
    AuthenticatedUserDto,
    ApiError,
    { data: { login?: string; email?: string; username?: string; password: string } }
  >;
}) {
  return useCrudMutation(async ({ data }) => {
    const login = data.login ?? data.username ?? data.email ?? "";
    // Credenciais vão no CORPO JSON, nunca em params: querystring com senha fica
    // gravada em logs de acesso (proxy/gateway) e no histórico do navegador.
    const authResponse = await apiRequest<AuthenticatedUserDto>("POST", "/Users/authenticate", {
      body: {
        login,
        password: data.password,
      },
      auth: false,
    });

    const session = authResponse.data as AuthenticatedUserDto;
    setAuthSession(session);
    return session;
  }, options);
}

export function useLogout(options?: { mutation?: UseMutationOptions<void, ApiError, void> }) {
  return useCrudMutation(async () => {
    clearAuthSession();
  }, options);
}
