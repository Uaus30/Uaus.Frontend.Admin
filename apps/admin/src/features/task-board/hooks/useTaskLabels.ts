import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTaskLabel,
  deleteTaskLabel,
  getGetTaskLabelsQueryKey,
  TASK_CARDS_QUERY_KEY,
  TASK_LABEL_PRIORITY,
  updateTaskLabel,
  useGetTaskLabels,
  type TaskLabelDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { priorityCode } from "../board";
import type { TaskLabelForm } from "../types";

function emptyForm(): TaskLabelForm {
  // Sem prioridade por padrão: etiqueta que só classifica ("Cadastro", "Pedido
  // de cliente") não tem urgência, e fica abaixo das que têm.
  return { name: "", color: "blue", priority: TASK_LABEL_PRIORITY.None };
}

/**
 * useTaskLabels
 *
 * Cadastro das etiquetas (nome, cor da paleta e prioridade). A exclusão é
 * lógica e a etiqueta some de todos os cartões — por isso a confirmação cita o
 * nome dela.
 */
export function useTaskLabels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetTaskLabels();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskLabelForm>(emptyForm);

  // As etiquetas viajam dentro de cada cartão, então mudar uma invalida as
  // duas coisas: a lista de etiquetas e os cartões que a exibem.
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetTaskLabelsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: TASK_CARDS_QUERY_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (input: { id: number | null; form: TaskLabelForm }) => {
      const payload = {
        name: input.form.name.trim(),
        color: input.form.color,
        priority: input.form.priority,
      };
      return input.id ? updateTaskLabel(input.id, payload) : createTaskLabel(payload);
    },
    onSuccess: async (_result, input) => {
      await invalidate();
      toast({ title: input.id ? "Etiqueta atualizada." : "Etiqueta criada." });
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar a etiqueta",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskLabel(id),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Etiqueta excluída.", description: "Ela saiu de todos os cartões." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao excluir a etiqueta",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  function startEdit(label: TaskLabelDto) {
    setEditingId(label.id);
    setForm({
      name: label.name,
      color: label.color as TaskLabelForm["color"],
      priority: priorityCode(label.priority) as TaskLabelForm["priority"],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function submit() {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome da etiqueta", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: editingId, form });
  }

  return {
    labels: data ?? [],
    isLoading,
    editingId,
    form,
    setForm,
    startEdit,
    cancelEdit,
    submit,
    isSaving: saveMutation.isPending,
    /** Devolve a Promise: o ConfirmDialog só fecha quando ela resolve. */
    remove: (id: number) => deleteMutation.mutateAsync(id),
    isDeleting: deleteMutation.isPending,
  };
}
