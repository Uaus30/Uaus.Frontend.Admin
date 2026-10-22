/**
 * Compras a fornecedor (`/Purchases`) — o PEDIDO, do registro ao lançamento.
 *
 * Não confundir com `purchases.ts`, que é a ENTRADA (`/PurchaseEntries`, a nota
 * que já chegou e mexe no estoque). A compra vem antes; o recebimento dela é o
 * que gera a entrada.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, EnumValue, QueryKey, UiPagedResult } from "../models";
import type { PlanTripProductDto, ReactivatedProductDto } from "./purchases";

/** Foto da compra, já com a URL para a tela (passe por `buildPublicImageUrl`). */
export interface PurchaseImageDto {
  imageId: number;
  url: string;
  displayOrder: number;
}

/**
 * Uma compra. Os unitários e o percentual são DERIVADOS pelo backend dos totais
 * gravados — nunca são digitados, então não divergem do total.
 *
 * Os campos anuláveis são OPCIONAIS de propósito: o backend serializa com
 * `WhenWritingNull`, então um nulo chega como campo AUSENTE (`undefined`), não
 * como `null`. Compare com `== null`, nunca com `=== null` — foi assim que o
 * "Lançar recebimento" de produto novo abriu o diálogo de produto vinculado.
 */
export interface PurchaseDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  supplierId: number;
  supplierName: string;
  /** Produto vinculado (reposição). Ausente/nulo quando o produto ainda não existe. */
  productId?: number | null;
  /** Grupo do produto vinculado — é ele que abre a tela de detalhe do produto. */
  productGroupId?: number | null;
  /**
   * O produto já tem variações? Com marca nova num produto SIMPLES (fase 4,
   * 14/10/2026), o recebimento pede a marca do cadastro atual, que vira a
   * primeira variação. Opcional por segurança de versão: ausente, trate como `true`.
   */
  groupHasVariations?: boolean;
  /**
   * Produto NOVO comprado já com variações (fase 5, 21/10/2026): o tipo da grade,
   * como NOME do enum ("Size"). Com ele o "Lançar recebimento" é a conferência que
   * cria o produto, e não o cadastro preenchido. Omitido nas demais compras e
   * depois do recebimento.
   */
  newVariationGradeType?: string | number | null;
  /**
   * Categoria do produto: a escolhida na compra (produto ainda não cadastrado)
   * ou a do GRUPO, com produto vinculado. O backend escolhe uma das duas — a
   * compra nunca guarda cópia da do grupo.
   *
   * O departamento sai dela pelo catálogo de categorias, como no editor de
   * produto: `categories.find(c => c.id === categoryId)?.departmentId`.
   */
  categoryId?: number | null;
  productName: string;
  /**
   * Código de barras: o do produto vinculado ou, em compra de produto ainda não
   * cadastrado, o digitado na compra (24/09/2026) — é com ele que o cadastro do
   * recebimento nasce. Ausente quando não há nenhum dos dois.
   */
  productBarcode?: string | null;
  /**
   * Nº da nota da compra (24/09/2026). Vai para a entrada de estoque no
   * recebimento. Ausente quando não foi informado.
   */
  invoiceNumber?: string | null;
  /**
   * Produtos que o RECEBIMENTO desta compra reativou. Só vem na resposta do
   * `receive`; em qualquer outra leitura a API omite o campo.
   */
  reactivatedProducts?: ReactivatedProductDto[];
  /**
   * Produtos cujo controle de estoque o RECEBIMENTO desligou com "Planejar
   * viagem" (14/10/2026). Só na resposta do `receive`; omitido quando vazio.
   */
  planTripProducts?: PlanTripProductDto[];
  /**
   * Preço de venda vigente do produto vinculado. Ausente em produto novo e em
   * compra com VARIAÇÕES, onde o cabeçalho não aponta para nenhuma delas.
   */
  productPrice?: number | null;
  details?: string | null;
  purchaseLink?: string | null;
  /**
   * Instruções de recebimento (22/10/2026): o recado de quem comprou para quem
   * vai receber — "vender avulso", "atualizar o código de barras". Ausente quando
   * não há; é a presença que acende o ícone da listagem.
   */
  receivingInstructions?: string | null;
  /**
   * Dia em que a compra foi feita, `yyyy-MM-ddT00:00:00` sem fuso. NÃO é
   * `createdAt`: o pedido costuma ser lançado no sistema depois de fechado, e é
   * esta data que a listagem ordena e exibe.
   */
  purchaseDate: string;
  quantity: number;
  grossTotal: number;
  /**
   * Total pago. Zero é "custo ainda não informado" — só compra pendente pode
   * estar assim; a tela mostra vazio, não R$ 0,00.
   */
  finalTotal: number;
  /**
   * Preço de venda pretendido, decidido junto com a compra. Ausente quando não
   * foi informado — aí o recebimento mantém o preço atual do produto.
   */
  suggestedPrice?: number | null;
  /** Bruto ÷ quantidade. */
  unitGross: number;
  /** Final ÷ quantidade — o custo unitário que a entrada grava. */
  unitFinal: number;
  /** (Final − Bruto) ÷ Bruto em %. Negativo é desconto; positivo, acréscimo. */
  adjustmentPercent: number;
  /** Enum PurchaseStatus — chega como NOME; leia com `enumCode(valor, PURCHASE_STATUS)`. */
  status: EnumValue;
  receivedAt?: string | null;
  purchaseEntryId?: number | null;
  userName?: string | null;
  /**
   * As fotos da compra.
   *
   * Com produto vinculado são a GALERIA DO GRUPO (13/09/2026): a modal de
   * compra exibe e edita a galeria do produto, e salvar replica lá. Por isso a
   * listagem mostra sempre a foto que o produto tem hoje.
   */
  images: PurchaseImageDto[];
  /** As variações compradas. Com uma só, é o espelho do cabeçalho. */
  items: PurchaseItemDto[];
  /** Quem é a fonte da verdade do custo — ver `SavePurchasePayload.costSplitManual`. */
  costSplitManual: boolean;
}

