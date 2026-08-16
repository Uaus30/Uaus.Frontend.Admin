import React from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useTags } from "@/features/tags/hooks/useTags";
import { TagTable } from "@/features/tags/components/TagTable";
import { TagEditorModal } from "@/features/tags/components/TagEditorModal";
import { TagReportModal } from "@/features/tags/components/TagReportModal";

/**
 * Tags Page Component
 *
 * Renders the Tags admin layout, mounting the subcomponents and connecting
 * them to the useTags state manager hook.
 */
export default function Tags() {
  const {
    search,
    setSearch,
    sortBy,
    sortDir,
    page,
    setPage,
    limit,
    setLimit,
    modalOpen,
    setModalOpen,
    reportModalOpen,
    setReportModalOpen,
    setSelectedTagId,
    editingId,
    formData,
    setFormData,
    saving,
    tagPage,
    isLoading,
    tagsWithCount,
    selectedReport,
    isReportLoading,
    toggleSort,
    openModal,
    randomizeColor,
    handleSubmit,
    handleDelete,
  } = useTags();

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Etiquetas</h1>
            <p className="mt-1 text-muted-foreground">Classifique produtos para análises personalizadas.</p>
          </div>
          <Button onClick={() => openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Etiqueta
          </Button>
        </div>

        <TagTable
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          sortDir={sortDir}
          toggleSort={toggleSort}
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          tagsWithCount={tagsWithCount}
          tagPage={tagPage}
          isLoading={isLoading}
          onOpenModal={openModal}
          onOpenReport={(id) => {
            setSelectedTagId(id);
            setReportModalOpen(true);
          }}
          onDelete={handleDelete}
        />
      </div>

      <TagEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        randomizeColor={randomizeColor}
        onSubmit={handleSubmit}
      />

      <TagReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        selectedReport={selectedReport}
        isLoading={isReportLoading}
      />
    </AppLayout>
  );
}
