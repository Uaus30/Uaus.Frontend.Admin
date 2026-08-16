import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  Building2,
  ClipboardList,
  DollarSign,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { enumCode, USER_ROLE, type EnumValue } from "@workspace/api-client-react";

/**
 * Fonte ÚNICA das rotas do admin.
 *
 * O `<Switch>` do App.tsx e o menu do layout são derivados daqui. Antes eram
 * duas listas mantidas à mão em sincronia, e o sintoma já existia: a página de
 * formas de pagamento respondia em dois caminhos (`/formas-pagamento` e
 * `/financeiro/formas-pagamento`) e só um deles aparecia no menu.
 *
 * Acrescentar uma tela passa a ser uma entrada aqui. Menu e rota não têm mais
 * como divergir.
 */

/** Papéis que podem abrir uma rota. */
export type RoleCode = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export interface AppRoute {
  path: string;
  /** Rótulo no menu. Ausente = rota sem entrada no menu (detalhe, redirect). */
  label?: string;
  /** Grupo do menu. Ausente = item de primeiro nível. */
  group?: string;
  icon?: LucideIcon;
  component: LazyExoticComponent<ComponentType<Record<string, never>>>;
  /**
   * Papéis autorizados. Ausente = qualquer usuário autenticado.
   *
   * A checagem no cliente é conveniência, não segurança: quem decide de verdade
   * é o backend. O que ela evita é o usuário navegar para uma tela que só vai
   * mostrar erro 403 — e, principalmente, ver no menu um caminho que não é dele.
   */
  roles?: RoleCode[];
  /** A rota existe, responde, mas não aparece no menu. */
  hidden?: boolean;
  /** A rota é pública — não exige sessão. */
  publica?: boolean;
}

const Login = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Products = lazy(() => import("@/pages/products"));
const Departments = lazy(() => import("@/pages/departments"));
const Categories = lazy(() => import("@/pages/categories"));
const Grades = lazy(() => import("@/pages/grades"));
const Tags = lazy(() => import("@/pages/tags"));
const GondolaLabels = lazy(() => import("@/pages/gondola-labels"));
const Sales = lazy(() => import("@/pages/sales"));
const CashRegisterSessions = lazy(() => import("@/pages/cash-register-sessions"));
const FinancialReports = lazy(() => import("@/pages/financial-reports"));
const FinancialClosings = lazy(() => import("@/pages/financial-closings"));
const FixedCosts = lazy(() => import("@/pages/fixed-costs"));
const Partners = lazy(() => import("@/pages/partners"));
const PaymentMethodsPage = lazy(() => import("@/pages/payment-methods"));
const Suppliers = lazy(() => import("@/pages/suppliers"));
const StockEntries = lazy(() => import("@/pages/stock-entries"));
const StockWriteOffs = lazy(() => import("@/pages/stock-write-offs"));
const InventoryCount = lazy(() => import("@/pages/inventory-count"));
const Inventory = lazy(() => import("@/pages/inventory"));
const Images = lazy(() => import("@/pages/images"));
const Customers = lazy(() => import("@/pages/customers"));
const CompanySettings = lazy(() => import("@/pages/settings"));
const Logs = lazy(() => import("@/pages/logs"));
const LogDetails = lazy(() => import("@/pages/log-details"));
const UsersPage = lazy(() => import("@/pages/users"));
const Coupons = lazy(() => import("@/pages/coupons"));
const Campaigns = lazy(() => import("@/pages/campaigns"));
const CampaignReport = lazy(() => import("@/pages/campaign-report"));
const CampaignComparison = lazy(() => import("@/pages/campaign-comparison"));

/** Ícone e ordem de cada grupo do menu. */
export const MENU_GROUPS = [
  { name: "Produtos", icon: Package },
  { name: "Financeiro", icon: DollarSign },
  // Cupom e campanha não cabem em "Financeiro" (não são lançamento de dinheiro)
  // nem em "Produtos" (não são cadastro de item): grupo próprio.
  { name: "Marketing", icon: Megaphone },
  { name: "Estoque", icon: ClipboardList },
  { name: "Sistema", icon: Settings },
] as const;

/**
 * Só Admin. O dinheiro da sociedade, o cadastro de usuários e a auditoria não
 * são assunto de operador de caixa — e o backend recusa esses endpoints para
 * Seller de qualquer forma, então sem isto a tela abriria só para mostrar erro.
 */