/**
 * Uma variação comprada.
 *
 * Sempre ao menos uma: a compra de um produto simples é um item só, e é assim
 * que as compras anteriores a 12/09/2026 foram convertidas.
 */
export interface PurchaseItemDto {
  id: number;
  /** Ausente só na compra de produto que ainda não existe no cadastro. */
  productId?: number | null;
  /** Nome COMPOSTO da variação ("CAMISETA [AZUL]"). Vazio em produto novo. */
  productName: string;
  barcode?: string | null;
  quantity: number;
  grossTotal: number;
  /** Fatia do total pago — dela sai o custo unitário do lote desta variação. */
  finalTotal: number;
  /** Saldo atual da variação, para a grade mostrar "X → X+N". */
  stock: number;
  /** Derivado: `finalTotal` ÷ `quantity`. Nunca é gravado. */
  unitFinal: number;
  /**
   * Marca NOVA (fase 4): a linha ainda sem cadastro, que nasce no recebimento com
   * o código bipado ou gerado. Depois do recebimento continua aqui, como registro
   * — aí `productId` já aponta para o cadastro criado.
   */
  newBrand?: string | null;
  /** O código da marca nova ou da variação do produto novo, se já se sabia na compra. */
  newBarcode?: string | null;
  /**
   * O valor da grade da linha na compra de produto NOVO com variações (fase 5):
   * "P", "AZUL". Ainda sem cadastro até o recebimento; depois fica como registro.
   */
  newValue?: string | null;
}

/** Uma linha da grade, como a tela a envia. */
export interface SavePurchaseItemPayload {
  /** Nulo em produto novo (um item só) e na linha de marca nova. */
  productId: number | null;
  /** Marca nova de um produto que existe ("+ Nova variação (marca)"). Só com `productId` nulo. */
  newBrand?: string | null;
  /** Código da marca nova ou da variação do produto novo, se já se sabe. Opcional: o recebimento o exige. */
  newBarcode?: string | null;
  /** Valor da grade do produto NOVO com variações (fase 5). Só com `productId` nulo. */
  newValue?: string | null;
  /** Zero é "não comprei esta variação" — o backend descarta a linha. */
  quantity: number;
  /** Ignorados em rateio (o padrão), que é quando o backend os deriva. */
  grossTotal: number;
  finalTotal: number;
}

