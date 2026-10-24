import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTaskLabel,
  deleteTaskLabel,
  getGetTaskLabelsQueryKey,
  TASK_CARDS_QUERY_KEY,
  TASK_LABEL_PRIORITY,
  enumCode,
  updateTaskLabel,
  useGetTaskLabels,
  type TaskLabelDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import type { TaskLabelForm } from "../types";

function emptyForm(): TaskLabelForm {
  // A prioridade é da tarefa desde 23/10/2026; a etiqueta nova nasce sem a dela.
  return { name: "", color: "blue", priority: TASK_LABEL_PRIORITY.None };
}

/**
 * useTaskLabels
 *
 * Cadastro das etiquetas (nome e cor da paleta). A exclusão é lógica e a
 * etiqueta some de todas as tarefas — por isso a confirmação cita o nome dela.
 *
 * A prioridade da etiqueta saiu da tela em 23/10/2026 (agora é da tarefa), mas o
 * servidor ainda a grava: editar devolve a que a etiqueta tinha, para não zerar
 * em silêncio um dado que outra tela antiga ainda poderia mostrar.
 */
export function useTaskLabels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetTaskLabels();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskLabelForm>(emptyForm);

  // As etiquetas viajam dentro de cada tarefa, então mudar uma invalida as
  // duas coisas: a lista de etiquetas e as tarefas que a exibem.
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
      toast({ title: "Etiqueta excluída.", description: "Ela saiu de todas as tarefas." });
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
      priority: enumCode(label.priority, TASK_LABEL_PRIORITY) as TaskLabelForm["priority"],
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
