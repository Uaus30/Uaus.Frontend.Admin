import React, { useState } from "react";
import { AlertTriangle, Grid3X3 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Checkbox } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Input } from "@workspace/ui";
import { GRADE_TYPE, GRADE_TYPE_LABELS, type GradeTypeCode } from "@workspace/api-client-react";
import { gerarCombinacoes } from "../../lib/variationMatrix";
import type { ProductGrade } from "../../types";

/** Ordem em que as grades aparecem na modal e no nome composto. */
const GRADES_DISPONIVEIS: GradeTypeCode[] = [GRADE_TYPE.Color, GRADE_TYPE.Size, GRADE_TYPE.Model];

type VariationGradesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grades do produto hoje. Reabrir a modal mostra o que já está configurado. */
  selectedGrades: ProductGrade[];
  /** Quantas variações já existem — o aviso de perda usa este número. */
  variationCount: number;
  onConfirm: (grades: ProductGrade[]) => void;
};

/** "Azul, Preto, Rosa" -> ["Azul", "Preto", "Rosa"], sem repetidos nem vazios. */
function separarValores(texto: string): string[] {
  const vistos = new Set<string>();
  const valores: string[] = [];

  for (const bruto of texto.split(",")) {
    const valor = bruto.trim();
    if (!valor) continue;
    const chave = valor.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    valores.push(valor);
  }

  return valores;
}

/**
 * Escolha das grades da variação e dos valores de cada uma.
 *
 * Substituiu, em 30/08/2026, a modal que listava o CATÁLOGO de grades. Aquela
 * exigia cadastrar a grade antes — criar "Cor", associar à categoria, cadastrar
 * as opções — e ninguém cadastrava: o banco tinha 8 grades e 99 opções com zero
 * produtos ligados a elas.
 *
 * Aqui os três tipos são fixos e os valores são digitados no próprio produto.
 * É isso que deixa "Cor" ter duas opções neste produto e cinco no vizinho.
 */
export function VariationGradesModal({
  open,
  onOpenChange,
  selectedGrades,
  variationCount,
  onConfirm,
}: VariationGradesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        O formulário é remontado a cada abertura (`key`), e é assim que ele
        aparece marcado com o que o produto já tem sem sincronizar estado com
        prop num efeito — que além de proibido pelo lint mostraria a modal em
        branco por um render.
      */}
      {open && (
        <GradesForm
          key={String(open)}
          selectedGrades={selectedGrades}
          variationCount={variationCount}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  );
}

type GradesFormProps = {
  selectedGrades: ProductGrade[];
  variationCount: number;
  onCancel: () => void;
  onConfirm: (grades: ProductGrade[]) => void;
};

function GradesForm({ selectedGrades, variationCount, onCancel, onConfirm }: GradesFormProps) {
  const [marcadas, setMarcadas] = useState<GradeTypeCode[]>(() => selectedGrades.map((grade) => grade.type));
  const [textos, setTextos] = useState<Record<number, string>>(
    () =>
      Object.fromEntries(selectedGrades.map((grade) => [grade.type, grade.values.join(", ")])) as Record<
        number,
        string
      >,
  );

  const grades: ProductGrade[] = marcadas.map((type) => ({
    type,
    values: separarValores(textos[type] ?? ""),
  }));

  const totalDeVariacoes = gerarCombinacoes(grades).length;
  const podeGerar = marcadas.length > 0 && grades.every((grade) => grade.values.length > 0);

  function alternarGrade(type: GradeTypeCode) {
    setMarcadas((atuais) => (atuais.includes(type) ? atuais.filter((t) => t !== type) : [...atuais, type]));
  }

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary" />
          Configurar Variações
        </DialogTitle>
        <DialogDescription>
          Escolha as grades e digite os valores de cada uma, separados por vírgula.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto pr-1">
        {GRADES_DISPONIVEIS.map((type) => {
          const marcada = marcadas.includes(type);
          const valores = separarValores(textos[type] ?? "");

          return (
            <div
              key={type}
              className={`rounded-xl border p-3 transition-colors ${marcada ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox checked={marcada} onCheckedChange={() => alternarGrade(type)} />
                <span className="text-sm font-medium text-foreground">{GRADE_TYPE_LABELS[type]}</span>
              </label>

              {marcada && (
                <div className="mt-3 space-y-1.5 pl-7">
                  <Input
                    value={textos[type] ?? ""}
                    onChange={(e) => setTextos((atuais) => ({ ...atuais, [type]: e.target.value }))}
                    placeholder={
                      type === GRADE_TYPE.Color
                        ? "Ex: Azul, Preto, Rosa"
                        : type === GRADE_TYPE.Size
                          ? "Ex: P, M, G"
                          : "Ex: Com alça, Sem alça"
                    }
                    className="bg-background"
                    aria-label={`Valores de ${GRADE_TYPE_LABELS[type]}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {valores.length === 0
                      ? "Digite ao menos um valor."
                      : `${valores.length} valor(es): ${valores.join(" · ")}`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {variationCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm leading-tight">
            As {variationCount} variações configuradas serão substituídas — preço, código de barras e estoque
            digitados em cada uma se perdem junto.
          </p>
        </div>
      )}

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {podeGerar ? `Serão geradas ${totalDeVariacoes} variações.` : "Escolha ao menos uma grade."}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={!podeGerar} onClick={() => onConfirm(grades)}>
            Gerar Variações
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
