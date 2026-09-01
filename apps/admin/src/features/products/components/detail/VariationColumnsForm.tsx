import React, { useState } from "react";
import { AlertTriangle, Grid3X3 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Checkbox } from "@workspace/ui";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { GRADE_TYPE, GRADE_TYPE_LABELS, type GradeTypeCode } from "@workspace/api-client-react";
import type { ProductGrade } from "../../types";

/** Ordem em que as grades aparecem na modal e no nome composto. */
const GRADES_DISPONIVEIS: GradeTypeCode[] = [GRADE_TYPE.Color, GRADE_TYPE.Size, GRADE_TYPE.Model];

type VariationColumnsFormProps = {
  selectedGrades: ProductGrade[];
  variationCount: number;
  onCancel: () => void;
  onConfirm: (grades: ProductGrade[]) => void;
};

/**
 * Escolha das COLUNAS de um produto que já tem variação gravada.
 *
 * Não pede valor nenhum de propósito. Marcar uma grade acrescenta a coluna em
 * branco nas variações que existem e o operador digita o valor de cada uma na
 * tabela; nenhuma linha é criada nem excluída aqui. Cruzar as grades num
 * produto com venda obrigaria a chutar qual variação fica com qual valor novo,
 * e a combinação que saísse do cruzamento seria apagada no servidor NA HORA,
 * antes de qualquer Salvar.
 */
export function VariationColumnsForm({
  selectedGrades,
  variationCount,
  onCancel,
  onConfirm,
}: VariationColumnsFormProps) {
  const [marcadas, setMarcadas] = useState<GradeTypeCode[]>(() => selectedGrades.map((grade) => grade.type));

  const valoresEmUso = new Map(selectedGrades.map((grade) => [grade.type, grade.values]));
  const aRemover = selectedGrades.filter(
    (grade) => !marcadas.includes(grade.type) && grade.values.length > 0,
  );
  // Variação sem valor de grade nenhum é recusada no salvar: o produto tem que
  // ficar com ao menos uma coluna.
  const podeAplicar = marcadas.length > 0;

  function alternarGrade(type: GradeTypeCode) {
    setMarcadas((atuais) => (atuais.includes(type) ? atuais.filter((t) => t !== type) : [...atuais, type]));
  }

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary" />
          Colunas de Grade
        </DialogTitle>
        <DialogDescription>
          Marque as grades que este produto usa. A coluna entra <strong>em branco</strong> e você preenche o
          valor de cada variação na tabela.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 py-2">
        {GRADES_DISPONIVEIS.map((type) => {
          const marcada = marcadas.includes(type);
          const valores = valoresEmUso.get(type) ?? [];

          return (
            <div
              key={type}
              className={`rounded-xl border p-3 transition-colors ${marcada ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox checked={marcada} onCheckedChange={() => alternarGrade(type)} />
                <span className="text-sm font-medium text-foreground">{GRADE_TYPE_LABELS[type]}</span>
              </label>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">
                {valores.length > 0
                  ? `Em uso: ${valores.join(" · ")}`
                  : marcada
                    ? `Coluna em branco — preencha nas ${variationCount} variações da tabela.`
                    : "Não usada neste produto."}
              </p>
            </div>
          );
        })}
      </div>

      {aRemover.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm leading-tight">
            Desmarcar <strong>{aRemover.map((grade) => GRADE_TYPE_LABELS[grade.type]).join(", ")}</strong>{" "}
            apaga a coluna e o valor dela em todas as variações. As variações continuam no cadastro.
          </p>
        </div>
      )}

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {podeAplicar
            ? "Nenhuma variação é criada nem excluída aqui."
            : "O produto precisa de ao menos uma grade."}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!podeAplicar}
            onClick={() =>
              onConfirm(marcadas.map((type) => ({ type, values: valoresEmUso.get(type) ?? [] })))
            }
          >
            Aplicar Colunas
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
