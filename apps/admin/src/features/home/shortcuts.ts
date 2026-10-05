import {
  BadgePercent,
  BookOpen,
  LayoutDashboard,
  Package,
  PackageMinus,
  Receipt,
  ScanSearch,
  ShoppingCart,
  SquareKanban,
  TrendingUp,
} from "lucide-react";
import { LOW_STOCK_REPORT_PATH } from "@/features/low-stock/low-stock-route";
import { PURCHASES_PATH } from "@/features/purchases/purchases-route";
import { PRODUCT_ANOMALIES_PATH } from "@/features/product-anomalies/anomalies-route";
import { PROMOTIONS_PATH } from "@/features/promotions/promotion-route";
import type { HomeShortcut } from "./types";

/**
 * Os botões da tela inicial, na ordem da grade (pedido do dono, 05/10/2026).
 *
 * A lista anda em PARES de assunto, e a grade só usa número par de colunas
 * (duas no celular, quatro no desktop) para que o par nunca se separe: cada
 * linha do celular é um assunto. Botão novo entra com o seu par, ou a linha de
 * baixo inteira escorrega uma casa e mistura os assuntos.
 *
 * Os caminhos que já têm constante na feature dona vêm dela; os outros são
 * literais, e o teste da grade confere que cada um é uma rota visível do
 * `routes.ts` — renomear uma rota sem mexer aqui reprova o teste em vez de
 * deixar um botão levando à 404.
 */
export const HOME_SHORTCUTS: readonly HomeShortcut[] = [
  // O resultado: o panorama do período e quem o fez.
  {
    label: "Dashboard",
    description: "Indicadores e faturamento do período",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Lucros",
    description: "O que trouxe lucro no período",
    href: "/bi/o-que-trouxe-lucro",
    icon: TrendingUp,
  },

  // O cadastro: o produto e o que está errado nele.
  {
    label: "Produtos",
    description: "Cadastro, preço e estoque",
    href: "/produtos",
    icon: Package,
  },
  {
    label: "Anomalias",
    description: "Cadastros com algo para corrigir",
    href: PRODUCT_ANOMALIES_PATH,
    icon: ScanSearch,
  },

  // A reposição: o que está acabando e o pedido que repõe.
  {
    label: "Estoque",
    description: "O que está acabando e precisa repor",
    href: LOW_STOCK_REPORT_PATH,
    icon: PackageMinus,
  },
  {
    label: "Compras",
    description: "Pedidos de reposição e recebimento",
    href: PURCHASES_PATH,
    icon: ShoppingCart,
  },

  // A saída: o que vendeu e o que divulga.
  {
    label: "Vendas",
    description: "Vendas do balcão e do site",
    href: "/vendas",
    icon: Receipt,
  },
  {
    label: "Catálogos",
    description: "Gerar o catálogo de divulgação",
    href: "/marketing/catalogo",
    icon: BookOpen,
  },

  // Por último, a pedido do dono: o que está em oferta e o que há para fazer.
  {
    label: "Promoções",
    description: "Preço promocional com vigência",
    href: PROMOTIONS_PATH,
    icon: BadgePercent,
  },
  {
    label: "Tarefas",
    description: "O quadro de tarefas da loja",
    href: "/tarefas",
    icon: SquareKanban,
  },
];
