import { COUPON_DISCOUNT_TYPE, enumCode } from "@workspace/api-client-react";
import { formatShortDate } from "@workspace/core";
import { META_KEY } from "./database";
import { readMeta, writeMeta } from "./meta";
import { listPendingSales } from "./pending-sales";
import type { LocalCoupon, PdvSnapshotCoupon, PendingSale } from "./types";

/**
 * Cupons de desconto na base local.
 *
 * O snapshot traz cada cupom com **o questionário da campanha já resolvido**, e
 * é isso que permite ao balcão encontrar a campanha pelo código do cupom sem
 * rede. O PDV nunca sabe o `campaignId` — nem aqui, nem na fila, nem no payload
 * da venda: quem fotografa o vínculo é o servidor, na gravação.
 *
 * ## Onde os cupons moram, e por quê
 *
 * Numa chave da store `meta`, não numa store própria. Store nova exigiria
 * `DATABASE_VERSION` 3, e a migração apagaria `products`, `paymentMethods` e
 * `customers` de **todo caixa da rede** na primeira abertura depois do deploy
 * (armadilha 4 do CLAUDE.md). O preço da escolha é que `clearLocalCatalog`
 * precisa apagar esta chave à mão, porque `meta` é uma store preservada.
 *
 * ## O que este módulo NÃO faz
 *
 * **Não recusa venda por limite estourado.** Limite de cupom é orçamento de
 * marketing, não estoque: o cliente já está no balcão com o panfleto, e recusar
 * ali por um contador que nem é a verdade corrente custaria a venda inteira. O
 * estouro sobe na fila, o servidor carimba `over_limit` no resgate e o relatório
 * da campanha mostra o que aconteceu. {@link LocalCouponFound.overLimit} existe
 * para a tela **avisar**, nunca para bloquear.
 */

/**
 * Folga aceita entre o relógio do caixa e a hora do servidor, em milissegundos.
 *
 * Sem folga, um caixa três segundos atrás do servidor recusaria todo cupom do
 * turno — a marca do snapshot é gravada pelo servidor e lida por um relógio que
 * nunca está perfeitamente sincronizado com ele. O cenário que a conferência
 * existe para pegar (RTC gasto depois de queda de energia) erra por horas ou por
 * anos, não por segundos.
 */
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Converte um cupom do snapshot no registro da base local.
 *
 * Normaliza na **carga**, não na consulta, pelo mesmo motivo do `searchName` do
 * produto: o balcão consulta a cada tecla e a carga acontece uma vez por turno.
 * Duas normalizações importam aqui — o código vira maiúsculas (o operador digita
 * "bemvindo" e o cadastro é "BEMVINDO") e o tipo de desconto vira o código
 * numérico do enum (a API serializa pelo nome, e comparar contra
 * `COUPON_DISCOUNT_TYPE` no balcão daria falso a cada consulta).
 */
export function toLocalCoupon(coupon: PdvSnapshotCoupon): LocalCoupon {
  return {
    couponId: coupon.couponId,
    code: (coupon.code ?? "").trim().toUpperCase(),
    description: coupon.description ?? null,
    discountType: enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE),
    discountValue: coupon.discountValue,
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil ?? null,
    // `?? null` é obrigatório: nulo aqui significa ILIMITADO, e o backend omite
    // campo nulo do JSON. Ler a ausência como zero esgotaria todo cupom sem teto.
    remainingAtSnapshot: coupon.remainingAtSnapshot ?? null,
    questions: coupon.questions ?? [],
  };
}

/**
 * Grava a lista de cupons da base local, substituindo por inteiro a anterior.
 *
 * @param coupons Cupons do snapshot recém-instalado, ou `null` quando o snapshot
 *   não trouxe a lista (backend anterior a esta feature). Gravar `null` **apaga**
 *   a lista velha de propósito: o snapshot substitui o cadastro por inteiro, e
 *   uma lista sobrevivente validaria cupom que o servidor já não conhece.
 */
export function writeLocalCoupons(coupons: LocalCoupon[] | null): Promise<void> {
  return writeMeta(META_KEY.coupons, coupons);
}

/**
 * Lê os cupons da base local.
 *
 * @returns A lista, ou `null` quando este caixa não sabe nada sobre cupons.
 *   Lista vazia e `null` são coisas diferentes: vazio é "esta loja não tem cupom
 *   vigente", `null` é "não dá para responder sem internet".
 */
