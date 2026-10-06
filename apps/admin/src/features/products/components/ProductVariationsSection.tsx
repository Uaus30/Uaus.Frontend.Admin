import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { VariationGradeHeader } from "./VariationGradeHeader";
import { ProductVariationCards } from "./ProductVariationCards";
import {
  VariationBarcodeField,
  VariationDeleteButton,
  VariationGradeField,
  VariationPriceField,
  VariationStatusField,
  VariationStock,
} from "./VariationFields";
import { nomeExibidoDaVariacao } from "../lib/variationNames";
import { LG_BREAKPOINT, useNarrowerThan } from "@/hooks/use-narrower-than";
import type { VariationDraft, ProductGrade } from "../types";

type ProductVariationsSectionProps = {
  /** Array of currently configured variation drafts */
  variationDrafts: VariationDraft[];
  /** Grades escolhidas para ESTE produto, com os valores de cada uma */
  selectedGrades: ProductGrade[];
  /** Nome do grupo — é ele que abre o nome exibido de toda variação */
  productGroupName: string;
  /** Boolean indicating if loading existing products under the group */
  isFetchingGroupProducts: boolean;
  /** Selectable list of status configurations from API/enums */
  selectableStatusOptions: Array<{ id: number; name: string }>;
  /** Validation errors map to highlight invalid fields in red */
  validationErrors: Record<string, boolean>;
  /** Callback to update a variation's properties */
  updateVariationDraft: (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;
  /** Handler to set the variation to be confirmed for deletion in AlertDialog */
  setVariationToDelete: (variation: VariationDraft) => void;
  /** Handler to delete a variation locally or on the API */
  handleDeleteVariation: (variation: VariationDraft) => void;
  /** Acrescenta uma linha fora da matriz, para o operador preencher a grade à mão */
  addVariationDraft: (initialValues?: Partial<VariationDraft>) => void;
  /** Troca o TIPO de uma coluna de grade em todas as variações de uma vez */
  changeGradeType: (de: ProductGrade["type"], para: ProductGrade["type"]) => void;
};

/**
 * Tabela das variações do produto.
 *
 * O NOME não é editável, e essa é a mudança de 30/08/2026: toda variação leva o
 * nome do grupo, e o que a distingue são os valores de grade. A coluna "Variação"
 * mostra o nome composto — o mesmo que a venda, o cupom e a etiqueta vão exibir —
 * e as colunas de grade mostram o valor de cada uma.
 *
 * Antes o operador digitava "CAMISETA AZUL G" à mão em cada linha, e o sistema
 * não tinha como saber que aquilo era azul nem tamanho G: 159 dos 162 produtos
 * com variação acabaram com a grade escrita dentro do nome, sem estrutura
 * nenhuma por trás.
 */
export function ProductVariationsSection({
  variationDrafts,
  selectedGrades,
  productGroupName,
  isFetchingGroupProducts,
  selectableStatusOptions,
  validationErrors,
  updateVariationDraft,
  setVariationToDelete,
  handleDeleteVariation,
  addVariationDraft,
  changeGradeType,
}: ProductVariationsSectionProps) {
  // Abaixo do `lg` a tabela (~900px de largura mínima) vira cartões.
  const emCartoes = useNarrowerThan(LG_BREAKPOINT);

  if (variationDrafts.length === 0) return null;

  /** O valor que esta variação tem para uma grade, ou vazio. */
  const valorDaGrade = (variation: VariationDraft, type: ProductGrade["type"]) =>
    variation.values.find((value) => value.gradeType === type)?.value ?? "";

  /**
   * Grava o valor da grade na linha, criando ou trocando o que existir.
   *
   * Campo apagado guarda valor VAZIO em vez de tirar a grade da variação: as
   * colunas são derivadas dos valores das linhas (`gradesDasVariacoes`), então
   * remover a entrada faria a coluna inteira sumir da tabela no instante em que
   * a última célula fosse limpa — inclusive a coluna em branco que a modal
   * acabou de acrescentar para ser preenchida. Valor vazio some sozinho no
   * salvar: o backend ignora valor em branco no `SyncVariationValuesAsync`, e a
   * validação cobra o preenchimento antes disso.
   */
  const definirValor = (variation: VariationDraft, type: ProductGrade["type"], valor: string) => {
    updateVariationDraft(variation.key, (draft) => {
      const jaTem = draft.values.some((value) => value.gradeType === type);
      const proximos = jaTem
        ? draft.values.map((value) => (value.gradeType === type ? { ...value, value: valor } : value))
        : [...draft.values, { gradeType: type, value: valor }];
      return { ...draft, values: proximos };
    });
  };

  return (
    <div
      id="variations-table-container"
      className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-3 sm:p-5 mt-6 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          VARIAÇÕES DO PRODUTO
        </h2>
        {isFetchingGroupProducts ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
      </div>

      {emCartoes ? (
        <ProductVariationCards
          variationDrafts={variationDrafts}
          selectedGrades={selectedGrades}
          productGroupName={productGroupName}
          selectableStatusOptions={selectableStatusOptions}
          validationErrors={validationErrors}
          updateVariationDraft={updateVariationDraft}
          setVariationToDelete={setVariationToDelete}
          handleDeleteVariation={handleDeleteVariation}
          changeGradeType={changeGradeType}
          gradeValue={valorDaGrade}
          setGradeValue={definirValor}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-4 py-3 font-medium w-48 min-w-[11rem] whitespace-nowrap text-center">
                  CÓDIGO
                </th>
                {selectedGrades.map((grade) => (
                  <th
                    key={grade.type}
                    className="px-2 py-2 font-medium w-32 min-w-[8rem] whitespace-nowrap border-l border-border/30 bg-muted/20 text-foreground"
                  >
                    <div className="flex items-center gap-1">
                      <VariationGradeHeader
                        type={grade.type}
                        tiposEmUso={selectedGrades.map((outra) => outra.type)}
                        onChangeType={changeGradeType}
                      />
                      <span className="text-red-500">*</span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium whitespace-nowrap">Variação</th>
                <th className="px-4 py-3 font-medium w-32 min-w-[8rem] whitespace-nowrap text-center">
                  PREÇO <span className="text-red-500">*</span>
                </th>
                {/*
                Somente leitura, e sem asterisco: estoque não se digita aqui —
                ele é a soma dos LOTES do produto (entrada, venda, baixa e
                contagem mexem nele). A coluna existe porque, num produto que
                ganhou grade depois de existir, o saldo fica todo na variação
                mais antiga: sem ela, o operador via a tabela nova e concluía
                que o estoque tinha sumido.
              */}
                <th className="px-4 py-3 font-medium w-28 min-w-[6rem] whitespace-nowrap text-center">
                  ESTOQUE
                </th>
                <th className="px-4 py-3 font-medium w-32 min-w-[8rem] whitespace-nowrap text-center">
                  Status <span className="text-red-500">*</span>
                </th>
                <th className="px-4 py-3 font-medium text-right w-16 whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {variationDrafts.map((variation) => (
                <tr key={variation.key} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2 text-center">
                    <VariationBarcodeField
                      compact
                      variation={variation}
                      updateVariationDraft={updateVariationDraft}
                    />
                  </td>

                  {selectedGrades.map((grade) => (
                    <td key={grade.type} className="px-2 py-2 border-l border-border/30 bg-muted/5">
                      <VariationGradeField
                        compact
                        variation={variation}
                        grade={grade.type}
                        value={valorDaGrade(variation, grade.type)}
                        onChange={(valor) => definirValor(variation, grade.type, valor)}
                        invalid={!!validationErrors[`grade-${grade.type}-${variation.key}`]}
                      />
                    </td>
                  ))}

                  {/*
                  Somente leitura de propósito: o nome é derivado do grupo mais os
                  valores de grade. Editável, ele voltaria a divergir da estrutura
                  — que é exatamente o problema que esta tela veio resolver.
                */}
                  <td className="px-4 py-2">
                    <span className="block max-w-[24rem] truncate text-xs font-medium text-foreground">
                      {nomeExibidoDaVariacao(productGroupName, variation.values)}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-center">
                    <VariationPriceField
                      compact
                      variation={variation}
                      updateVariationDraft={updateVariationDraft}
                      invalid={!!validationErrors[`price-${variation.key}`]}
                    />
                  </td>

                  <td className="px-4 py-2 text-center text-xs">
                    <VariationStock variation={variation} />
                  </td>

                  <td className="px-4 py-2 text-center">
                    <VariationStatusField
                      compact
                      variation={variation}
                      updateVariationDraft={updateVariationDraft}
                      options={selectableStatusOptions}
                      invalid={!!validationErrors[`status-${variation.key}`]}
                    />
                  </td>

                  <td className="px-4 py-2 text-right">
                    <VariationDeleteButton
                      variation={variation}
                      setVariationToDelete={setVariationToDelete}
                      handleDeleteVariation={handleDeleteVariation}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          O nome da variação é montado a partir do nome do produto e dos valores de grade.{" "}
          {emCartoes
            ? "O tipo das grades se troca no seletor acima dos cartões."
            : "O título de cada coluna troca o tipo da grade."}{" "}
          Para acrescentar valores ou uma grade nova, use <strong>Configurar Variações</strong>.
        </p>
        {/*
          Acrescentar uma linha avulsa evita regerar a matriz só para incluir uma
          combinação — regerar apaga preço e código digitados linha a linha.
        */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => addVariationDraft()}
        >
          Acrescentar variação
        </Button>
      </div>
    </div>
  );
}
