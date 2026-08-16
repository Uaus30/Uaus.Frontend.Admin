import React from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Plus } from "lucide-react";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { DepartmentTable } from "@/features/departments/components/DepartmentTable";
import { DepartmentEditorModal } from "@/features/departments/components/DepartmentEditorModal";

/**
 * Departments Page Component
 *
 * Orchestrates the departments page by linking the useDepartments hook state manager
 * to pure presentation components.
 */
export default function Departments() {
  const model = useDepartments();

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Departamentos</h1>
            <p className="mt-1 text-muted-foreground">
              Organize a estrutura principal para agrupar categorias.
            </p>
          </div>
          <Button onClick={() => model.openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Novo Departamento
          </Button>
        </div>

        <DepartmentTable
          isLoading={model.isLoading}
          search={model.search}
          setSearch={model.setSearch}
          page={model.page}
          setPage={model.setPage}
          departmentsPage={model.departmentsPage}
          departmentsWithStats={model.departmentsWithStats}
          onOpenModal={model.openModal}
          onDelete={model.handleDelete}
        />
      </div>

      <DepartmentEditorModal
        isOpen={model.modalOpen}
        onOpenChange={model.setModalOpen}
        editingId={model.editingId}
        formData={model.formData}
        setFormData={model.setFormData}
        saving={model.saving}
        onSubmit={model.handleSubmit}
      />
    </AppLayout>
  );
}