export function readLocalCoupons(): Promise<LocalCoupon[] | null> {
  return readMeta<LocalCoupon[]>(META_KEY.coupons);
}

/**
 * Conta, por cupom, os resgates que já estão na fila local e o servidor ainda
 * não conhece.
 *
 * Pura, para poder ser testada sem IndexedDB.
 *
 * Só entram as vendas `pending`. Uma venda `failed` foi **recusada pelo
 * servidor**: nenhum resgate foi gravado e nenhum uso foi consumido, então
 * contá-la subestimaria o saldo do cupom. Se o operador a reenfileirar, ela
 * volta a `pending` e volta a contar.
 *
 * @param sales Fila de vendas locais.
 * @returns Quantos usos cada cupom já tem enfileirados.
 */
export function countQueuedRedemptions(sales: PendingSale[]): Map<number, number> {
  const byCoupon = new Map<number, number>();

  for (const sale of sales) {
    if (sale.status !== "pending") continue;

    const couponId = sale.coupon?.couponId;
    if (couponId == null) continue;

    byCoupon.set(couponId, (byCoupon.get(couponId) ?? 0) + 1);
  }

  return byCoupon;
}

/** Por que a consulta local não pôde responder o cupom. */
export type LocalCouponRefusal =
  /** Este caixa não tem lista de cupons: snapshot antigo, ou base nunca baixada. */
  | "unavailable"
  /** O relógio da máquina está atrás da hora do servidor — ver {@link resolveLocalCoupon}. */
  | "unreliable-clock"
  | "not-found"
  | "not-yet-valid"
  | "expired";

/** O cupom foi encontrado e está vigente pelo que a base local sabe. */
export interface LocalCouponFound {
  outcome: "found";
  coupon: LocalCoupon;
  /**
   * Usos restantes segundo a base local: `remainingAtSnapshot` menos os resgates
   * já enfileirados aqui. `null` = ilimitado. Nunca negativo — o estouro vira
   * {@link overLimit}.
   *
   * **É estimativa, não saldo.** Outro caixa pode ter consumido usos desde a
   * geração do snapshot, e nada nesta consulta reserva coisa alguma.
   */
  remainingUses: number | null;
  /**
   * O limite conhecido já se esgotou e este resgate entraria por cima dele.
   *
   * **A venda segue mesmo assim.** É aviso para a tela, não bloqueio: o servidor
   * carimba `over_limit = true` no resgate quando a fila subir.
   */
  overLimit: boolean;
}

/** A consulta local não pôde responder, com a mensagem pronta para o balcão. */
export interface LocalCouponRefused {
  outcome: "refused";
  reason: LocalCouponRefusal;
  /** Texto para mostrar ao operador, no tom das recusas que o servidor devolve. */
  message: string;
}

/** Desfecho da consulta local de um cupom. */
export type LocalCouponLookup = LocalCouponFound | LocalCouponRefused;

/** Tudo o que a decisão precisa, para que ela possa ser pura. */
export interface LocalCouponLookupInput {
  /** Cupons da base local, ou `null` quando o snapshot não trouxe a lista. */
  coupons: LocalCoupon[] | null;
  /** Código digitado ou lido do panfleto, ainda não normalizado. */
  code: string;
  /** Agora, pelo relógio da máquina do caixa. */
  now: Date;
  /** `snapshotGeneratedAt`: a hora do SERVIDOR gravada na instalação do snapshot. */
  generatedAt: string | null;
  /** Resgates já enfileirados localmente, de {@link countQueuedRedemptions}. */
  queued: Map<number, number>;
}

