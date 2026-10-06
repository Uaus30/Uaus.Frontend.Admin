import { ReactNode, useEffect, type CSSProperties } from "react";
import { Link, matchRoute, useLocation, useRouter } from "wouter";
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  Button,
  cn,
  useSidebar,
} from "@workspace/ui";
import { ChevronDown, ExternalLink, Loader2, LogOut, Store } from "lucide-react";
import { STALE_TIME, useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { getDisplayName } from "@/services/mappers";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { ROUTES, buildMenu } from "@/routes";
import { pdvHomeUrl } from "@/lib/pdv-links";
import { StockFreezeBanner } from "@/components/stock-freeze-banner";
import { formatUpdatedAt, formatVersion } from "@workspace/core";

/**
 * O menu vem de `src/routes.tsx`, a mesma fonte do <Switch> do App.
 *
 * Enquanto eram duas listas mantidas a mao em sincronia, elas divergiam: a tela
 * de formas de pagamento respondia em dois caminhos e so um aparecia aqui.
 */

/**
 * No celular o menu é uma gaveta por cima da tela, e escolher uma tela nele não
 * a fechava: a tela nova abria escondida atrás do menu, e era preciso achar o
 * fundo para tocar. Fecha a cada troca de endereço — e não no clique do item —
 * para valer também para os atalhos da Início, o voltar do navegador e os links
 * de dentro das telas. No computador a barra fixa não usa este estado.
 */
function CloseMobileMenuOnNavigate({ location }: { location: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [location, setOpenMobile]);
  return null;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const router = useRouter();
  const queryClient = useQueryClient();

  // O matcher do próprio wouter, como no App.tsx: um segundo escrito à mão é a
  // porta para rota e layout divergirem.
  const fullBleed = ROUTES.some(
    (route) => route.fullBleed && matchRoute(router.parser, route.matchPath ?? route.path, location)[0],
  );

  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
      staleTime: STALE_TIME.catalogo,
    },
  });

  const { mutate: logout, isPending: isLoggingOut } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/login");
      },
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = getDisplayName(user);
  const initials = displayName.charAt(0).toUpperCase();
  const navigation = buildMenu();

  // `null` quando não dá para saber onde o PDV está — aí o botão nem aparece,
  // em vez de abrir uma aba do próprio admin. Detalhe em `lib/pdv-links.ts`.
  const pdvUrl = pdvHomeUrl();

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    // O provider segue a altura do PAI (`h-full min-h-0`) em vez do `min-h-svh`
    // padrão, em TODA rota: a raiz do App já é `h-dvh` com as faixas do topo em
    // cima, e 100svh aqui estoura exatamente pela altura das faixas. Primeiro
    // apareceu no quadro de Tarefas (a barra horizontal fora da tela); em
    // 06/10/2026, no celular, cortava os 32px de baixo de toda tela em dev (e os
    // 40px com a faixa "sem conexão" em produção) — o rodapé fixo do detalhe de
    // produto ficava pela metade.
    <SidebarProvider style={style as CSSProperties} className="h-full min-h-0">
      <CloseMobileMenuOnNavigate location={location} />
      <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <img
                loading="lazy"
                decoding="async"
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt="Uaus"
                className="w-8 h-8 object-contain"
              />
              <div>
                <h1 className="text-sm font-display font-bold leading-tight">Painel Administrativo</h1>
                <p className="text-xs text-muted-foreground">uaus.com.br</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    if (item.items) {
                      const isSubActive = item.items.some((sub) => location.startsWith(sub.href));
                      return (
                        <Collapsible
                          key={item.name}
                          defaultOpen={isSubActive}
                          className="group/collapsible w-full"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={`
                                  h-11 px-4 mb-1 rounded-xl transition-all duration-200 w-full text-muted-foreground hover:bg-white/5 hover:text-foreground
                                `}
                              >
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span className="text-sm flex-1 text-left">{item.name}</span>
                                <ChevronDown className="w-4 h-4 ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub className="ml-4 border-l border-border/50 pl-2">
                                {item.items.map((sub) => {
                                  const isActive =
                                    location === sub.href ||
                                    (sub.href !== "/dashboard" && location.startsWith(sub.href));
                                  return (
                                    <SidebarMenuSubItem key={sub.name}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={isActive}
                                        className={`
                                          h-9 px-3 rounded-lg transition-all duration-150 w-full
                                          ${
                                            isActive
                                              ? "bg-primary/10 text-primary hover:bg-primary/15 font-medium"
                                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                          }
                                        `}
                                      >
                                        <Link href={sub.href}>
                                          <span className="text-sm">{sub.name}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    const isActive =
                      location === item.href ||
                      (item.href !== "/dashboard" && location.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={`
                            h-11 px-4 mb-1 rounded-xl transition-all duration-200
                            ${
                              isActive
                                ? "bg-primary/10 text-primary hover:bg-primary/15 font-medium"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground hover-elevate"
                            }
                          `}
                        >
                          <Link href={item.href} className="flex items-center gap-3">
                            <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                            <span className="text-sm">{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{displayName}</span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 h-10 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-colors font-medium hover-elevate disabled:opacity-50"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span>Sair do sistema</span>
            </button>
          </SidebarFooter>
        </Sidebar>

        {/* Em rota `fullBleed` a coluna tem altura DEFINIDA (a do pai): sem o
            teto a página cresceria com o conteúdo do quadro e a barra horizontal
            iria parar abaixo da tela. */}
        <div className={cn("flex flex-col flex-1 min-w-0", fullBleed && "h-full min-h-0 overflow-hidden")}>
          <header className="h-16 flex items-center px-3 sm:px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            {/* 40px no celular, onde é o único caminho para o menu; 28px no computador, como antes. */}
            <SidebarTrigger className="hover-elevate mr-3 h-10 w-10 md:mr-4 md:h-7 md:w-7" />
            <div className="flex flex-col justify-center select-none" data-testid="header-version">
              <span className="text-xs text-muted-foreground leading-tight">
                {formatVersion(import.meta.env.VITE_APP_VERSION)}
              </span>
              <span className="text-[11px] text-muted-foreground/80 leading-tight">
                {formatUpdatedAt(import.meta.env.VITE_BUILD_TIME)}
              </span>
            </div>
            <div className="flex-1" />
            {pdvUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/15"
              >
                <a href={pdvUrl} target="_blank" rel="noopener noreferrer">
                  <Store />
                  <span>PDV</span>
                  <ExternalLink className="opacity-60" />
                </a>
              </Button>
            )}
          </header>
          {/* Toda tela, logo abaixo do cabeçalho: a conferência aberta para a loja. */}
          <StockFreezeBanner />
          {fullBleed ? (
            // Sem padding, sem largura máxima e com altura definida: a página
            // preenche a área útil e cuida da própria rolagem (ver `AppRoute.fullBleed`).
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
          ) : (
            // `p-3` no celular: os 24px de cada lado somados ao respiro dos
            // cartões deixavam ~280px de conteúdo numa tela de 375.
            <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
              <div className="max-w-7xl mx-auto">{children}</div>
            </main>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
