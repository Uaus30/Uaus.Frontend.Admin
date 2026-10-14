import { normalizeSearchText } from "@workspace/core";
import type { SupplierType } from "@workspace/api-client-react";
import type { SupplierForm } from "./types";

/**
 * Catálogos e funções puras da tela de fornecedores.
 *
 * Moraram dentro de `hooks/useSuppliers.ts` até a migração para os hooks do
 * api-client. Saíram de lá por dois motivos: o arquivo do hook passava de 300
 * linhas com duas listas de constantes no meio do caminho, e um componente que
 * só precisa da lista de UFs não tem por que importar o módulo que carrega o
 * hook inteiro.
 */

/** Paleta do avatar do fornecedor. A cor sorteada é persistida no cadastro. */
export const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#0ea5e9",
  "#84cc16",
  "#d946ef",
  "#e11d48",
  "#059669",
  "#0284c7",
  "#7c3aed",
];

/** Unidades federativas aceitas no endereço do fornecedor. */
export const UF_LIST = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

/**
 * Retorna uma cor aleatória do catálogo de cores de avatar.
 */
export function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/**
 * Remove acentos e caracteres especiais para normalizar o nome de status.
 *
 * Mantido com o nome que descreve o uso na tela; a regra de normalizacao e a
 * mesma do resto do sistema e vive em `@workspace/core`.
 */
export function normalizeStatusName(name: string): string {
  return normalizeSearchText(name);
}

/**
 * Cria a URL do WhatsApp a partir de um telefone.
 */
export function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

/**
 * O formulário em branco do cadastro novo, com o status escolhido.
 *
 * Saiu do hook (14/10/2026), onde o mesmo literal aparecia duas vezes — no
 * estado inicial e no "Novo fornecedor" —, e um campo acrescentado em um só dos
 * dois nasceria indefinido no outro.
 */
export function emptySupplierForm(status: string): SupplierForm {
  return {
    name: "",
    corporateName: "",
    document: "",
    salesRepresentative: "",
    phone: "",
    email: "",
    minimumPurchaseValue: "",
    status,
    city: "",
    state: "PR",
    avatarColor: randomColor(),
    description: "",
    isRecurring: false,
    type: "",
  };
}

/**
 * O que cada tipo de fornecedor muda fora desta tela (14/10/2026), na frase que
 * aparece embaixo do seletor.
 *
 * Fica escrito porque nenhum efeito é visível aqui: um seletor sem consequência
 * aparente é escolhido sem ler, e o tipo errado liga ou desliga regra de compra
 * e de estoque sem ninguém perceber.
 */
export const SUPPLIER_TYPE_HINTS: Record<SupplierType, string> = {
  Marketplace:
    "Plataforma com vários vendedores (Shopee, Mercado Livre, Amazon). As compras deste fornecedor " +
    "exigem o link do anúncio para sair de Pendente — sem ele não há como reencontrar o item depois.",
  Wholesale:
    "Compras de poucas unidades de um produto (limite em Configurações › Estoque) deixam o controle de " +
    'estoque dele desligado com o motivo "Planejar viagem" — repor exige ir até lá. Ele aparece na ' +
    "Lista de Compras quando tiver boa saída.",
  Retail:
    "Compras de poucas unidades de um produto (limite em Configurações › Estoque) deixam o controle de " +
    'estoque dele desligado com o motivo "Planejar viagem" — repor exige ir até lá. Ele aparece na ' +
    "Lista de Compras quando tiver boa saída.",
  Factory:
    "Compra direta da fábrica (pedido por WhatsApp, entrega por transportadora). Fica fora da regra da " +
    "compra pequena: o produto continua no relatório de estoque baixo.",
  Distributor: "Sem efeito em outras telas.",
  Other: "Sem efeito em outras telas.",
};
