import {
  ApiError,
  apiGetOrThrow,
  apiPost,
  cancelSale,
  getPdvSessionSales,
  updatePdvSale,
  type CouponDiscountTypeCode,
  type RegisterPdvSalePayload,
  type SaleDto,
  type SaleItemDto,
  type BackendPagedResult,
} from "@workspace/api-client-react";
import { computeSaleTotals } from "@workspace/core";
import {
  checkLocalStock,
  consumeLocalStock,
  nextOfflineSaleNumber,
  restoreLocalStock,
  savePendingSale,
  type PendingSale,
  type StockShortage,
} from "@/offline";

/** Item do carrinho pronto para virar SaleItem. */
export type SaleItemInput = {
  productId: number;
  quantity: number;
  /** Preço já líquido do desconto aplicado no item. */
  unitPrice: number;
  /** Desconto concedido neste item. */
  discount?: number;
  /** Nome do produto, guardado na fila offline para o cupom e a lista de pendências. */
  productName?: string;
};

export type SalePaymentInput = {
  paymentMethodId: number;
  paymentMethodInstallmentId?: number | null;
  amount: number;
  installments?: number;
  transactionFee?: number;
  /** Nome da forma, guardado na fila offline para o cupom. */
  paymentMethodName?: string;
};

/**
 * O cupom aplicado numa venda, no formato que os dois caminhos de gravação — a
 * API e a fila offline — esperam.
 *
 * **`discountAmount` JÁ ESTÁ INCLUÍDO em `RegisterSalePayload.discount` — NÃO
 * SOMAR.** O desconto da venda continua sendo o total; o cupom é uma parcela
 * dele. Somar os dois faria o servidor recusar a venda por total divergente
 * (online, com o cliente na frente) ou carimbá-la na sincronização (offline, com
 * o cliente já fora da loja).
 *
 * **Sem `campaignId`.** O PDV nunca sabe de onde as perguntas vieram; quem
 * fotografa o vínculo com a campanha é o servidor, na gravação.
 */
export type SaleCouponInput = {
  couponId: number;
  /**
   * Código como o operador leu do panfleto. É conferência contra `couponId`: uma
   * base local velha pode trazer um id que hoje pertence a outro código.
   */
  code: string;
  /** Código do enum `CouponDiscountType`: 1 = percentual, 2 = valor fixo. */
  discountType: CouponDiscountTypeCode;
  discountValue: number;
  /** Base do cálculo: subtotal dos itens MENOS o desconto global, nunca o cru. */
  baseAmount: number;
  /** Reais abatidos. Já incluídos em `discount`, e nunca maiores que `baseAmount`. */
  discountAmount: number;
  answers: { questionId: number; optionId: number }[];
};

export type RegisterSalePayload = {
  /**
   * Sessão de caixa da venda, ou `null` quando a loja não usa controle de caixa.
   *
   * O servidor tem a palavra final: `PdvService.ResolveSaleSessionAsync` ignora o
   * que vier aqui quando a empresa não controla caixa, e exige caixa aberto
   * quando controla.
   */
  cashRegisterSessionId: number | null;
  customerId?: number | null;
  /**
   * CPF/CNPJ informado no balcão; ignorado quando há `customerId`.
   *
   * É a única identificação avulsa do consumidor — o PDV não coleta nome. Com
   * cliente cadastrado, nome e documento saem da ficha dele no backend.
   */
  customerDocument?: string | null;
  /**
   * Desconto TOTAL aplicado sobre a venda. Quando há cupom, o abatimento dele
   * **já está incluído aqui**.
   */
  discount: number;
  /**
   * Cupom aplicado, ou ausente/`null` na venda sem cupom. Um por venda — não é
   * cumulativo, e quem garante isso é um índice único no banco.
   */
  coupon?: SaleCouponInput | null;
  items: SaleItemInput[];
  /**
   * Formas de pagamento. **Vazia quando o total é zero** — cupom que cobre a
   * venda inteira não recebe nada, e o servidor aceita a lista vazia nesse caso.
   */
  payments: SalePaymentInput[];
  notes?: string | null;
  managerLogin?: string | null;
  managerPassword?: string | null;
};

/** Endpoint da venda completa atômica. Ver `Uaus.Backend.Api/docs/pdv-offline.md`. */
const PDV_SALE_PATH = "/Pdv/sales";

