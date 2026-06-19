import React from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useGrades } from "@/features/grades/hooks/useGrades";
import { GradeTable } from "@/features/grades/components/GradeTable";
import { GradeEditorModal } from "@/features/grades/components/GradeEditorModal";

/**
 * Grades Page Component
 * 
 * Renders the Grades admin layout, connecting page-level headers
 * to the useGrades state manager hook and child presentation components.
 */
export default function Grades() {
  const {
    search,
    setSearch,
    selectableGradeTypeOptions,
    isLoading,
    filteredGrades,
    modalOpen,
    setModalOpen,
    activeTab,
    setActiveTab,
    editingId,
    editingGrade,
    gradeType,
    setGradeType,
    selectedCategoryIds,
    setSelectedCategoryIds,
    variants,
    saving,
    categorySearch,
    setCategorySearch,
    draggedIndex,
    ghostValue,
    setGhostValue,
    ghostColorHex,
    setGhostColorHex,
    openModal,
    removeVariantRow,
    updateVariant,
    commitGhostRow,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleSubmit,
    handleDelete,
    filteredCategories,
    hasCategories,
    hasOptions,
    isFormValid,
    getMissingTooltipText,
    departmentMap,
  } = useGrades();

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Grades e Dimensões</h1>
            <p className="mt-1 text-muted-foreground">
              Cadastre tamanhos, cores e outros atributos para geração de variações de produtos.
            </p>
          </div>
          <Button onClick={() => openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Grade
          </Button>
        </div>

        <GradeTable
          search={search}
          setSearch={setSearch}
          isLoading={isLoading}
          filteredGrades={filteredGrades}
          onOpenModal={openModal}
          onDelete={handleDelete}
        />
      </div>

      <GradeEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        editingId={editingId}
        editingGrade={editingGrade}
        gradeType={gradeType}
        setGradeType={setGradeType}
        selectableGradeTypeOptions={selectableGradeTypeOptions}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        categorySearch={categorySearch}
        setCategorySearch={setCategorySearch}
        filteredCategories={filteredCategories}
        departmentMap={departmentMap}
        variants={variants}
        draggedIndex={draggedIndex}
        ghostValue={ghostValue}
        setGhostValue={setGhostValue}
        ghostColorHex={ghostColorHex}
        setGhostColorHex={setGhostColorHex}
        saving={saving}
        isFormValid={isFormValid}
        hasCategories={hasCategories}
        hasOptions={hasOptions}
        getMissingTooltipText={getMissingTooltipText}
        updateVariant={updateVariant}
        removeVariantRow={removeVariantRow}
        commitGhostRow={commitGhostRow}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDragEnd={handleDragEnd}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