const SO_ADMIN: RoleCode[] = [USER_ROLE.Admin];

export const ROUTES: AppRoute[] = [
  { path: "/login", component: Login, publica: true, hidden: true },

  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, component: Dashboard },

  { path: "/produtos", label: "Lista de Produtos", group: "Produtos", component: Products },
  { path: "/departamentos", label: "Departamentos", group: "Produtos", component: Departments },
  { path: "/categorias", label: "Categorias", group: "Produtos", component: Categories },
  { path: "/grades", label: "Grades", group: "Produtos", component: Grades },
  { path: "/etiquetas", label: "Etiquetas", group: "Produtos", component: Tags },
  { path: "/etiquetas-gondola", label: "Etiquetas de Gôndola", group: "Produtos", component: GondolaLabels },

  { path: "/vendas", label: "Vendas", group: "Financeiro", component: Sales },
  { path: "/financeiro/caixas", label: "Caixas", group: "Financeiro", component: CashRegisterSessions },
  {
    path: "/financeiro/relatorios",
    label: "Relatórios",
    group: "Financeiro",
    component: FinancialReports,
    roles: SO_ADMIN,
  },
  {
    path: "/financeiro/fechamentos",
    label: "Fechamentos",
    group: "Financeiro",
    component: FinancialClosings,
    roles: SO_ADMIN,
  },
  {
    path: "/financeiro/custos-fixos",
    label: "Custos Fixos",
    group: "Financeiro",
    component: FixedCosts,
    roles: SO_ADMIN,
  },
  { path: "/financeiro/socios", label: "Sócios", group: "Financeiro", component: Partners, roles: SO_ADMIN },
  {
    path: "/financeiro/formas-pagamento",
    label: "Formas de Pagamento",
    group: "Financeiro",
    component: PaymentMethodsPage,
  },
  // Caminho antigo, mantido para não quebrar link salvo. Fora do menu: a mesma
  // tela em dois lugares confundiria mais do que ajuda.
  { path: "/formas-pagamento", component: PaymentMethodsPage, hidden: true },

  { path: "/marketing/cupons", label: "Cupons", group: "Marketing", component: Coupons, roles: SO_ADMIN },
  {
    path: "/marketing/campanhas",
    label: "Campanhas",
    group: "Marketing",
    component: Campaigns,
    roles: SO_ADMIN,
  },
  // O comparativo vem ANTES do relatório de propósito: não há colisão (dois
  // segmentos contra três), mas manter o caminho literal na frente do
  // parametrizado é o hábito que impede a próxima rota de `/campanhas/algo` ser
  // engolida por `:id`.
  {
    path: "/marketing/campanhas/comparativo",
    label: "Comparativo de Campanhas",
    group: "Marketing",
    component: CampaignComparison,
    roles: SO_ADMIN,
  },
  // Detalhe: chega pela lista, não pelo menu. Repete `roles` porque proteger a
  // listagem e esquecer o detalhe é exatamente a porta dos fundos que o teste
  // de rotas cobre no log.
  { path: "/marketing/campanhas/:id/relatorio", component: CampaignReport, roles: SO_ADMIN, hidden: true },

  { path: "/fornecedores", label: "Fornecedores", group: "Estoque", component: Suppliers },
  { path: "/estoque/entradas", label: "Entradas", group: "Estoque", component: StockEntries },
  { path: "/estoque/baixas", label: "Baixas", group: "Estoque", component: StockWriteOffs },
  { path: "/estoque/contagem", label: "Contagem", group: "Estoque", component: InventoryCount },
  { path: "/estoque/inventario", label: "Inventário", group: "Estoque", component: Inventory },

  { path: "/imagens", label: "Mídia", icon: ImageIcon, component: Images },
  { path: "/clientes", label: "Clientes", icon: Users, component: Customers },

  {
    path: "/configuracoes",
    label: "Configurações",
    group: "Sistema",
    component: CompanySettings,
    roles: SO_ADMIN,
  },
  { path: "/sistema/logs", label: "Logs", group: "Sistema", component: Logs, roles: SO_ADMIN },
  { path: "/sistema/logs/:id", component: LogDetails, roles: SO_ADMIN, hidden: true },
  { path: "/sistema/usuarios", label: "Usuários", group: "Sistema", component: UsersPage, roles: SO_ADMIN },
];