/** Cadastro e edição — o mesmo corpo, porque a edição é total. */
export interface SavePurchasePayload {
  supplierId: number;
  productId: number | null;
  /**
   * O produto (grupo) da compra. É como a compra SÓ de marca nova sabe de que
   * produto é; com item vinculado, tem que ser o grupo dele.
   */
  productGroupId?: number | null;
  /**
   * Produto NOVO já com variações (fase 5): o código do tipo da grade
   * (`GRADE_TYPE`), um só. Cada item traz o valor em `newValue`.
   */
  newVariationGradeType?: number | null;
  /**
   * Categoria do produto a comprar. **Obrigatória sem produto vinculado** — é
   * ela que o cadastro gerado no recebimento recebe pronto. Com produto
   * vinculado o backend a ignora e usa a do grupo.
   */
  categoryId: number | null;
  /** Obrigatório sem `productId`; com produto vinculado o backend usa o nome do cadastro. */
  productName: string;
  /**
   * Código de barras do produto a comprar, como foi DIGITADO — o backend o
   * converte pela mesma regra do cadastro de produto (EAN-13 inteiro ou até 11
   * dígitos para código interno). Só vale sem produto vinculado; com produto,
   * o código é o do cadastro e este campo é ignorado. Nulo é "sem código".
   */
  productBarcode: string | null;
  /** Nº da nota. Opcional; vai para a entrada de estoque no recebimento. */
  invoiceNumber: string | null;
  details: string | null;
  purchaseLink: string | null;
  /** Instruções de recebimento, até 1000 caracteres. Nulo é "sem instrução". */
  receivingInstructions?: string | null;
  /** `yyyy-MM-ddT00:00:00`, sem fuso. Nulo é hoje. */
  purchaseDate: string | null;
  quantity: number;
  /**
   * Total sem desconto nem acréscimo. Obrigatório (> 0) fora de Pendente desde
   * 24/09/2026 — é o número que o operador digita primeiro, e o final nasce igual
   * a ele. Em Pendente, zero é "não informei".
   */
  grossTotal: number;
  /**
   * Total pago — o custo. Obrigatório (> 0) fora de Pendente; o backend recusa
   * "A caminho" e o recebimento sem ele, porque é daqui que sai o custo da entrada.
   */
  finalTotal: number;
  /** Preço de venda pretendido. Nulo mantém o preço atual do produto no recebimento. */
  suggestedPrice: number | null;
  /** Código de PurchaseStatus: Pendente (1) ou A caminho (2). */
  status: number;
  /**
   * Ids de `images` já enviadas, na ordem de exibição — a primeira é a capa.
   *
   * Com produto vinculado esta lista **vira a galeria do GRUPO** na mesma
   * transação (13/09/2026): a modal de compra edita a galeria do produto. Lista
   * vazia esvazia a galeria na EDIÇÃO; no cadastro ela não mexe em nada, porque
   * compra nasce sem foto o tempo todo.
   */
  imageIds: number[];
  /**
   * A grade de variações. Vazia mantém o corpo ANTIGO valendo — a compra de um
   * produto só, descrita por `productId`, `quantity` e os totais.
   */
  items: SavePurchaseItemPayload[];
  /**
   * `false` (padrão) = rateio: os totais do PEDIDO mandam e a fatia de cada
   * variação é derivada. `true` = o inverso, e o cabeçalho vira a soma.
   *
   * É GRAVADO de propósito: sem ele, reabrir uma compra cujo rateio foi digitado
   * à mão e mexer numa quantidade redistribuiria tudo em silêncio.
   */
  costSplitManual: boolean;
}

/** Uma variação conferida no recebimento. */
export interface ReceivePurchaseItemPayload {
  /** A variação que já tem cadastro. Nulo na linha de marca nova. */
  productId: number | null;
  /** A linha de MARCA NOVA da compra: o cadastro dela nasce neste recebimento. */
  purchaseItemId?: number | null;
  /** O código bipado da marca nova. Vazio exige `generateBarcode`. */
  barcode?: string | null;
  /** "Gerar código": a peça não tem código de barras. */
  generateBarcode?: boolean;
  /** Zero tira a variação do recebimento — ela não veio. */
  quantity: number;
  /** Fatia do total pago que cabe a esta variação. */
  finalTotal: number;
}

/**
 * Recebimento de compra com produto vinculado — que é também a CONFERÊNCIA.
 *
 * Quem compra caixa sortida registra a grade no chute e só sabe o que veio
 * quando abre a embalagem, então o recebimento corrige a grade.
 */
export interface ReceivePurchasePayload {
  /** `yyyy-MM-ddT00:00:00`, sem fuso. Nulo é hoje. */
  entryDate?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  /** Preço de venda a aplicar no cadastro. Nulo mantém o atual. */
  price?: number | null;
  /**
   * A marca do cadastro que JÁ existe, quando a compra traz marca nova de um
   * produto SIMPLES: ele vira a primeira variação e precisa de uma.
   */
  currentBrand?: string | null;
  /** A grade conferida. Vazia mantém a da compra. */
  items?: ReceivePurchaseItemPayload[];
  /**
   * "Código de barras mudou?" (22/10/2026): o código novo de uma variação já
   * cadastrada da compra. Sem venda, o backend só troca o código; com venda, o
   * cadastro fica com o antigo como a marca "M1" (M2…) e as unidades desta compra
   * entram na variação nova, com o código novo.
   */
  barcodeChanges?: ReceiveBarcodeChangePayload[];
  /**
   * O total pago, se mudou. Nulo mantém o da compra — e aí a soma dos itens
   * precisa fechar com ele, senão o backend recusa dizendo a diferença.
   */
  finalTotal?: number | null;
}