/**
 * Total da venda: soma dos itens menos o desconto, nunca negativo.
 *
 * O backend refaz esta mesma conta e recusa divergência — offline o total é
 * calculado aqui, então ele não pode ser a única palavra.
 *
 * A conta em si vem do `@workspace/core`: é a MESMA função que o carrinho usa
 * para exibir o total, e era essa duplicação que permitia a tela mostrar um
 * valor e o payload levar outro.
 *
 * O cupom **não** entra como terceiro argumento de propósito: ele já está dentro
 * de `discount`, que é o desconto TOTAL. Enquanto `global + cupom <= subtotal`,
 * `subtotal − (global + cupom)` e `subtotal − global − cupom` são o mesmo número
 * — é a aritmética que permite o cupom ser uma parcela do desconto em vez de um
 * abatimento separado, e é o que mantém esta função com uma conta só.
 *
 * @param items Itens do carrinho com o preço já líquido do desconto do item.
 * @param discount Desconto TOTAL da venda, cupom incluído.
 */
export function computeSaleTotal(items: SaleItemInput[], discount: number) {
  return computeSaleTotals({
    // `unitPrice` aqui já chega líquido do desconto da linha, então o abatimento
    // por item é zero — ele foi contabilizado antes de montar o payload.
    items: items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      unitDiscount: 0,
    })),
    globalDiscount: discount,
  }).total;
}

/**
 * Data e hora no formato que a API espera: horário local da loja, **sem**
 * indicador de fuso — `2026-07-25T17:34:12`.
 *
 * `toISOString()` devolveria UTC (`...T20:34:12Z`), e o backend grava a hora que
 * recebe como horário local: a venda das 17h34 apareceria no painel como 20h34.
 * Toda data do sistema segue esta convenção (ver `ToBrasiliaTime` no backend).
 *
 * O formato também é lexicograficamente ordenável, que é como a fila offline
 * ordena as vendas, e `new Date()` o interpreta como horário local ao ler de
 * volta — sem fuso declarado, a especificação manda tratar como local.
 *
 * @param date Momento a formatar. Por padrão, agora.
 */
export function toLocalTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Resultado do registro de uma venda pelo PDV.
 *
 * `offline` distingue os dois desfechos possíveis, e a tela precisa dos dois: a
 * venda gravada no servidor tem número definitivo, a que ficou na fila tem
 * número provisório e um cupom marcado como tal.
 */
export type RegisteredSale = {
  /** ID da venda no banco, ou `null` quando ela ficou na fila offline. */
  id: number | null;
  /** Número impresso no cupom: o ID do banco, ou `OFF-n` na venda offline. */
  receiptNumber: number | string;
  /** Chave de idempotência gerada para esta venda. */
  clientReference: string;
  /** Momento da venda, em ISO. */
  occurredAt: string;
  total: number;
  notes: string | null;
  /** Verdadeiro quando a venda foi para a fila em vez de ir ao servidor. */
  offline: boolean;
};

/** Erro de venda offline recusada pela conferência de estoque local. */
export class LocalStockError extends Error {
  readonly shortages: StockShortage[];

  constructor(shortages: StockShortage[]) {
    const detail = shortages
      .map((item) => `${item.productName} (pedido ${item.requested}, disponível ${item.available})`)
      .join("; ");

    super(`Estoque insuficiente na base local: ${detail}`);
    this.name = "LocalStockError";
    this.shortages = shortages;
  }
}

/**
 * Gera a chave de idempotência de um movimento do PDV (venda ou baixa).
 *
 * Exportada para a baixa de estoque reusar: as duas filas dependem da mesma
 * garantia — a mesma referência nunca entra duas vezes no banco — e duas
 * implementações do mesmo UUID seria uma a mais para manter.
 */
export function newClientReference(): string {
  // `randomUUID` exige contexto seguro; em HTTP simples caímos no plano B, que
  // é suficiente porque a unicidade só precisa valer dentro deste caixa.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `pdv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildRequestBody(
  payload: RegisterSalePayload,
  clientReference: string,
  occurredAt: string,
  total: number,
): RegisterPdvSalePayload {
  return {
    clientReference,
    occurredAt,
    cashRegisterSessionId: payload.cashRegisterSessionId,
    customerId: payload.customerId ?? null,
    customerDocument: payload.customerDocument?.trim() || null,
    total,
    discount: payload.discount,
    // `?? null` e não `undefined`: o backend declara `RegisterPdvSaleCouponRequest?
    // Coupon` e a ausência é explícita. Vale também para a reedição, que reenvia
    // a venda inteira.
    coupon: payload.coupon ?? null,
    notes: payload.notes?.trim() || null,
    managerLogin: payload.managerLogin || null,
    managerPassword: payload.managerPassword || null,
    items: payload.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount ?? 0,
    })),
    payments: payload.payments.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      paymentMethodInstallmentId: payment.paymentMethodInstallmentId ?? null,
      amount: payment.amount,
      installments: payment.installments ?? 1,
      transactionFee: payment.transactionFee ?? 0,
    })),
  };
}

