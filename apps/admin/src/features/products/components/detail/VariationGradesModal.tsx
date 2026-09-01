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
import { Textarea } from "@workspace/ui";
import { GRADE_TYPE, GRADE_TYPE_LABELS, type GradeTypeCode } from "@workspace/api-client-react";
import { gerarCombinacoes, juntarValoresDeGrade, separarValoresDeGrade } from "../../lib/variationMatrix";
import type { ProductGrade } from "../../types";

/** Ordem em que as grades aparecem na modal e no nome composto. */
const GRADES_DISPONIVEIS: GradeTypeCode[] = [GRADE_TYPE.Color, GRADE_TYPE.Size, GRADE_TYPE.Model];

/** Exemplo de preenchimento, já no formato de uma linha por valor. */
const PLACEHOLDERS: Record<GradeTypeCode, string> = {
  [GRADE_TYPE.Color]: "Azul\nPreto\nRosa",
  [GRADE_TYPE.Size]: "10L\n6L\n3,6L",
  [GRADE_TYPE.Model]: "Com alça\nSem alça",
};

type VariationGradesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grades do produto hoje. Reabrir a modal mostra o que já está configurado. */
  selectedGrades: ProductGrade[];
  /** Quantas variações já existem — o aviso de perda usa este número. */
  variationCount: number;
  onConfirm: (grades: ProductGrade[]) => void;
};

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
      Object.fromEntries(
        selectedGrades.map((grade) => [grade.type, juntarValoresDeGrade(grade.values)]),
      ) as Record<number, string>,
  );

  const grades: ProductGrade[] = marcadas.map((type) => ({
    type,
    values: separarValoresDeGrade(textos[type] ?? ""),
  }));

  const totalDeVariacoes = gerarCombinacoes(grades).length;
  // Mínimo DOIS: o cadastro com variações exige duas no salvar — deixar gerar
  // uma só empurraria o operador para um erro que a modal já sabia prever.
  const podeGerar =
    marcadas.length > 0 && grades.every((grade) => grade.values.length > 0) && totalDeVariacoes >= 2;

  function alternarGrade(type: GradeTypeCode) {
    setMarcadas((atuais) => (atuais.includes(type) ? atuais.filter((t) => t !== type) : [...atuais, type]));
  }

  // Grade que ENTRA agora trazendo mais de um valor: as variações de hoje só
  // cabem em uma das combinações novas, e quem escolhe é a ordem — a primeira
  // fica com elas. Com um valor só não há escolha a fazer, e é por isso que o
  // aviso não aparece nesse caso.
  const gradesNovasComEscolha = grades.filter(
    (grade) => grade.values.length > 1 && !selectedGrades.some((atual) => atual.type === grade.type),
  );

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary" />
          Configurar Variações
        </DialogTitle>
        <DialogDescription>
          Escolha as grades e digite os valores de cada uma, <strong>um por linha</strong>.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto pr-1">
        {GRADES_DISPONIVEIS.map((type) => {
          const marcada = marcadas.includes(type);
          const valores = separarValoresDeGrade(textos[type] ?? "");

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
                  {/*
                    Um valor por LINHA, não por vírgula: a vírgula é o separador
                    decimal do português e partia "3,6L" em "3" e "6L".
                  */}
                  <Textarea
                    value={textos[type] ?? ""}
                    onChange={(e) => setTextos((atuais) => ({ ...atuais, [type]: e.target.value }))}
                    rows={3}
                    placeholder={PLACEHOLDERS[type]}
                    className="bg-background font-mono text-xs leading-relaxed"
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
          <div className="space-y-1.5 text-sm leading-tight">
            <p>
              As variações de hoje são <strong>aproveitadas</strong> pelas combinações novas, com preço,
              código de barras e estoque. O que sobrar sai do cadastro — exceto o que já tem venda, que
              permanece na lista.
            </p>
            {gradesNovasComEscolha.length > 0 && (
              <p>
                {gradesNovasComEscolha
                  .map((grade) => `${GRADE_TYPE_LABELS[grade.type]} tem ${grade.values.length} valores novos`)
                  .join("; ")}
                : as variações atuais ficam com{" "}
                <strong>{gradesNovasComEscolha.map((grade) => grade.values[0]).join(" · ")}</strong> e as
                demais combinações nascem em branco.
              </p>
            )}
          </div>
        </div>
      )}

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {podeGerar
            ? `A matriz terá ${totalDeVariacoes} variações.`
            : totalDeVariacoes === 1
              ? "O cadastro com variações exige ao menos duas combinações."
              : "Escolha ao menos uma grade."}
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
