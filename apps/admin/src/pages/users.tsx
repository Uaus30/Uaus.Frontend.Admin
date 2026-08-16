import { AppLayout } from "@/components/layout";
import { Button, ConfirmDialog } from "@workspace/ui";
import { FirstAccessDialog } from "@/features/users/components/FirstAccessDialog";
import { UserEditorModal } from "@/features/users/components/UserEditorModal";
import { UsersTable } from "@/features/users/components/UsersTable";
import { useUsers } from "@/features/users/hooks/useUsers";
import { getDisplayName } from "@/services/mappers";
import { Plus } from "lucide-react";

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
    resetTarget,
    setResetTarget,
    firstAccess,
    setFirstAccess,
    form,
    setForm,
    data,
    isLoading,
    selectableRoleOptions,
    editableStatusOptions,
    pendentePrimeiroAcesso,
    roleLabels,
    statusLabels,
    creating,
    updating,
    deleting,
    resetting,
    openCreate,
    openEdit,
    handleSubmitUser,
    handleDeleteUser,
    handleResetPassword,
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
          onResetPassword={setResetTarget}
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
        editableStatusOptions={editableStatusOptions}
        pendentePrimeiroAcesso={pendentePrimeiroAcesso}
        isSaving={creating || updating}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitUser(form);
        }}
        usernameFromEmail={usernameFromEmail}
      />

      <FirstAccessDialog info={firstAccess} onClose={() => setFirstAccess(null)} />

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title="Resetar a senha deste usuário?"
        itemName={resetTarget ? getDisplayName(resetTarget) : undefined}
        description="A senha volta a ser a padrão do sistema e o usuário fica Pendente até trocá-la. A senha atual dele para de funcionar na hora — inclusive num caixa aberto."
        confirmLabel="Resetar senha"
        loading={resetting}
        onConfirm={() => {
          if (resetTarget) handleResetPassword(resetTarget.id);
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remover este usuário?"
        description="A exclusão é lógica no backend: o usuário perde o acesso e some da lista, mas as vendas e baixas que ele registrou continuam apontando para ele."
        confirmLabel="Remover"
        destructive
        loading={deleting}
        onConfirm={() => {
          if (deleteId) handleDeleteUser(deleteId);
        }}
      />
    </AppLayout>
  );
}