export const NOT_FOUND_COMPONENT = NotFound;

/** Rótulo de cada papel, derivado do enum em vez de hardcoded na tela. */
export const ROLE_LABELS: Record<RoleCode, string> = {
  [USER_ROLE.None]: "Sem acesso",
  [USER_ROLE.Admin]: "Administrador",
  [USER_ROLE.Seller]: "Vendedor",
};

/**
 * Normaliza o papel que veio da API para o código numérico.
 *
 * **É o conserto de um defeito que escondia meia retaguarda.** O backend registra
 * `JsonStringEnumConverter`, então `GET /Users/me` devolve `role: "Admin"` — a
 * STRING do nome do membro em C#, não o número. O `UserDto` do api-client
 * declarava `role: number`, e a comparação `[1].includes("Admin")` dava `false`
 * para todo mundo: as rotas com `roles` sumiam do menu e o `RequireRole`
 * redirecionava até o próprio administrador. Usuários, logs, configurações,
 * relatórios, sócios, custos fixos e fechamentos ficaram inalcançáveis, sem
 * erro em lugar nenhum — o menu simplesmente não tinha o item.
 *
 * A conversão mora AQUI, na fronteira, e não em cada chamador: `podeAcessar` e
 * `buildMenu` são os dois únicos pontos que decidem acesso, e um terceiro
 * chamador que esquecesse de normalizar reabriria o buraco em silêncio.
 *
 * `enumCode` aceita os dois formatos de propósito — o contrato do backend pode
 * mudar de novo, e uma tela que só entende um dos dois é uma tela que quebra na
 * próxima configuração de serialização.
 */
function codigoDoPapel(role: EnumValue): number | undefined {
  if (role === null || role === undefined || role === "") return undefined;
  return enumCode(role, USER_ROLE);
}

/** O papel pode abrir esta rota? Rota sem `roles` é livre para quem tem sessão. */
export function podeAcessar(route: AppRoute, role: EnumValue): boolean {
  if (!route.roles) return true;

  const codigo = codigoDoPapel(role);
  return codigo !== undefined && route.roles.includes(codigo as RoleCode);
}

/** Item de primeiro nível do menu — leva direto a uma tela. */
export interface MenuLink {
  name: string;
  href: string;
  icon: LucideIcon;
  items?: undefined;
}

/** Item de menu que abre um submenu. */
export interface MenuGroup {
  name: string;
  icon: LucideIcon;
  items: Array<{ name: string; href: string }>;
}

/**
 * O menu, na ordem em que a sidebar o desenha.
 *
 * `items?: undefined` no `MenuLink` é o que deixa o TypeScript estreitar a união
 * por `if (item.items)` — sem essa marca, ele não consegue distinguir os dois
 * casos e a sidebar precisaria de cast.
 */
export type MenuEntry = MenuLink | MenuGroup;

/**
 * Menu montado a partir das rotas visíveis que o papel pode abrir.
 *
 * Um grupo cujos itens sejam todos restritos some inteiro — mostrar "Sistema"
 * vazio para um Vendedor seria pior que não mostrar.
 */
export function buildMenu(role: EnumValue): MenuEntry[] {
  const visiveis = ROUTES.filter((r) => r.label && !r.hidden && !r.publica && podeAcessar(r, role));
  const soltas = visiveis.filter((r) => !r.group);

  const paraLink = (r: AppRoute): MenuLink => ({
    name: r.label!,
    href: r.path,
    icon: r.icon ?? Building2,
  });

  const grupos: MenuGroup[] = MENU_GROUPS.map((grupo) => ({
    name: grupo.name,
    icon: grupo.icon,
    items: visiveis.filter((r) => r.group === grupo.name).map((r) => ({ name: r.label!, href: r.path })),
  })).filter((g) => g.items.length > 0);

  // Dashboard primeiro, depois os grupos, e as soltas restantes ao fim — a
  // ordem que o menu já tinha.
  return [
    ...soltas.filter((r) => r.path === "/dashboard").map(paraLink),
    ...grupos,
    ...soltas.filter((r) => r.path !== "/dashboard").map(paraLink),
  ];
}
