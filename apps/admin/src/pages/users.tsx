import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { UserEditorModal } from "@/features/users/components/UserEditorModal";
import { UsersTable } from "@/features/users/components/UsersTable";
import { useUsers } from "@/features/users/hooks/useUsers";
import { Loader2, Plus } from "lucide-react";

/**
 * Página principal de Usuários Administrativos do Painel.
 * Segue a arquitetura AI-First, desacoplada e modularizada.
 */
export default function Users() {
  const {
    dialogOpen,
    setDialogOpen,
    editingId,
    deleteId,
    setDeleteId,
    form,
    setForm,
    data,
    isLoading,
    selectableRoleOptions,
    selectableStatusOptions,
    roleLabels,
    statusLabels,
    creating,
    updating,
    deleting,
    openCreate,
    openEdit,
    handleSubmitUser,
    handleDeleteUser,
    usernameFromEmail,
  } = useUsers();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Usuários</h1>
            <p className="mt-1 text-muted-foreground">Gerencie os acessos administrativos do sistema.</p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        </div>

        <UsersTable
          data={data}
          isLoading={isLoading}
          roleLabels={roleLabels}
          statusLabels={statusLabels}
          onEdit={openEdit}
          onDelete={setDeleteId}
        />
      </div>

      <UserEditorModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        selectableRoleOptions={selectableRoleOptions}
        selectableStatusOptions={selectableStatusOptions}
        isSaving={creating || updating}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitUser(form);
        }}
        usernameFromEmail={usernameFromEmail}
      />

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover este usuário? A exclusão é lógica no backend.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteId && handleDeleteUser(deleteId)}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
