import { Link } from "wouter";
import { buttonVariants, NotFoundScreen } from "@workspace/ui";

/**
 * 404 do admin.
 *
 * A tela em si vem do `@workspace/ui` — o que muda por app é só a ação de
 * retorno, porque o destino de "voltar" é diferente em cada um. Aqui é o
 * dashboard, que é para onde a raiz `/` também redireciona.
 *
 * A rota coringa fica FORA do `AuthGate` (ver `App.tsx`): quem digitou um
 * endereço errado sem sessão precisa ver que o endereço não existe, não um
 * login que não vai levar a lugar nenhum.
 */
export default function NotFound() {
  return (
    <NotFoundScreen
      className="min-h-screen bg-background"
      description="O endereço que você abriu não existe no painel administrativo."
      action={
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Ir para o Dashboard
        </Link>
      }
    />
  );
}
