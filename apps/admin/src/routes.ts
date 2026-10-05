import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  BarChart3,
  Building2,
  DollarSign,
  Gauge,
  House,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PRODUCTS_MATCH_PATH } from "@/features/products/product-detail-route";
import { LOW_STOCK_REPORT_PATH } from "@/features/low-stock/low-stock-route";
import { PURCHASES_PATH } from "@/features/purchases/purchases-route";
import { PROMOTIONS_MATCH_PATH, PROMOTIONS_PATH } from "@/features/promotions/promotion-route";
import { HOME_PATH } from "@/features/home/home-route";
import { PRODUCT_ANOMALIES_PATH } from "@/features/product-anomalies/anomalies-route";

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

export interface AppRoute {
  path: string;
  /**
   * Padrão que o `<Switch>` usa no lugar do `path`, quando a página responde
   * por mais de um caminho.
   *
   * Existe para a tela que tem detalhe DENTRO da própria página: um `<Route>`
   * só respondendo por `/produtos` e `/produtos/:id/detalhes` mantém a página
   * montada na ida e na volta. Com duas entradas, as chaves diferentes do
   * `<Switch>` desmontariam a listagem e voltar do detalhe perderia filtro,
   * busca e página. O menu continua usando o `path`.
   */
  matchPath?: string;
  /** Rótulo no menu. Ausente = rota sem entrada no menu (detalhe, redirect). */
  label?: string;
  /** Grupo do menu. Ausente = item de primeiro nível. */
  group?: string;
  icon?: LucideIcon;
  component: LazyExoticComponent<ComponentType<Record<string, never>>>;
  /** A rota existe, responde, mas não aparece no menu. */
  hidden?: boolean;
  /** A rota é pública — não exige sessão. */
  publica?: boolean;
  /**
   * A página ocupa o `<main>` inteiro, sem o padding e o `max-w-7xl` do layout,
   * e com a altura da área útil. É o que o quadro de tarefas precisa: fundo até
   * as bordas e colunas que rolam por dentro. Fora daqui, toda tela é um
   * documento centralizado que cresce para baixo.
   */
  fullBleed?: boolean;
}

