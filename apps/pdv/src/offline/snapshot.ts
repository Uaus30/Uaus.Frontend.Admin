import { apiGetOrThrow } from "@workspace/api-client-react";
import { normalizeForSearch } from "./catalog";
import { toLocalCoupon, writeLocalCoupons } from "./coupons";
import { CATALOG_STORES, META_KEY, STORE, openLocalDatabase } from "./database";
import { clearAll, putAll, remove } from "./idb";
import { writeMeta } from "./meta";
import { invalidateProductsCache } from "./catalog";
import { listPendingSales } from "./pending-sales";
import { listPendingWriteOffs } from "./pending-write-offs";
import { consumeLocalStock, type StockMovement } from "./stock";
import type {
  LocalCustomer,
  LocalPaymentMethod,
  LocalProduct,
  PdvSnapshot,
  PendingSale,
  PendingWriteOff,
} from "./types";

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
 * ainda não conhece. E justamente por isso o estoque do snapshot não pode ser
 * aceito como veio: o servidor ainda não conhece os débitos da fila, então eles
 * são **re-aplicados** sobre a base recém-instalada (ver
 * {@link collectPendingStockDebits}). Sem isso, instalar um snapshot com fila
 * pendente ressuscitaria saldo que já saiu do balcão, e a próxima venda offline
 * seria recusada na sincronização com o cliente já fora da loja.
 */

/** Endpoint do snapshot. Contrato em `Uaus.Backend.Api/docs/pdv-offline.md`. */
const SNAPSHOT_PATH = "/Pdv/snapshot";

/**
 * Baixa o snapshot da API.
 *
 * Usa `apiGetOrThrow` porque snapshot vazio não é resposta: instalar `null`
 * apagaria o catálogo local e deixaria o caixa sem produtos para vender offline.
 * Melhor falhar aqui e manter a base anterior.
 */
export function downloadSnapshot(): Promise<PdvSnapshot> {
  return apiGetOrThrow<PdvSnapshot>(SNAPSHOT_PATH);
}

// `normalizeForSearch` mora em `catalog.ts` (quem faz a busca); a reexportação
// existe porque a instalação do snapshot é quem grava o texto já normalizado.
export { normalizeForSearch };

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
  /**
   * Cupons vigentes que vieram na base local.
   *
   * Zero tem duas causas que a tela não precisa distinguir, mas quem depura sim:
   * a loja não tem cupom vigente, ou o backend ainda não manda `coupons[]` — e aí
   * a consulta offline responde "este caixa não tem a lista de cupons".
   */
  coupons: number;
  /** Quando o backend gerou o snapshot, em ISO. */
  generatedAt: string;
}

/**
 * Débitos de estoque das filas pendentes que o snapshot do servidor ainda não
 * conhece, agregados por produto.
 *
 * Pura, para poder ser testada sem IndexedDB. Entram só os movimentos com
 * `stockApplied !== false`: uma venda/baixa recusada já teve o saldo devolvido
 * quando saiu do ar, então ela não debita nada. A agregação por produto importa
 * porque `consumeLocalStock` aplica um movimento por chave — dois débitos do
 * mesmo produto em registros diferentes precisam virar uma soma só.
 */
export function collectPendingStockDebits(
  sales: PendingSale[],
  writeOffs: PendingWriteOff[],
): StockMovement[] {
  const byProduct = new Map<number, number>();

  const add = (productId: number, quantity: number) => {
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + quantity);
  };

  for (const sale of sales) {
    if (sale.stockApplied === false) continue;
    for (const item of sale.items) add(item.productId, item.quantity);
  }

  for (const writeOff of writeOffs) {
    if (writeOff.stockApplied === false) continue;
    for (const item of writeOff.items) add(item.productId, item.quantity);
  }

  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Substitui o cadastro local pelo snapshot recebido.
 *
 * A ordem importa: as stores são esvaziadas antes da carga para que um produto
 * que saiu do catálogo não continue vendável no caixa. A fila de vendas fica
 * intacta — e, por isso, os débitos dela são re-aplicados sobre o estoque
 * recém-instalado: o servidor que gerou o snapshot ainda não conhece esses
 * movimentos, e aceitar o saldo dele como veio apagaria débitos de venda/baixa
 * que já aconteceram no balcão.
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
  // `null` quando o campo não veio (backend anterior a esta feature): a consulta
  // offline precisa distinguir "esta loja não tem cupom" de "este caixa não sabe
  // nada sobre cupons", e só a segunda é motivo para não validar nada.
  const coupons = snapshot.coupons ? snapshot.coupons.map(toLocalCoupon) : null;

  await clearAll(db, CATALOG_STORES);
  await putAll(db, STORE.products, products);
  invalidateProductsCache();
  await putAll(db, STORE.paymentMethods, paymentMethods);
  await putAll(db, STORE.customers, customers);

  // Os cupons não moram numa store de cadastro (a store nova custaria a migração
  // do banco local), então a substituição deles é esta gravação — inclusive
  // quando é `null`, que apaga a lista do turno anterior.
  await writeLocalCoupons(coupons);

  // Re-aplica os débitos da fila pendente sobre o estoque que acabou de chegar.
  // Sem isso, um snapshot instalado com fila pendente (botão "Atualizar", ou a
  // reconexão que baixa o snapshot antes de a fila subir) inflaria o saldo local
  // e liberaria venda offline de produto que já saiu da prateleira.
  const [pendingSales, pendingWriteOffs] = await Promise.all([listPendingSales(), listPendingWriteOffs()]);
  const debits = collectPendingStockDebits(pendingSales, pendingWriteOffs);
  if (debits.length > 0) await consumeLocalStock(debits);

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
    coupons: coupons?.length ?? 0,
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

/**
 * Apaga o cadastro local (produtos, formas de pagamento e clientes), os cupons e
 * as marcas do snapshot.
 *
 * Usado no logout: o cadastro carrega dados pessoais de clientes (nome,
 * documento, telefone) e não pode ficar legível no navegador depois que o
 * operador sai. As filas pendentes **nunca** são tocadas aqui — movimento que o
 * servidor não conhece não é apagado; a saída é bloqueada enquanto houver
 * pendência. O sequencial de cupom e as configurações da empresa também ficam:
 * não são dado pessoal e não têm de onde ser recuperados sem internet.
 *
 * **Os cupons precisam ser apagados à mão, e é fácil esquecer.** Eles moram numa
 * chave da store `meta`, que é preservada, então `clearAll(CATALOG_STORES)` não
 * os alcança — a linha explícita abaixo é a única coisa que impede a lista de
 * cupons e as perguntas da campanha do operador anterior de sobreviverem ao
 * logout, exatamente o que a limpeza existe para evitar.
 */
export async function clearLocalCatalog(): Promise<void> {
  const db = await openLocalDatabase();

  await clearAll(db, CATALOG_STORES);
  await remove(db, STORE.meta, META_KEY.coupons);

  // Sem as marcas o PDV sabe que a base sumiu: `hasLocalDatabase` volta a ser
  // falso e a venda offline fica bloqueada até o próximo snapshot.
  await remove(db, STORE.meta, META_KEY.snapshotDownloadedAt);
  await remove(db, STORE.meta, META_KEY.snapshotGeneratedAt);
  await remove(db, STORE.meta, META_KEY.snapshotSchemaVersion);
}