/** Data e hora no tom do balcão — "30/09/2026 às 23:59". */
function describeInstant(value: string): string {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatShortDate(value)} às ${hours}:${minutes}`;
}

/** Recusa com mensagem pronta para o operador. */
function refuse(reason: LocalCouponRefusal, message: string): LocalCouponRefused {
  return { outcome: "refused", reason, message };
}

/**
 * Decide o que a base local responde sobre um cupom. Pura, para poder ser
 * testada sem IndexedDB e sem mexer no relógio do sistema.
 *
 * ## Sanidade de relógio
 *
 * Toda a vigência do cupom é conferida contra o relógio da máquina, que é o
 * único que existe sem internet. `snapshotGeneratedAt` é a **hora do servidor**
 * gravada na instalação, e serve de piso: se o relógio local está antes dela, ele
 * está mentindo, porque aquele instante já aconteceu. É o cenário da queda de
 * energia com a bateria do RTC gasta — a máquina reinicia em 2010 e todo cupom
 * passa a parecer "ainda não vigente" (ou, pior, um cupom expirado volta a
 * valer). Nesse caso a validação offline é recusada por inteiro.
 *
 * **Relógio ADIANTADO continua indetectável, e isso não é disfarçado.** Não
 * existe teto para comparar: descobrir que o relógio está à frente exige
 * perguntar a hora a alguém, e perguntar exige rede — que é justamente o que não
 * há aqui. Um caixa adiantado aceita um cupom já vencido, a venda sobe na fila e
 * o servidor **não a recusa**: o cliente já pagou, então o resgate é gravado com
 * `definition_drift` e a divergência aparece na reconciliação e no relatório da
 * campanha. Perder a venda paga seria pior que registrar o desvio.
 *
 * A conferência do relógio vem **antes** da busca pelo código: numa máquina com
 * a data errada, "cupom não encontrado" mandaria o operador procurar o problema
 * no panfleto do cliente em vez de no relógio.
 */
export function resolveLocalCoupon(input: LocalCouponLookupInput): LocalCouponLookup {
  const { coupons, now, generatedAt, queued } = input;

  // `== null` em todo este arquivo, e não `=== null`: a base local guarda o que
  // uma versão anterior do PDV gravou, e um campo omitido volta como `undefined`.
  if (coupons == null) {
    return refuse(
      "unavailable",
      "Este caixa não tem a lista de cupons na base local. Sem internet não é possível validar o cupom!",
    );
  }

  // Sem a marca do servidor não há piso para conferir o relógio, e validar
  // vigência com um relógio sem âncora é o mesmo que não conferir nada.
  if (generatedAt == null) {
    return refuse(
      "unavailable",
      "A base local deste caixa está sem data de atualização. Sem internet não é possível validar o cupom!",
    );
  }

  if (now.getTime() < new Date(generatedAt).getTime() - CLOCK_TOLERANCE_MS) {
    return refuse(
      "unreliable-clock",
      "O relógio deste computador está atrasado. Acerte a data e a hora para usar cupom sem internet!",
    );
  }

  const code = input.code.trim().toUpperCase();
  const coupon = coupons.find((item) => item.code === code);

  if (!coupon) return refuse("not-found", "Cupom não encontrado!");

  if (now.getTime() < new Date(coupon.validFrom).getTime()) {
    return refuse("not-yet-valid", `Cupom válido a partir de ${describeInstant(coupon.validFrom)}!`);
  }

  if (coupon.validUntil != null && now.getTime() > new Date(coupon.validUntil).getTime()) {
    return refuse("expired", `Cupom expirado em ${describeInstant(coupon.validUntil)}!`);
  }

  // `remainingAtSnapshot` nulo é ILIMITADO. Ler o nulo como zero recusaria todo
  // cupom sem teto — que é a maioria deles.
  if (coupon.remainingAtSnapshot == null) {
    return { outcome: "found", coupon, remainingUses: null, overLimit: false };
  }

  const remaining = coupon.remainingAtSnapshot - (queued.get(coupon.couponId) ?? 0);

  return {
    outcome: "found",
    coupon,
    remainingUses: Math.max(0, remaining),
    overLimit: remaining <= 0,
  };
}

/**
 * Consulta um cupom na base local pelo código. É o caminho que a tela do balcão
 * usa quando a API está fora do ar, no lugar de `lookupPdvCoupon`.
 *
 * O cupom volta com o questionário já resolvido — a campanha é encontrada pelo
 * código, sem rede e sem que o PDV saiba que ela existe.
 *
 * @param code Código digitado ou lido do panfleto.
 * @returns O cupom com a estimativa de usos restantes, ou a recusa com mensagem
 *   pronta para o operador. **Nunca lança** por cupom inválido: recusa de cupom é
 *   acontecimento normal do balcão, não erro.
 */
export async function lookupLocalCoupon(code: string): Promise<LocalCouponLookup> {
  const [coupons, generatedAt, sales] = await Promise.all([
    readLocalCoupons(),
    readMeta<string>(META_KEY.snapshotGeneratedAt),
    listPendingSales(),
  ]);

  return resolveLocalCoupon({
    coupons,
    code,
    now: new Date(),
    generatedAt,
    queued: countQueuedRedemptions(sales),
  });
}
