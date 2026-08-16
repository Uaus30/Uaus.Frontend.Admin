import React from "react";
import { Edit2, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import type { Grade, GradeVariant } from "../types";

type GradeTableProps = {
  /** Search text string */
  search: string;
  /** Callback triggered when search text changes */
  setSearch: (val: string) => void;
  /** True if list is loading from API */
  isLoading: boolean;
  /** List of grades filtered by search string */
  filteredGrades: Grade[];
  /** Callback to open editor modal in edit mode */
  onOpenModal: (grade: Grade) => void;
  /** Callback to delete grade by ID */
  onDelete: (id: number) => void;
};

/**
 * GradeTable
 *
 * Component that lists all product grades/dimensions in a table with search filtering.
 */
export function GradeTable({
  search,
  setSearch,
  isLoading,
  filteredGrades,
  onOpenModal,
  onDelete,
}: GradeTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="flex gap-3 border-b border-border/50 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da grade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Nome da Grade</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Opções (Variantes)</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : filteredGrades.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-muted-foreground">
                  Nenhuma grade encontrada.
                </td>
              </tr>
            ) : (
              filteredGrades.map((grade: Grade) => (
                <tr key={grade.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-bold text-foreground">{grade.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{grade.type}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {[...grade.variants]
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((v: GradeVariant) => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
                          >
                            {grade.type === "Cor" && v.colorHex && v.colorHex !== "#000000" && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/20"
                                style={{ backgroundColor: v.colorHex }}
                              />
                            )}
                            {v.value}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => onOpenModal(grade)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(grade.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
