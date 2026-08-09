import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Propriedades do componente LoginForm.
 */
interface LoginFormProps {
  /** Identificador de login (usuário ou e-mail). */
  identifier: string;
  /** Callback executado ao alterar o identificador. */
  onIdentifierChange: (value: string) => void;
  /** Senha digitada. */
  password:  string;
  /** Callback executado ao alterar a senha. */
  onPasswordChange: (value: string) => void;
  /** Indica se a mutação de login está em andamento (loading). */
  isPending: boolean;
  /** Callback para submissão do formulário de login. */
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Componente que renderiza a caixa de login (glass-panel) com formulário e animações de entrada.
 */
export function LoginForm({
  identifier,
  onIdentifierChange,
  password,
  onPasswordChange,
  isPending,
  onSubmit,
}: LoginFormProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel p-8 md:p-12 rounded-3xl"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center">
          <img 
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`} 
            alt="Uaus" 
            className="w-12 h-12 object-contain"
          />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold leading-tight">Painel Administrativo</h1>
          <p className="text-xs text-muted-foreground">uaus.com.br</p>
        </div>
      </div>

      <h2 className="text-3xl font-display font-bold mb-2">Bem-vindo de volta</h2>
      <p className="text-muted-foreground mb-8 text-sm">
        Insira suas credenciais para acessar o painel.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email ou usuário</Label>
          <Input 
            id="identifier" 
            type="text"
            value={identifier}
            onChange={(e) => onIdentifierChange(e.target.value)}
            placeholder="admin ou admin@uaus.com.br" 
            className="h-12 bg-background/50 border-white/10 focus-visible:ring-primary/50"
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input 
            id="password" 
            type="password" 
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••" 
            className="h-12 bg-background/50 border-white/10 focus-visible:ring-primary/50"
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end">
            <a href="#" tabIndex={-1} className="text-xs text-primary hover:text-primary/80 transition-colors">Esqueceu a senha?</a>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 hover-elevate mt-4"
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <span className="flex items-center gap-2">
              Entrar no sistema <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Uaus — uaus.com.br
      </p>
    </motion.div>
  );
}


