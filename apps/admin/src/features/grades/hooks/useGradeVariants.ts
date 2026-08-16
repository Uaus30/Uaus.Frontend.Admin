import { useState } from "react";
import { useToast } from "@workspace/ui";
import type { GradeType, GradeVariant } from "../types";

/** Cor inicial da linha fantasma. Preto é tratado como "sem cor escolhida". */
const DEFAULT_GHOST_COLOR = "#000000";

/**
 * Estado do editor de opções (variantes) de uma grade.
 *
 * Saiu de dentro de `useGrades` porque são duas responsabilidades sem relação:
 * uma cuida da grade no servidor, a outra da tabela de opções que o operador
 * arrasta na tela. Juntas passavam de 400 linhas num arquivo só.
 *
 * @param gradeType Tipo da grade. Só grade de Cor valida hexadecimal repetido.
 */
export function useGradeVariants(gradeType: GradeType) {
  const { toast } = useToast();

  const [variants, setVariants] = useState<GradeVariant[]>([]);
  /** Índice arrastado no momento; `null` quando não há arraste em curso. */
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  /** Linha fantasma de adição rápida: o operador digita e ela vira variante. */
  const [ghostValue, setGhostValue] = useState("");
  const [ghostColorHex, setGhostColorHex] = useState(DEFAULT_GHOST_COLOR);

  /** Recarrega a lista (abertura do modal) e zera a linha fantasma. */
  function resetVariants(next: GradeVariant[]) {
    setVariants(next);
    setGhostValue("");
    setGhostColorHex(DEFAULT_GHOST_COLOR);
  }

  /**
   * Remove uma linha de variante pelo índice local.
   */
  function removeVariantRow(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Atualiza o valor ou cor de uma variante existente na lista local.
   */
  function updateVariant(index: number, field: keyof GradeVariant, value: string) {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  /**
   * Consolida a linha fantasma, transformando-a numa variante efetiva.
   *
   * DEVOLVE a lista resultante além de gravá-la no estado. Sem isso, quem
   * chamasse `commitGhostRow()` e lesse `variants` na mesma função enxergaria a
   * lista anterior — o `setState` do React só aparece no próximo render. Era
   * exatamente o que acontecia ao salvar: a opção recém-digitada aparecia na
   * tabela e não ia no payload, e com a tabela vazia o formulário ainda
   * reclamava "adicione ao menos uma opção" com a linha visível na tela.
   */
  function commitGhostRow(): GradeVariant[] {
    const value = ghostValue.trim();
    if (!value) return variants;

    const valueExists = variants.some((v) => v.value.toLowerCase() === value.toLowerCase());
    if (valueExists) {
      toast({ title: "Este valor já existe nas opções.", variant: "destructive" });
      return variants;
    }

    if (gradeType === "Cor") {
      const colorExists = variants.some((v) => v.colorHex?.toLowerCase() === ghostColorHex.toLowerCase());
      if (colorExists) {
        toast({ title: "Esta cor (hexadecimal) já está sendo usada.", variant: "destructive" });
        return variants;
      }
    }

    const committed: GradeVariant[] = [
      ...variants,
      {
        // Id local e temporário: a variante ainda não existe no banco. O
        // `handleSubmit` só manda o id ao servidor quando ele bate com o de uma
        // variante que já estava na grade.
        id: Date.now() + Math.random(),
        value,
        colorHex: gradeType === "Cor" ? ghostColorHex : undefined,
        order: variants.length,
      },
    ];

    setVariants(committed);
    setGhostValue("");
    return committed;
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(event: React.DragEvent, index: number) {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newVariants = [...variants];
    const draggedItem = newVariants[draggedIndex];
    newVariants.splice(draggedIndex, 1);
    newVariants.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setVariants(newVariants);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  return {
    variants,
    setVariants,
    resetVariants,
    draggedIndex,
    ghostValue,
    setGhostValue,
    ghostColorHex,
    setGhostColorHex,
    removeVariantRow,
    updateVariant,
    commitGhostRow,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
