import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { SENHA_TAMANHO_MINIMO, useChangePassword, useLogout } from "@workspace/api-client-react";
import { Button, Input, Label, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { KeyRound, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Troca obrigatória de senha no primeiro acesso ao caixa.
 *
 * Aparece no lugar do PDV inteiro, antes de qualquer venda: quem está Pendente
 * entrou com a senha padrão do sistema, que é a mesma para todo cadastro novo e
 * está no appsettings. Uma venda registrada nesse estado ficaria atribuída a um
 * operador que qualquer pessoa poderia ter sido.
 *
 * O visual acompanha o login (mesmo painel de vidro) porque é a continuação
 * imediata dele — o operador acabou de digitar as credenciais.
 */
export function TrocaSenhaPrimeiroAcesso({ operatorName }: { operatorName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  const { mutate: trocarSenha, isPending } = useChangePassword({
    mutation: {
      onSuccess: () => toast({ title: "Senha criada. Bom turno!" }),
      onError: (error) =>
        toast({
          title: "Não foi possível trocar a senha",
          description: describeApiError(error),
          variant: "destructive",
        }),
    },
  });

  const { mutate: sair } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    },
  });

  const submeter = () => {
    if (nova.length < SENHA_TAMANHO_MINIMO) {
      toast({
        title: `A nova senha precisa de ao menos ${SENHA_TAMANHO_MINIMO} caracteres.`,
        variant: "destructive",
      });
      return;
    }

    // Conferida aqui porque o servidor recebe uma senha só: um erro de digitação
    // trancaria o caixa com uma senha que ninguém sabe qual é, no meio do turno.
    if (nova !== confirmacao) {
      toast({ title: "A confirmação não confere com a nova senha.", variant: "destructive" });
      return;
    }

    trocarSenha({ data: { currentPassword: atual, newPassword: nova } });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submeter();
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent md:w-1/2 w-full" />
      </div>

      <div className="w-full max-w-md m-auto px-6 md:px-12 relative z-10 md:ml-[10%]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-panel p-8 md:p-12 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold leading-tight">Primeiro acesso</h1>
              <p className="text-xs text-muted-foreground">{operatorName}</p>
            </div>
          </div>

          <h2 className="text-3xl font-display font-bold mb-2">Crie sua senha</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Você entrou com a senha padrão da loja, que é a mesma para todo cadastro novo. Escolha uma senha
            sua para liberar o caixa.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                placeholder="A senha que você recebeu"
                className="h-12 bg-background/50 border-white/10 focus-visible:ring-primary/50"
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
                onChange={(e) => setNova(e.target.value)}
                placeholder={`Mínimo de ${SENHA_TAMANHO_MINIMO} caracteres`}
                className="h-12 bg-background/50 border-white/10 focus-visible:ring-primary/50"
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
                onChange={(e) => setConfirmacao(e.target.value)}
                onKeyDown={(e) => {
                  // Mesmo atalho do login: o operador termina de digitar e aperta
                  // Enter sem tirar a mão do teclado.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submeter();
                  }
                }}
                className="h-12 bg-background/50 border-white/10 focus-visible:ring-primary/50"
                autoComplete="new-password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 hover-elevate mt-4"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar e abrir o caixa"}
            </Button>
          </form>

          <Button variant="ghost" className="mt-3 w-full text-muted-foreground" onClick={() => sair()}>
            Sair
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
