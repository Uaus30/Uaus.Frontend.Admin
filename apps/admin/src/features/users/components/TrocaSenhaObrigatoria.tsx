import { useState } from "react";
import { SENHA_TAMANHO_MINIMO, useChangePassword, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { KeyRound, Loader2 } from "lucide-react";

/**
 * Tela de troca obrigatória de senha, mostrada no primeiro acesso.
 *
 * Ela substitui o conteúdo inteiro da retaguarda, e não é uma rota: rota daria
 * para sair pela URL, e quem está Pendente ainda entra com a senha padrão do
 * sistema — a mesma para todos os cadastros. Enquanto não trocar, não há
 * retaguarda para ele.
 *
 * Quem decide se esta tela aparece é `precisaTrocarSenha`, do api-client, para
 * que admin e PDV respondam igual.
 */
export function TrocaSenhaObrigatoria({ nome }: { nome: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  const { mutate: trocarSenha, isPending } = useChangePassword({
    mutation: {
      onSuccess: () => toast({ title: "Senha alterada. Bem-vindo!" }),
      onError: (error) =>
        toast({
          title: "Não foi possível trocar a senha",
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  const { mutate: sair } = useLogout({
    mutation: { onSuccess: () => queryClient.clear() },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (nova.length < SENHA_TAMANHO_MINIMO) {
      toast({
        title: `A nova senha precisa de ao menos ${SENHA_TAMANHO_MINIMO} caracteres.`,
        variant: "destructive",
      });
      return;
    }

    // Conferida aqui porque o servidor não tem como: ele recebe uma senha só, e
    // um erro de digitação viraria uma conta trancada com uma senha que ninguém
    // sabe qual é.
    if (nova !== confirmacao) {
      toast({ title: "A confirmação não confere com a nova senha.", variant: "destructive" });
      return;
    }

    trocarSenha({ data: { currentPassword: atual, newPassword: nova } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold leading-tight">Crie sua senha</h1>
            <p className="text-xs text-muted-foreground">{nome}</p>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Você entrou com a senha padrão do sistema, que é a mesma para todo cadastro novo. Escolha uma senha
          sua para liberar o acesso — sua conta fica ativa na hora.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input
              id="senha-atual"
              type="password"
              value={atual}
              onChange={(event) => setAtual(event.target.value)}
              placeholder="A senha que você recebeu"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-nova">Nova senha</Label>
            <Input
              id="senha-nova"
              type="password"
              value={nova}
              onChange={(event) => setNova(event.target.value)}
              placeholder={`Mínimo de ${SENHA_TAMANHO_MINIMO} caracteres`}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-confirmacao">Repita a nova senha</Label>
            <Input
              id="senha-confirmacao"
              type="password"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e entrar"}
          </Button>
        </form>

        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => sair()}>
          Sair
        </Button>
      </div>
    </div>
  );
}