const Login = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));
const HomePage = lazy(() => import("@/pages/home"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const TaskBoard = lazy(() => import("@/pages/task-board"));
const Loyalty = lazy(() => import("@/pages/loyalty"));
const Products = lazy(() => import("@/pages/products"));
const Departments = lazy(() => import("@/pages/departments"));
const Categories = lazy(() => import("@/pages/categories"));
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
const Purchases = lazy(() => import("@/pages/purchases"));
const StockWriteOffs = lazy(() => import("@/pages/stock-write-offs"));
const Inventory = lazy(() => import("@/pages/inventory"));
const LowStock = lazy(() => import("@/pages/low-stock"));
const Images = lazy(() => import("@/pages/images"));
const Customers = lazy(() => import("@/pages/customers"));
const CompanySettings = lazy(() => import("@/pages/settings"));
const Logs = lazy(() => import("@/pages/logs"));
const LogDetails = lazy(() => import("@/pages/log-details"));
const UsersPage = lazy(() => import("@/pages/users"));
const Coupons = lazy(() => import("@/pages/coupons"));
const Campaigns = lazy(() => import("@/pages/campaigns"));
const Promotions = lazy(() => import("@/pages/promotions"));
const CampaignReport = lazy(() => import("@/pages/campaign-report"));
const CampaignComparison = lazy(() => import("@/pages/campaign-comparison"));
const MarketingCatalog = lazy(() => import("@/pages/marketing-catalog"));
const MarketingCatalogHistory = lazy(() => import("@/pages/marketing-catalog-history"));
const SupplierPerformance = lazy(() => import("@/pages/supplier-performance"));
const SupplierPerformanceDetail = lazy(() => import("@/pages/supplier-performance-detail"));
const ProductAbc = lazy(() => import("@/pages/product-abc"));
const SiteMetrics = lazy(() => import("@/pages/site-metrics"));
const ProductPerformance = lazy(() => import("@/pages/product-performance"));
const PeriodComparison = lazy(() => import("@/pages/period-comparison"));
const ProfitLeaders = lazy(() => import("@/pages/profit-leaders"));
const ProductAnomalies = lazy(() => import("@/pages/product-anomalies"));

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
  // Separado de "Relatórios" de propósito: relatório responde "quanto foi"; BI
  // responde "o que fazer com isso". Juntar os dois num grupo só faria a análise
  // estratégica competir por atenção com a consulta do dia a dia.
  { name: "BI", icon: Gauge },
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
  // A tela em que o admin abre vem primeiro: é para onde o "Início" leva de volta.
  HOME_PATH,
  "/dashboard",
  "Estoque",
  "Financeiro",
  "Relatórios",
  "BI",
  "Marketing",
  "/imagens",
  "/clientes",
  "/sistema/usuarios",
  // Último de propósito: configuração e auditoria são o que menos se abre num
  // dia de loja.
  "Sistema",
];

/**
 * Toda rota privada abre para quem tem sessão: não existe perfil de usuário
 * (decisão do dono, 03/10/2026). Rota nova não declara papel — só `publica`,
 * quando dispensa login.
 */
export const ROUTES: AppRoute[] = [
  { path: "/login", component: Login, publica: true, hidden: true },

  // Tela inicial (05/10/2026): a grade de atalhos, pensada para o celular. A
  // raiz, o login e a 404 mandam para cá — ver `features/home/home-route.ts`.
  { path: HOME_PATH, label: "Início", icon: House, component: HomePage },

  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, component: Dashboard },

  {
    path: "/produtos",
    matchPath: PRODUCTS_MATCH_PATH,
    label: "Produtos",
    group: "Estoque",
    component: Products,
  },
  // "Entradas" saiu do menu em 13/09/2026: a entrada de mercadoria e sempre de
  // UM produto (regra de 31/08/2026), e a aba Estoque do cadastro ja mostra as
  // notas daquele produto, com detalhe e cancelamento. A listagem geral cobrava
  // uma busca por produto para chegar no que interessa, e a pergunta que ela
  // respondia — "o que entrou na loja" — ficou sem tela propria, por decisao do
  // dono.
  { path: PURCHASES_PATH, label: "Compras", group: "Estoque", component: Purchases },
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
  },
  {
    path: "/financeiro/custos-fixos",
    label: "Custos Fixos",
    group: "Financeiro",
    component: FixedCosts,
  },
  { path: "/financeiro/socios", label: "Sócios", group: "Financeiro", component: Partners },
  {
    path: "/financeiro/formas-pagamento",
    label: "Formas de Pagamento",
    group: "Financeiro",
    component: PaymentMethodsPage,
  },
  // Caminho antigo, mantido para não quebrar link salvo. Fora do menu: a mesma
  // tela em dois lugares confundiria mais do que ajuda.
  { path: "/formas-pagamento", component: PaymentMethodsPage, hidden: true },

  { path: "/marketing/cupons", label: "Cupons", group: "Marketing", component: Coupons },
  // Programa de fidelidade (01/10/2026): uma tela só, com ligar/desligar, a
  // configuração num modal e o painel do período.
  {
    path: "/marketing/fidelidade",
    label: "Fidelidade",
    group: "Marketing",
    component: Loyalty,
  },
  {
    path: "/marketing/campanhas",
    label: "Campanhas",
    group: "Marketing",
    component: Campaigns,
  },

  // Logo abaixo de Campanhas, a pedido do dono. `matchPath` cobre os três
  // caminhos da tela (listagem, `/nova` e `/<id>`) numa entrada só: separadas,
  // ir para o cadastro desmontaria a listagem e voltar perderia filtro e página.
  {
    path: PROMOTIONS_PATH,
    matchPath: PROMOTIONS_MATCH_PATH,
    label: "Promoções",
    group: "Marketing",
    component: Promotions,
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
  },
  // Detalhe: chega pela lista, não pelo menu.
  { path: "/marketing/campanhas/:id/relatorio", component: CampaignReport, hidden: true },
  // Catálogo de divulgação (03/10/2026). Por último: não tem sequência de
  // trabalho com cupom nem com campanha.
  { path: "/marketing/catalogo", label: "Catálogo", group: "Marketing", component: MarketingCatalog },
  // O histórico das peças mostra unidades vendidas (o antes e depois de cada
  // peça), que são número de BI.
  {
    path: "/marketing/catalogo/historico",
    label: "Histórico do Catálogo",
    group: "Marketing",
    component: MarketingCatalogHistory,
  },

  { path: "/estoque/inventario", label: "Inventário", group: "Relatórios", component: Inventory },
  // Relatório, e não tela de Estoque: ele só LÊ o saldo. O alerta vermelho do
  // painel e da listagem de produtos aponta para cá.
  { path: LOW_STOCK_REPORT_PATH, label: "Estoque baixo", group: "Relatórios", component: LowStock },

  // O menu do grupo segue a ordem DESTA lista, e no BI ela é ALFABÉTICA. As
  // telas de BI não têm sequência de trabalho entre si — nenhuma é "a próxima"
  // depois da outra, como Entradas é depois de Compras —, então a única ordem
  // que alguém consegue prever é a do alfabeto. Tela nova entra na posição
  // alfabética, não no fim.
  {
    // As métricas de acesso da loja online. "Analytics" é o nome que o dono usa
    // (30/09/2026).
    path: "/bi/analytics",
    label: "Analytics",
    group: "BI",
    component: SiteMetrics,
  },
  {
    // Mostra custo e margem item a item, como as outras telas do grupo.
    path: PRODUCT_ANOMALIES_PATH,
    label: "Anomalias",
    group: "BI",
    component: ProductAnomalies,
  },
  {
    path: "/bi/curva-abc",
    label: "Curva ABC de Produtos",
    group: "BI",
    component: ProductAbc,
  },
  {
    path: "/bi/fornecedores",
    label: "Desempenho de Fornecedores",
    group: "BI",
    component: SupplierPerformance,
  },
  // Detalhe: chega pelo ranking, não pelo menu.
  {
    path: "/bi/fornecedores/:id",
    component: SupplierPerformanceDetail,
    hidden: true,
  },
  {
    path: "/bi/produtos",
    label: "Desempenho de Produtos",
    group: "BI",
    component: ProductPerformance,
  },
  {
    path: "/bi/o-que-mudou",
    label: "O que mudou",
    group: "BI",
    component: PeriodComparison,
  },
  {
    path: "/bi/o-que-trouxe-lucro",
    label: "O que trouxe lucro",
    group: "BI",
    component: ProfitLeaders,
  },

  { path: "/imagens", label: "Mídia", icon: ImageIcon, component: Images },
  { path: "/clientes", label: "Clientes", icon: Users, component: Customers },

  // Em "Sistema" por escolha do dono (30/09/2026), e primeiro do grupo: é a
  // única tela dele que se abre todo dia.
  { path: "/tarefas", label: "Tarefas", group: "Sistema", component: TaskBoard, fullBleed: true },
  {
    path: "/configuracoes",
    label: "Configurações",
    group: "Sistema",
    component: CompanySettings,
  },
  { path: "/sistema/logs", label: "Logs", group: "Sistema", component: Logs },
  { path: "/sistema/logs/:id", component: LogDetails, hidden: true },

  // Fora do grupo "Sistema": gerenciar quem entra na loja é rotina de dono, não
  // configuração de sistema, e ficava escondido atrás de um submenu que também
  // guarda logs. O caminho continua `/sistema/usuarios` — mudar a URL quebraria
  // link salvo sem devolver nada.
  {
    path: "/sistema/usuarios",
    label: "Usuários",
    icon: UserCog,
    component: UsersPage,
  },
];

export const NOT_FOUND_COMPONENT = NotFound;

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
 * Menu montado a partir das rotas visíveis, na ordem de `MENU_ORDER`.
 *
 * O que `MENU_ORDER` não menciona entra ao fim, na ordem em que aparece nas
 * `ROUTES`. Isso é deliberado: uma tela nova esquecida na lista de ordenação
 * aparece no lugar errado, o que se vê; se sumisse, ninguém notaria.
 */
export function buildMenu(): MenuEntry[] {
  const visiveis = ROUTES.filter((r) => r.label && !r.hidden && !r.publica);

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
