import { ReactNode, useEffect, type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
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
  SidebarMenuSubButton
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Building2,
  Package, 
  Folder, 
  Tags, 
  ShoppingCart, 
  Users, 
  UserCog, 
  LogOut,
  Loader2,
  ImageIcon,
  Truck,
  ChevronDown,
  ClipboardList,
  Settings,
  DollarSign,
  Store
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { getDisplayName } from "@/services/mappers";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { 
    name: "Produtos", 
    icon: Package,
    items: [
      { name: "Lista de Produtos", href: "/produtos" },
      { name: "Departamentos", href: "/departamentos" },
      { name: "Categorias", href: "/categorias" },
      { name: "Grades", href: "/grades" },
      { name: "Etiquetas", href: "/etiquetas" },
      { name: "Etiquetas de Gôndola", href: "/etiquetas-gondola" }
    ]
  },
  { 
    name: "Financeiro", 
    icon: DollarSign,
    items: [
      { name: "Vendas", href: "/vendas" },
      { name: "Caixas", href: "/financeiro/caixas" },
      { name: "Relatórios", href: "/financeiro/relatorios" },
      { name: "Fechamentos", href: "/financeiro/fechamentos" },
      { name: "Custos Fixos", href: "/financeiro/custos-fixos" },
      { name: "Sócios", href: "/financeiro/socios" },
      { name: "Formas de Pagamento", href: "/financeiro/formas-pagamento" }
    ]
  },
  { 
    name: "Estoque", 
    icon: ClipboardList,
    items: [
      { name: "Fornecedores", href: "/fornecedores" },
      { name: "Entradas", href: "/estoque/entradas" },
      { name: "Baixas", href: "/estoque/baixas" },
      { name: "Contagem", href: "/estoque/contagem" },
      { name: "Inventário", href: "/estoque/inventario" }
    ]
  },
  { name: "Mídia", href: "/imagens", icon: ImageIcon },
  { name: "Clientes", href: "/clientes", icon: Users },
  { 
    name: "Sistema", 
    icon: Settings,
    items: [
      { name: "Configurações", href: "/configuracoes" },
      { name: "Logs", href: "/sistema/logs" },
      { name: "Usuários", href: "/sistema/usuarios" }
    ]
  },
];

const roleLabels: Record<number, string> = {
  1: "Administrador",
  2: "Vendedor",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  const { mutate: logout, isPending: isLoggingOut } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        setLocation("/login");
      }
    }
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
  const roleLabel = roleLabels[user.role] ?? "Usuário";

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as CSSProperties}>
      <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <img 
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
                      const isSubActive = item.items.some(sub => location.startsWith(sub.href));
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
                                  const isActive = location === sub.href || (sub.href !== "/dashboard" && location.startsWith(sub.href));
                                  return (
                                    <SidebarMenuSubItem key={sub.name}>
                                      <SidebarMenuSubButton 
                                        asChild 
                                        isActive={isActive}
                                        className={`
                                          h-9 px-3 rounded-lg transition-all duration-150 w-full
                                          ${isActive 
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

                    const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className={`
                            h-11 px-4 mb-1 rounded-xl transition-all duration-200
                            ${isActive 
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
                <span className="text-xs text-muted-foreground mt-1">{roleLabel}</span>
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

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="hover-elevate mr-4" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
