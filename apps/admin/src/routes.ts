import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  BarChart3,
  Building2,
  DollarSign,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  UserCog,
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

/**
 * Ícone de cada grupo do menu. A ORDEM de exibição não sai daqui — ver `MENU_ORDER`.
 */
export const MENU_GROUPS = [
  // "Estoque" e não "Produtos": o grupo junta o cadastro do item e a entrada
  // de mercadoria, que é o par que o operador percorre num dia de loja.
  { name: "Estoque", icon: Package },
  { name: "Financeiro", icon: DollarSign },
  // Consulta, não lançamento: o que só LÊ a operação mora aqui. Hoje é o
  // Inventário; relatório novo entra neste grupo, não espalhado nos outros.
  { name: "Relatórios", icon: BarChart3 },
  // Cupom e campanha não cabem em "Financeiro" (não são lançamento de dinheiro)
  // nem em "Estoque" (não são cadastro nem entrada de item): grupo próprio.
  { name: "Marketing", icon: Megaphone },
  { name: "Sistema", icon: Settings },
] as const;

/**
 * Ordem da barra lateral, de cima para baixo.
 *
 * Cada entrada é o nome de um grupo de `MENU_GROUPS` ou o `path` de uma rota de
 * primeiro nível — as duas coisas na MESMA lista porque elas se intercalam:
 * "Sistema" é grupo e fica embaixo de "Usuários" e "Clientes", que são soltas.
 *
 * Antes a ordem era implícita no `buildMenu` — Dashboard, todos os grupos, e as
 * soltas ao fim. Com aquela regra não havia como pôr um grupo depois de uma
 * solta sem reescrever a função, e a ordem real do menu não estava escrita em
 * lugar nenhum: era preciso simular a montagem de cabeça para saber.
 *
 * O que NÃO está aqui não some: `buildMenu` acrescenta ao fim o que sobrar. Uma
 * tela nova aparece no menu mesmo que alguém esqueça desta lista — só não
 * aparece no lugar escolhido.
 */
export const MENU_ORDER: readonly string[] = [
  "/dashboard",
  "Estoque",
  "Financeiro",
  "Relatórios",
  "Marketing",
  "/imagens",
  "/clientes",
  "/sistema/usuarios",
  // Último de propósito: configuração e auditoria são o que menos se abre num
  // dia de loja.
  "Sistema",
];

/**
 * Só Admin. O dinheiro da sociedade, o cadastro de usuários e a auditoria não
 * são assunto de operador de caixa — e o backend recusa esses endpoints para
 * Seller de qualquer forma, então sem isto a tela abriria só para mostrar erro.
 */
const SO_ADMIN: RoleCode[] = [USER_ROLE.Admin];

export const ROUTES: AppRoute[] = [
  { path: "/login", component: Login, publica: true, hidden: true },

  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, component: Dashboard },

  { path: "/produtos", label: "Produtos", group: "Estoque", component: Products },
  { path: "/estoque/entradas", label: "Entradas", group: "Estoque", component: StockEntries },
  { path: "/grades", label: "Grades", group: "Estoque", component: Grades },
  { path: "/categorias", label: "Categorias", group: "Estoque", component: Categories },
  { path: "/departamentos", label: "Departamentos", group: "Estoque", component: Departments },
  { path: "/fornecedores", label: "Fornecedores", group: "Estoque", component: Suppliers },
  { path: "/tags", label: "Tags", group: "Estoque", component: Tags },
  // Caminho antigo mantido para não quebrar links salvos.
  { path: "/etiquetas", component: Tags, hidden: true },
  { path: "/etiquetas-gondola", label: "Etiquetas", group: "Estoque", component: GondolaLabels },

  // Dentro do grupo, o menu segue a ordem DESTA lista. Em "Financeiro" ela é
  // escolhida: o Resumo Financeiro abre o grupo e Baixas vem logo após Vendas.
  {
    path: "/financeiro/relatorios",
    label: "Resumo Financeiro",
    group: "Financeiro",
    component: FinancialReports,
    roles: SO_ADMIN,
  },
  { path: "/vendas", label: "Vendas", group: "Financeiro", component: Sales },
  { path: "/estoque/baixas", label: "Baixas", group: "Financeiro", component: StockWriteOffs },
  // Caminho mantido, oculto temporariamente do menu a pedido.
  { path: "/financeiro/caixas", component: CashRegisterSessions, hidden: true },
  {
    path: "/financeiro/fechamentos",
    label: "Fechamentos Mensais",
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

  { path: "/estoque/inventario", label: "Inventário", group: "Relatórios", component: Inventory },

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

  // Fora do grupo "Sistema": gerenciar quem entra na loja é rotina de dono, não
  // configuração de sistema, e ficava escondido atrás de um submenu que também
  // guarda logs. O caminho continua `/sistema/usuarios` — mudar a URL quebraria
  // link salvo sem devolver nada.
  {
    path: "/sistema/usuarios",
    label: "Usuários",
    icon: UserCog,
    component: UsersPage,
    roles: SO_ADMIN,
  },
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
 * Menu montado a partir das rotas visíveis que o papel pode abrir, na ordem de
 * `MENU_ORDER`.
 *
 * Um grupo cujos itens sejam todos restritos some inteiro — mostrar "Sistema"
 * vazio para um Vendedor seria pior que não mostrar.
 *
 * O que `MENU_ORDER` não menciona entra ao fim, na ordem em que aparece nas
 * `ROUTES`. Isso é deliberado: uma tela nova esquecida na lista de ordenação
 * aparece no lugar errado, o que se vê; se sumisse, ninguém notaria.
 */
export function buildMenu(role: EnumValue): MenuEntry[] {
  const visiveis = ROUTES.filter((r) => r.label && !r.hidden && !r.publica && podeAcessar(r, role));

  const paraLink = (r: AppRoute): MenuLink => ({
    name: r.label!,
    href: r.path,
    icon: r.icon ?? Building2,
  });

  const grupos = new Map<string, MenuGroup>();
  for (const grupo of MENU_GROUPS) {
    const items = visiveis
      .filter((r) => r.group === grupo.name)
      .map((r) => ({ name: r.label!, href: r.path }));

    if (items.length > 0) grupos.set(grupo.name, { name: grupo.name, icon: grupo.icon, items });
  }

  const soltas = new Map(visiveis.filter((r) => !r.group).map((r) => [r.path, r]));

  const menu: MenuEntry[] = [];
  for (const entrada of MENU_ORDER) {
    const grupo = grupos.get(entrada);
    if (grupo) {
      menu.push(grupo);
      grupos.delete(entrada);
      continue;
    }

    const solta = soltas.get(entrada);
    if (solta) {
      menu.push(paraLink(solta));
      soltas.delete(entrada);
    }
  }

  // Sobras: grupo ou rota que ninguém pôs em MENU_ORDER.
  menu.push(...grupos.values());
  menu.push(...[...soltas.values()].map(paraLink));

  return menu;
}