/** Movimentos de estoque correspondentes aos itens da venda. */
function toStockMovements(items: SaleItemInput[]) {
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}

/**
 * Registra a venda: no servidor quando há conexão, na fila local quando não há.
 *
 * O caminho é escolhido pelo estado de conexão informado por quem chama, mas uma
 * falha de rede no meio da requisição também cai para a fila: entre perder a
 * venda e guardá-la para sincronizar, guardar é sempre melhor. Já um erro que o
 * servidor **respondeu** (estoque insuficiente, sessão fechada) é propagado — ali
 * a venda foi recusada por regra de negócio, e enfileirá-la só adiaria o mesmo
 * "não" para depois.
 *
 * Nos dois caminhos o estoque local é debitado, para que a base local acompanhe
 * o balcão e a próxima venda já veja o saldo certo.
 *
 * @param payload Venda fechada no checkout.
 * @param options `offline: true` grava direto na fila, sem tentar a rede.
 *   `clientReference` reutiliza a chave de idempotência de uma tentativa
 *   anterior do MESMO checkout — sem ela, cada clique em "Confirmar" geraria
 *   uma chave nova e uma retentativa após um 502/504 (com a venda já gravada no
 *   servidor) criaria uma SEGUNDA venda que o índice único não tem como barrar.
 * @throws {LocalStockError} Quando a venda offline não cabe no estoque local.
 * @throws {ApiError} Quando o servidor recusa a venda.
 */
export async function registerSale(
  payload: RegisterSalePayload,
  options: { offline?: boolean; clientReference?: string } = {},
): Promise<RegisteredSale> {
  // Desconto negativo AUMENTARIA o total. Online o servidor recusa, mas a fila
  // offline só descobriria na sincronização — com o cliente já tendo pago o
  // valor inflado. A recusa precisa acontecer aqui, antes de qualquer gravação.
  if (payload.discount < 0) {
    throw new Error("O desconto da venda não pode ser negativo.");
  }

  // O cupom é PARCELA do desconto, nunca uma adição. Se o abatimento passasse do
  // desconto total, ou alguém somou duas vezes, ou o desconto foi montado sem o
  // cupom — e as duas coisas terminam na mesma recusa por total divergente. Vale
  // recusar aqui pelo mesmo motivo do desconto negativo: offline a divergência
  // só apareceria na sincronização, com o cliente já fora da loja.
  if (payload.coupon && payload.coupon.discountAmount > payload.discount) {
    throw new Error("O desconto do cupom não pode ser maior que o desconto total da venda.");
  }

  const total = computeSaleTotal(payload.items, payload.discount);
  const clientReference = options.clientReference ?? newClientReference();
  const occurredAt = toLocalTimestamp();

  if (options.offline) {
    return enqueueSale(payload, clientReference, occurredAt, total);
  }

  try {
    const response = await apiPost<SaleDto>(
      PDV_SALE_PATH,
      buildRequestBody(payload, clientReference, occurredAt, total),
    );

    const saved = response.data;
    if (!saved?.id) {
      throw new Error("Não foi possível identificar a venda criada.");
    }

    await consumeLocalStock(toStockMovements(payload.items));

    return {
      id: saved.id,
      receiptNumber: saved.id,
      clientReference,
      occurredAt: saved.createdAt ?? occurredAt,
      total: saved.total,
      notes: saved.notes ?? null,
      offline: false,
    };
  } catch (error) {
    // O servidor respondeu recusando: é regra de negócio, não falta de conexão.
    if (error instanceof ApiError) throw error;

    // Qualquer outra falha é rede (fetch abortado, DNS, servidor inalcançável).
    return enqueueSale(payload, clientReference, occurredAt, total);
  }
}

/**
 * Grava a venda na fila local e debita o estoque da base local.
 *
 * A conferência de estoque roda antes de qualquer escrita: a regra é a mesma do
 * backend (que recusa estoque negativo), então vender além do saldo local só
 * criaria uma venda destinada a ser recusada na sincronização — e o operador
 * descobriria isso horas depois, com o cliente já fora da loja.
 */
