import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTaskCardComment,
  deleteTaskCardComment,
  TASK_CARDS_QUERY_KEY,
  updateTaskCardComment,
  useGetTaskCardActivities,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useSessao } from "@/hooks/use-sessao";

/**
 * useCardActivity
 *
 * A linha do tempo do cartão (comentários e histórico, do mais antigo ao mais
 * recente) e as ações sobre comentário. O histórico não tem ação: o servidor o
 * grava sozinho junto com cada mudança do cartão, e a invalidação do prefixo dos
 * cartões — que toda mutação do quadro já faz — traz a linha nova.
 *
 * O id da sessão vem junto porque só o autor vê "Editar" e "Excluir" no próprio
 * comentário (o servidor recusa os outros de qualquer jeito).
 */
export function useCardActivity(cardId: number | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: activities, isLoading, isError } = useGetTaskCardActivities(cardId);
  const { data: me } = useSessao();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TASK_CARDS_QUERY_KEY });

  const fail = (title: string) => (error: unknown) =>
    toast({ title, description: describeApiError(error), error, variant: "destructive" });

  const addMutation = useMutation({
    mutationFn: (text: string) => addTaskCardComment(cardId!, { text }),
    onSuccess: invalidate,
    onError: fail("Erro ao comentar"),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { commentId: number; text: string }) =>
      updateTaskCardComment(cardId!, input.commentId, { text: input.text }),
    onSuccess: invalidate,
    onError: fail("Erro ao editar o comentário"),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteTaskCardComment(cardId!, commentId),
    onSuccess: invalidate,
    onError: fail("Erro ao excluir o comentário"),
  });

  return {
    activities: activities ?? [],
    isLoading,
    isError,
    currentUserId: me?.id ?? null,

    addComment: (text: string) => addMutation.mutateAsync(text),
    isAdding: addMutation.isPending,
    updateComment: (commentId: number, text: string) => updateMutation.mutateAsync({ commentId, text }),
    isUpdating: updateMutation.isPending,
    deleteComment: (commentId: number) => deleteMutation.mutateAsync(commentId),
    isDeleting: deleteMutation.isPending,
  };
}

export type CardActivityController = ReturnType<typeof useCardActivity>;
