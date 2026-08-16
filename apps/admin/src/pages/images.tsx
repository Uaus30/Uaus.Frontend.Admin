import React from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useImages } from "@/features/images/hooks/useImages";
import { ImageCatalog } from "@/features/images/components/ImageCatalog";
import { ImageUploadModal } from "@/features/images/components/ImageUploadModal";
import { ImageRenameModal } from "@/features/images/components/ImageRenameModal";

/**
 * Images Page Component
 *
 * Renders the Images admin panel, mounting child uploader, renamer,
 * and grid listing components, and linking them to useImages.
 */
export default function Images() {
  const {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    page,
    setPage,
    limit,
    setLimit,
    uploadOpen,
    setUploadOpen,
    formName,
    setFormName,
    formType,
    setFormType,
    file,
    preview,
    uploading,
    copiedId,
    renameOpen,
    setRenameOpen,
    renameImage,
    renameName,
    setRenameName,
    renaming,
    imageTypes,
    selectableTypes,
    imagePage,
    isLoading,
    filteredImages,
    resetUploadForm,
    handleFileChange,
    handleUpload,
    handleRenameOpen,
    handleRename,
    handleDelete,
    copyUrl,
  } = useImages();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Imagens</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie imagens e obtenha URLs públicas para uso no sistema.
            </p>
          </div>
          <Button
            onClick={() => {
              resetUploadForm();
              setUploadOpen(true);
            }}
            className="bg-primary text-primary-foreground hover-elevate"
          >
            <Plus className="mr-2 h-4 w-4" /> Nova Imagem
          </Button>
        </div>

        <ImageCatalog
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          selectableTypes={selectableTypes}
          imageTypes={imageTypes}
          isLoading={isLoading}
          filteredImages={filteredImages}
          copiedId={copiedId}
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          imagePage={imagePage}
          copyUrl={copyUrl}
          onRenameOpen={handleRenameOpen}
          onDelete={handleDelete}
        />
      </div>

      <ImageUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        preview={preview}
        formName={formName}
        setFormName={setFormName}
        formType={formType}
        setFormType={setFormType}
        selectableTypes={selectableTypes}
        file={file}
        uploading={uploading}
        onFileChange={handleFileChange}
        onUpload={handleUpload}
      />

      <ImageRenameModal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        renameImage={renameImage}
        renameName={renameName}
        setRenameName={setRenameName}
        renaming={renaming}
        onRename={handleRename}
      />
    </AppLayout>
  );
}
