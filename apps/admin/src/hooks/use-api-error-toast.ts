import { useEffect } from "react";
import { useToast } from "@workspace/ui";

/**
 * Avisa quando o SERVIDOR falhou, não quando a requisição falhou.
 *
 * Erro 5xx é problema do servidor: não há nada que o usuário possa corrigir, e a
 * tela costuma ficar vazia sem explicação. Erro 4xx é outra conversa — ele tem
 * mensagem própria e vai para o toast de quem disparou a ação.
 *
 * Existe porque quatro features reimplementavam este efeito, cada uma com um
 * `as any` para ler `error.status`, e uma delas com o texto diferente.
 *
 * @param isError A query falhou.
 * @param error O erro devolvido pela query.
 */
export function useApiErrorToast(isError: boolean, error: unknown) {
  const { toast } = useToast();

  useEffect(() => {
    if (!isError || !error) return;

    // Leitura por duck typing, como o describeApiError: o hook não precisa
    // conhecer a classe ApiError para saber o status.
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : 0;

    if (status < 500) return;

    toast({
      title: "Servidor indisponível",
      description: "O servidor está indisponível no momento. Tente novamente em instantes.",
      variant: "destructive",
    });
  }, [isError, error, toast]);
}
