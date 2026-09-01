import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { GRADE_TYPE, GRADE_TYPE_LABELS, type GradeTypeCode } from "@workspace/api-client-react";

/** Ordem fixa das opções, a mesma da modal de configuração. */
const TIPOS_DE_GRADE: GradeTypeCode[] = [GRADE_TYPE.Color, GRADE_TYPE.Size, GRADE_TYPE.Model];

type VariationGradeHeaderProps = {
  /** Tipo desta coluna hoje. */
  type: GradeTypeCode;
  /** Tipos ocupados pelas OUTRAS colunas — não podem ser escolhidos aqui. */
  tiposEmUso: GradeTypeCode[];
  onChangeType: (de: GradeTypeCode, para: GradeTypeCode) => void;
};

/**
 * Cabeçalho de uma coluna de grade, com a troca do TIPO.
 *
 * A importação do sistema anterior trouxe centenas de produtos com a grade
 * "Modelo" onde o valor é cor ou tamanho, e não havia como corrigir sem
 * destruir o cadastro: pela modal de configuração, trocar "Modelo" por "Cor"
 * gera combinações que não têm grade nenhuma em comum com as atuais — a matriz
 * nasceria em branco e as variações com código de barras iriam para a exclusão.
 *
 * Trocando aqui, a variação continua a mesma: só o nome da coluna muda, e o
 * valor de cada linha fica onde está. A troca vale para TODAS as linhas porque
 * a grade é do grupo, não da variação: uma linha com "Cor" e outra com "Modelo"
 * deixaria as duas com nomes compostos incomparáveis.
 *
 * Tipo já usado por outra coluna sai desabilitado — duas grades do mesmo tipo
 * na mesma variação não têm representação em `ProductVariationValues`, que tem
 * uma linha por grade.
 */
export function VariationGradeHeader({ type, tiposEmUso, onChangeType }: VariationGradeHeaderProps) {
  return (
    <Select
      value={String(type)}
      onValueChange={(valor) => onChangeType(type, Number(valor) as GradeTypeCode)}
    >
      <SelectTrigger
        id={`select-grade-type-${type}`}
        title="Trocar o tipo desta grade"
        className="h-7 w-full gap-1 border-transparent bg-transparent px-1 text-xs font-medium uppercase text-foreground hover:border-border focus:bg-background"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIPOS_DE_GRADE.map((opcao) => (
          <SelectItem
            key={opcao}
            value={String(opcao)}
            disabled={opcao !== type && tiposEmUso.includes(opcao)}
          >
            {GRADE_TYPE_LABELS[opcao]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
