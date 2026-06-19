import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook customizado para gerenciar a lógica de autenticação (Login) no painel.
 */
export function useLoginFeature() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation do React Query para efetuar o login
  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), (data as any).user ?? data);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: "Erro ao entrar",
          description: err?.message || "Credenciais inválidas. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  });

  /**
   * Dispara a ação de login transmitindo os dados informados.
   */
  const submitLogin = () => {
    login({ data: { login: identifier, password } });
  };

  /**
   * Intercepta o evento onSubmit do formulário para efetuar a autenticação.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitLogin();
  };

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    isPending,
    submitLogin,
    handleSubmit,
  };
}
