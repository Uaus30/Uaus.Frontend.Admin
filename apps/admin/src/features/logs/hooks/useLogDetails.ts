import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGetLogQueryKey,
  getGetLogsQueryKey,
  markLogAsVerified,
  useGetLog,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { useLocation } from "wouter";

/**
 * Coordena leitura e verificação do detalhe. A mutação vive fora da página
 * para manter em um único lugar o cache, o feedback e o tratamento de erro.
 */
export function useLogDetails(idParam: string | undefined) {
  const id = Number(idParam);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const query = useGetLog(id);

  useEffect(() => {
    if (!query.isError || !query.error) return;

    toast({
      title: "Erro ao carregar detalhes do log",
      description: describeApiError(query.error, "Log não encontrado."),
      variant: "destructive",
    });
    setLocation("/sistema/logs");
  }, [query.isError, query.error, toast, setLocation]);

  const verifyMutation = useMutation({
    mutationFn: () => markLogAsVerified(id),
    onSuccess: async (updatedLog) => {
      queryClient.setQueryData([...getGetLogQueryKey(), id], updatedLog);
      await queryClient.invalidateQueries({ queryKey: getGetLogsQueryKey() });
      toast({
        title: "Log marcado como verificado",
        description: "A pendência humana foi encerrada.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao verificar o log",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  return {
    log: query.data,
    isLoading: query.isLoading,
    isVerifying: verifyMutation.isPending,
    markAsVerified: () => verifyMutation.mutate(),
  };
}