/** O código novo de uma variação da compra, bipado no recebimento. */
export interface ReceiveBarcodeChangePayload {
  productId: number;
  /** Como foi bipado ou digitado; o backend converte pela regra do cadastro de produto. */
  barcode: string;
}

/** Fechamento de compra de produto NOVO, depois do cadastro e da entrada. */
export interface MarkPurchaseReceivedPayload {
  productId: number;
  purchaseEntryId?: number | null;
}

/**
 * Prefixo do recurso. A lista fica sob `["purchases", "page", params]` e o item
 * sob `["purchases", "item", id]`: invalidar o prefixo alcança os dois.
 */
export const getGetPurchasesQueryKey = (): QueryKey => ["purchases"];

export interface PurchasesParams {
  /** Código de PurchaseStatus. */
  status?: number;
  /**
   * Só as NÃO lançadas (Pendente e A caminho) — o padrão da tela de Compras.
   * Soma-se ao `status`, não o substitui.
   */
  onlyOpen?: boolean;
  supplierId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/** Página de compras, mais recentes primeiro. */
export function useGetPurchases(
  params?: PurchasesParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PurchaseDto>, ApiError, UiPagedResult<PurchaseDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PurchaseDto>, ApiError, UiPagedResult<PurchaseDto>, QueryKey>({
    queryKey: [...getGetPurchasesQueryKey(), "page", params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<PurchaseDto>>("/Purchases", {
        status: params?.status,
        // Só viaja quando é verdadeiro: `false` é o padrão da API.
        onlyOpen: params?.onlyOpen ? true : undefined,
        supplierId: params?.supplierId,
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export interface PurchaseSummaryDto {
  /** Compras Pendentes — anotadas, ainda não compradas. */
  pending: number;
  /** Compras A caminho — compradas, ainda não recebidas. */
  inTransit: number;
}

export const getGetPurchasesSummaryQueryKey = (): QueryKey => [...getGetPurchasesQueryKey(), "summary"];

/**
 * Contagem das compras em aberto, por situação — o aviso do painel.
 *
 * Um minuto de `staleTime`, como o resumo do estoque baixo: o número muda
 * quando alguém registra ou recebe uma compra, não a cada troca de tela.
 */
export function useGetPurchasesSummary(options?: {
  query?: Omit<
    UseQueryOptions<PurchaseSummaryDto, ApiError, PurchaseSummaryDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<PurchaseSummaryDto, ApiError, PurchaseSummaryDto, QueryKey>({
    queryKey: getGetPurchasesSummaryQueryKey(),
    queryFn: () => apiGetOrThrow<PurchaseSummaryDto>("/Purchases/summary"),
    staleTime: 60_000,
    ...options?.query,
  });
}

/** Uma compra pelo id. É o que a tela de produto usa para abrir o cadastro preenchido (`?compra=`). */
export function getPurchase(id: number): Promise<PurchaseDto> {
  return apiGetOrThrow<PurchaseDto>(`/Purchases/${id}`);
}

export async function createPurchase(payload: SavePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>("/Purchases", payload);
  if (!response.data) throw new Error("Não foi possível registrar a compra.");
  return response.data;
}

export async function updatePurchase(id: number, payload: SavePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPut<PurchaseDto>(`/Purchases/${id}`, payload);
  if (!response.data) throw new Error("Não foi possível atualizar a compra.");
  return response.data;
}

/** Pendente ↔ A caminho. "Lançado" só pelo recebimento. */
export async function updatePurchaseStatus(id: number, status: number): Promise<PurchaseDto> {
  const response = await apiPut<PurchaseDto>(`/Purchases/${id}/status`, { status });
  if (!response.data) throw new Error("Não foi possível alterar a situação da compra.");
  return response.data;
}

export async function deletePurchase(id: number): Promise<void> {
  await apiDelete<null>(`/Purchases/${id}`);
}

/**
 * Recebimento de compra com produto vinculado: o backend grava a entrada de
 * estoque com a quantidade e o custo da compra e marca como lançada, numa
 * transação. A chave de idempotência é da própria compra — repetir não duplica.
 */
export async function receivePurchase(id: number, payload: ReceivePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>(`/Purchases/${id}/receive`, payload);
  if (!response.data) throw new Error("Não foi possível receber a compra.");
  return response.data;
}

/** Fecha uma compra de produto NOVO depois que o cadastro e a entrada foram feitos. */
export async function markPurchaseReceived(
  id: number,
  payload: MarkPurchaseReceivedPayload,
): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>(`/Purchases/${id}/mark-received`, payload);
  if (!response.data) throw new Error("Não foi possível lançar a compra.");
  return response.data;
}
