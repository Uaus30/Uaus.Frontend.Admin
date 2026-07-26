import { apiGet } from "@workspace/api-client-react";
import { CATALOG_STORES, META_KEY, STORE, openLocalDatabase } from "./database";
import { clearAll, putAll } from "./idb";
import { writeMeta } from "./meta";
import type { LocalCustomer, LocalPaymentMethod, LocalProduct, PdvSnapshot } from "./types";

/**
 * Download e instalação da base local.
 *
 * O PDV baixa o snapshot na abertura de cada sessão de caixa e **substitui o
 * cadastro local por inteiro**. Não há mesclagem incremental: um produto
 * excluído no admin precisa desaparecer do caixa, e reconciliar diferenças
 * abriria toda uma classe de bugs de estado parcial por um ganho de desempenho
 * que ninguém pediu.
 *
 * A fila de vendas pendentes **não** é tocada — ela contém venda que o servidor
 * ainda não conhece.
 */

/** Endpoint do snapshot. Contrato em `Uaus.Backend.Api/docs/pdv-offline.md`. */
const SNAPSHOT_PATH = "/Pdv/snapshot";

/** Marcas de acento que a normalização NFD separa das letras. */
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** Baixa o snapshot da API. */
export function downloadSnapshot(): Promise<PdvSnapshot> {
  return apiGet<PdvSnapshot>(SNAPSHOT_PATH);
}

/**
 * Normaliza o texto para a busca local: minúsculas e sem acento.
 *
 * O operador digita "cafe" e espera achar "Café". Fazer isso na leitura custaria
 * uma normalização por produto a cada tecla; aqui é feito uma vez, na carga.
 */
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

/** Converte um produto do snapshot no registro da base local. */
function toLocalProduct(product: PdvSnapshot["products"][number]): LocalProduct {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode ?? "",
    price: product.price,
    stock: product.stock,
    status: product.status,
    productGroupId: product.productGroupId,
    searchName: normalizeForSearch(product.name),
  };
}

/** Converte um cliente do snapshot no registro da base local. */
function toLocalCustomer(customer: PdvSnapshot["customers"][number]): LocalCustomer {
  return {
    id: customer.id,
    name: customer.name,
    document: customer.document ?? null,
    phone: customer.phone ?? null,
    searchName: normalizeForSearch(customer.name),
  };
}

/** Resultado da instalação do snapshot, para registrar no log e avisar o operador. */
export interface SnapshotInstallResult {
  products: number;
  paymentMethods: number;
  customers: number;
  /** Quando o backend gerou o snapshot, em ISO. */
  generatedAt: string;
}

/**
 * Substitui o cadastro local pelo snapshot recebido.
 *
 * A ordem importa: as stores são esvaziadas antes da carga para que um produto
 * que saiu do catálogo não continue vendável no caixa. A fila de vendas fica
 * intacta.
 *
 * @param snapshot Snapshot recém-baixado da API.
 */
export async function installSnapshot(snapshot: PdvSnapshot): Promise<SnapshotInstallResult> {
  const db = await openLocalDatabase();

  const products = snapshot.products.map(toLocalProduct);
  const paymentMethods: LocalPaymentMethod[] = snapshot.paymentMethods.map((method) => ({
    id: method.id,
    name: method.name,
    installments: method.installments ?? [],
  }));
  const customers = snapshot.customers.map(toLocalCustomer);

  await clearAll(db, CATALOG_STORES);
  await putAll(db, STORE.products, products);
  await putAll(db, STORE.paymentMethods, paymentMethods);
  await putAll(db, STORE.customers, customers);

  // Os metadados são gravados por último, e só depois da carga: se algo falhar no
  // meio, a base fica sem marca de atualização e o PDV sabe que não pode confiar
  // nela para vender offline.
  await writeMeta(META_KEY.snapshotSchemaVersion, snapshot.schemaVersion);
  await writeMeta(META_KEY.snapshotGeneratedAt, snapshot.generatedAt);
  await writeMeta(META_KEY.snapshotDownloadedAt, new Date().toISOString());

  return {
    products: products.length,
    paymentMethods: paymentMethods.length,
    customers: customers.length,
    generatedAt: snapshot.generatedAt,
  };
}

/**
 * Baixa e instala o snapshot numa operação.
 *
 * @throws Quando a API está inacessível ou recusa a requisição. Quem chama
 *   decide o que fazer — na abertura da sessão o PDV avisa que a base local
 *   ficou velha, mas não impede a venda online.
 */
export async function refreshLocalDatabase(): Promise<SnapshotInstallResult> {
  return installSnapshot(await downloadSnapshot());
}
