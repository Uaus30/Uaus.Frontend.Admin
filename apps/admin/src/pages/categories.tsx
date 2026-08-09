import React from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Plus } from "lucide-react";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { CategoryTable } from "@/features/categories/components/CategoryTable";
import { CategoryEditorModal } from "@/features/categories/components/CategoryEditorModal";
import { CategoryReportModal } from "@/features/categories/components/CategoryReportModal";

/**
 * Categories Page Component
 * 
 * Orchestrates the categories administration page by linking the useCategories state manager
 * to pure presentation components.
 */
export default function Categories() {
  const model = useCategories();

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Categorias</h1>
            <p className="mt-1 text-muted-foreground">Organize seus produtos por departamento e categoria.</p>
          </div>
          <Button onClick={() => model.openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Categoria
          </Button>
        </div>

        <CategoryTable
          isLoading={model.isLoading}
          search={model.search}
          setSearch={model.setSearch}
          page={model.page}
          setPage={model.setPage}
          departmentFilter={model.departmentFilter}
          setDepartmentFilter={model.setDepartmentFilter}
          departments={model.departments}
          categoriesPage={model.categoriesPage}
          categoriesWithDepartment={model.categoriesWithDepartment}
          onOpenModal={model.openModal}
          onOpenReport={model.openReport}
          onDelete={model.handleDelete}
        />
      </div>

      <CategoryEditorModal
        isOpen={model.modalOpen}
        onOpenChange={model.setModalOpen}
        editingId={model.editingId}
        formData={model.formData}
        setFormData={model.setFormData}
        departments={model.departments}
        saving={model.saving}
        onSubmit={model.handleSubmit}
      />

      <CategoryReportModal
        isOpen={model.reportOpen}
        onOpenChange={model.setReportOpen}
        selectedReport={model.selectedReport}
        isLoading={model.isReportLoading}
      />
    </AppLayout>
  );
}