async function enqueueSale(
  payload: RegisterSalePayload,
  clientReference: string,
  occurredAt: string,
  total: number,
): Promise<RegisteredSale> {
  const movements = toStockMovements(payload.items);

  const shortages = await checkLocalStock(movements);
  if (shortages.length > 0) {
    throw new LocalStockError(shortages);
  }

  const offlineNumber = await nextOfflineSaleNumber();
  const notes = payload.notes?.trim() || null;

  const sale: PendingSale = {
    clientReference,
    offlineNumber,
    occurredAt,
    cashRegisterSessionId: payload.cashRegisterSessionId,
    customerId: payload.customerId ?? null,
    customerDocument: payload.customerDocument?.trim() || null,
    total,
    discount: payload.discount,
    // A fila guarda o cupom como ele foi aplicado no balcão: é o número que saiu
    // impresso no comprovante que o cliente levou, e é ele que prevalece na
    // sincronização quando a definição do cupom tiver mudado desde então.
    coupon: payload.coupon ?? null,
    notes,
    items: payload.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount ?? 0,
      productName: item.productName ?? `Produto #${item.productId}`,
    })),
    payments: payload.payments.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      paymentMethodInstallmentId: payment.paymentMethodInstallmentId ?? null,
      amount: payment.amount,
      installments: payment.installments ?? 1,
      transactionFee: payment.transactionFee ?? 0,
      paymentMethodName: payment.paymentMethodName ?? "Não informado",
    })),
    status: "pending",
    attempts: 0,
    lastError: null,
    // A venda debita o estoque local logo abaixo; o marcador acompanha isso para
    // que a sincronização saiba se precisa devolver ou redebitar.
    stockApplied: true,
  };

  // A venda entra na fila antes da baixa de estoque: se a gravação falhar, o
  // saldo local continua íntegro e o operador recebe o erro. A ordem inversa
  // deixaria o estoque debitado por uma venda que não existe em lugar nenhum.
  await savePendingSale(sale);
  await consumeLocalStock(movements);

  return {
    id: null,
    receiptNumber: `OFF-${offlineNumber}`,
    clientReference,
    occurredAt,
    total,
    notes,
    offline: true,
  };
}

/**
 * Regrava uma venda já finalizada mantendo o mesmo ID: os itens antigos são
 * apagados (devolvendo os lotes ao estoque) e os novos são lançados por cima.
 *
 * Exige conexão. Reedição mexe numa venda que já existe no servidor, e fazer isso
 * offline significaria reconciliar duas versões da mesma venda na sincronização —
 * complexidade que o balcão não justifica: sem internet, o caminho é cancelar
 * depois e refazer.
 *
 * @param saleId Venda que está sendo editada.
 * @param payload Novos itens e formas de pagamento.
 */
export async function updateSale(saleId: number, payload: RegisterSalePayload) {
  const total = computeSaleTotal(payload.items, payload.discount);

  // `PUT /Pdv/sales/{id}` regrava a venda inteira, então `notes: null` APAGA a
  // observação já gravada. A tela de reedição não reenvia a observação, logo ela
  // é relida da venda atual quando o chamador não informa uma nova.
  const informedNotes = payload.notes?.trim();
  const notes = informedNotes ?? (await getSale(saleId)).notes ?? null;

  const requestBody = { ...buildRequestBody(payload, "", "", total), notes };
  const updatedSale = await updatePdvSale(saleId, requestBody);

  if (!updatedSale) throw new Error("Falha ao atualizar a venda");

  return updatedSale;
}

/**
 * Busca a venda com as formas de pagamento e os itens.
 *
 * `apiGetOrThrow`: quem chama já tem o id de uma venda existente (veio da
 * listagem do turno), então corpo vazio é falha do servidor, não "não achei".
 */
export async function getSale(saleId: number) {
  return apiGetOrThrow<SaleDto>(`/Sales/${saleId}`);
}

/** Lista os itens de uma venda. */
export async function getSaleItems(saleId: number) {
  const result = await apiGetOrThrow<BackendPagedResult<SaleItemDto>>("/SaleItems", {
    saleId,
    page: 1,
    size: 200,
  });
  return result.items;
}

/**
 * Devolve à projeção local o estoque dos itens de uma venda cancelada.
 *
 * O cancelamento na API devolve o estoque **no servidor**; sem este passo a
 * base local ficava subestimada até o próximo snapshot, e o PDV recusava venda
 * offline de produto que estava na prateleira. É a outra metade do contrato
 * documentado em `offline/stock.ts`: venda debita, cancelamento devolve.
 *
 * @param saleId Venda que acabou de ser cancelada com sucesso.
 */
export async function restoreCancelledSaleStock(saleId: number): Promise<void> {
  const items = await getSaleItems(saleId);
  await restoreLocalStock(
    items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  );
}

/**
 * Vendas da sessão de caixa, mais recentes primeiro (o backend já ordena por ID desc).
 *
 * @param cashRegisterSessionId Sessão de caixa aberta.
 */
export async function getSessionSales(cashRegisterSessionId: number) {
  return getPdvSessionSales(cashRegisterSessionId);
}

export { cancelSale };
