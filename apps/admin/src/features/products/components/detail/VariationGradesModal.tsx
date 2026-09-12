import React from "react";
import { Dialog } from "@workspace/ui";
import { VariationColumnsForm } from "./VariationColumnsForm";
import type { ProductGrade } from "../../types";

type VariationGradesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grades do produto hoje. Reabrir a modal mostra o que já está configurado. */
  selectedGrades: ProductGrade[];
  /** Quantas linhas a tabela já tem. Zero é o produto que ainda não tem variação. */
  variationCount: number;
  onConfirm: (grades: ProductGrade[]) => void;
};

/**
 * Escolha das grades da variação — o TIPO, e só ele.
 *
 * Substituiu, em 30/08/2026, a modal que listava o CATÁLOGO de grades. Aquela
 * exigia cadastrar a grade antes — criar "Cor", associar à categoria, cadastrar
 * as opções — e ninguém cadastrava: o banco tinha 8 grades e 99 opções com zero
 * produtos ligados a elas. Aqui os três tipos são fixos e o valor de cada
 * variação pertence ao produto, o que deixa "Cor" ter duas opções neste produto
 * e cinco no vizinho.
 *
 * Os VALORES saíram da modal em 12/09/2026. Ela cruzava as grades e gerava a
 * matriz cartesiana enquanto o cadastro não tinha variação salva, e isso
 * significava duas modais no mesmo botão — a diferença entre elas dependia de
 * algo que não aparece na tela. Pior: em produto simples JÁ SALVO, que é onde a
 * maioria das variações nasce, a matriz era descartada logo em seguida pela
 * carga do grupo. Hoje a tabela nasce com o próprio produto e a coluna em
 * branco, e as demais linhas entram pelo "Acrescentar variação".
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
        <VariationColumnsForm
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
