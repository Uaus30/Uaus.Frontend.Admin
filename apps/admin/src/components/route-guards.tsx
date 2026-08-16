import { type ReactNode } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { Spinner } from "@workspace/ui";
import { podeAcessar, type AppRoute } from "@/routes";
import { useSessao } from "@/hooks/use-sessao";
import { urlLoginCom } from "@/lib/destino-login";

/**
 * Proteção das rotas do admin.
 *
 * Antes disso a proteção dependia de cada página lembrar de renderizar
 * `<AppLayout>`, cuja checagem de sessão ficava lá dentro: uma página que
 * esquecesse o layout abria para qualquer um. E papel nenhum era verificado —
 * `USER_ROLE` existia no api-client sem um único uso no admin, então um Vendedor
 * autenticado navegava para `/sistema/usuarios` e `/financeiro/socios`.
 *
 * A checagem daqui é CONVENIÊNCIA, não segurança: quem decide é o backend, que
 * recusa esses endpoints para Seller. O que ela evita é o usuário abrir uma tela
 * que só vai mostrar 403, e ver no menu um caminho que não é dele.
 */

function TelaCarregando() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner />
    </div>
  );
}

/**
 * Caminho pedido, com query string, para o login saber onde devolver a pessoa.
 *
 * Sai do `useLocation`/`useSearch` do wouter, não de `window.location`: o router
 * roda com `base` (ver `App.tsx`), e o pathname do navegador traria o prefixo da
 * base — que a volta somaria de novo, gerando `/admin/admin/produtos`.
 *
 * O `useSearch` do wouter 3 devolve a query SEM o `?`, então ele é recolocado
 * aqui.
 */
function useCaminhoAtual(): string {
  const [path] = useLocation();
  const search = useSearch();
  return search ? `${path}?${search}` : path;
}

/**
 * Exige sessão para renderizar o conteúdo.
 *
 * Enquanto a sessão carrega mostra o spinner, e NÃO redireciona: sem essa espera
 * um recarregamento de página jogaria o usuário logado no login por um instante.
 *
 * O caminho pedido vai junto para o login. Sem isso, quem abre link direto —
 * `/produtos?editar=10`, vindo do PDV — perdia o destino ao autenticar.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useSessao();
  const caminho = useCaminhoAtual();

  if (isLoading) return <TelaCarregando />;
  if (!user) return <Redirect to={urlLoginCom(caminho)} />;

  return <>{children}</>;
}

/**
 * Exige que o papel do usuário conste na rota.
 *
 * Redireciona para o dashboard em vez de mostrar "acesso negado": a tela de erro
 * não daria ao usuário nada a fazer, e o dashboard é onde todo papel tem acesso.
 */
export function RequireRole({ route, children }: { route: AppRoute; children: ReactNode }) {
  const { data: user, isLoading } = useSessao();
  const caminho = useCaminhoAtual();

  if (isLoading) return <TelaCarregando />;
  if (!user) return <Redirect to={urlLoginCom(caminho)} />;
  if (!podeAcessar(route, user.role)) return <Redirect to="/dashboard" />;

  return <>{children}</>;
}
