import { type ReactNode } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { Spinner } from "@workspace/ui";
import { precisaTrocarSenha } from "@workspace/api-client-react";
import { useSessao } from "@/hooks/use-sessao";
import { getDisplayName } from "@/services/mappers";
import { TrocaSenhaObrigatoria } from "@/features/users/components/TrocaSenhaObrigatoria";
import { urlLoginCom } from "@/lib/destino-login";

/**
 * Proteção das rotas do admin.
 *
 * Antes disso a proteção dependia de cada página lembrar de renderizar
 * `<AppLayout>`, cuja checagem de sessão ficava lá dentro: uma página que
 * esquecesse o layout abria para qualquer um.
 *
 * Só a SESSÃO é conferida: não existe perfil de usuário (decisão do dono,
 * 03/10/2026), então quem entrou abre todas as telas. A checagem daqui é
 * CONVENIÊNCIA, não segurança — quem decide é o backend, que responde 401 sem
 * token válido.
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

  // Primeiro acesso: quem está Pendente entrou com a senha padrão do sistema, que
  // é a mesma para todo cadastro novo. A troca vem antes de qualquer tela, e no
  // gate em vez de numa rota — rota daria para pular pela URL.
  if (precisaTrocarSenha(user.status)) return <TrocaSenhaObrigatoria nome={getDisplayName(user)} />;

  return <>{children}</>;
}
