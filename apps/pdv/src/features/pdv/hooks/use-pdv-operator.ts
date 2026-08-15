import { useEffect } from "react";
import { useLocation } from "wouter";
import { STALE_TIME, useGetMe } from "@workspace/api-client-react";

/**
 * Operador autenticado no caixa, e o desvio para o login quando não há um.
 *
 * O redirecionamento mora aqui, junto da leitura, porque as duas coisas são a
 * mesma decisão: sem `/me` não existe caixa — nem tela para mostrar. O `retry:
 * false` é o que faz um 401 virar redirecionamento na hora, em vez de três
 * tentativas com o operador olhando para um spinner.
 *
 * O `staleTime` de 5 minutos evita refetch a cada foco de janela: o nome do
 * operador não muda no meio do turno, e o PDV fica horas aberto.
 */
export function usePdvOperator() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useGetMe({
    query: { retry: false, staleTime: STALE_TIME.catalogo },
  });

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user, setLocation]);

  /**
   * Nome impresso no cupom e mostrado no cabeçalho.
   *
   * O backend nem sempre devolve `firstName` (contas antigas trazem só `name`),
   * e um cupom sem operador é um cupom que ninguém consegue auditar — daí o
   * último degrau genérico.
   */
  const operatorName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : ((user as { name?: string } | undefined)?.name || "Operador");

  return { user, isLoading, operatorName };
}
