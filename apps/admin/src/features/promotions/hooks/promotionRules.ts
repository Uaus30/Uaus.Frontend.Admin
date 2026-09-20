import { parseAmountOrNull, toDateKey } from "@workspace/core";
import {
  PROMOTION_DISCOUNT_TYPE,
  PROMOTION_TYPE,
  enumCode,
  type PromotionDto,
} from "@workspace/api-client-react";
import type { PromotionArtwork, PromotionForm, PromotionSituation, SavePromotionPayload } from "../types";

/**
 * As regras puras das promoções: composição dos instantes, situação, validação e
 * montagem do payload.
 *
 * Mora fora do controlador pelo mesmo motivo de `campaignRules.ts`: sem React,
 * testável sem montar nada, e é o que permite o hook caber no teto de 300 linhas.
 */

/** Hora padrão do início: o dia escolhido conta desde o primeiro minuto. */
export const DEFAULT_START_TIME = "00:00";

/**
 * Hora padrão do fim: o último minuto do dia, inclusivo.
 *
 * A loja fecha às 18h e o site anuncia a contagem até lá (fase 4), mas a VIGÊNCIA
 * vai até o fim do dia de propósito — decisão do dono em 18/09/2026: se às 18h05
 * ainda houver fila, a promoção continua valendo no caixa, e o preço não muda
 * embaixo de quem já está na loja.
 */
export const DEFAULT_END_TIME = "23:59";

/**
 * Compõe o instante `"yyyy-MM-ddTHH:mm:ss"` que o backend espera.
 *
 * O dia sai de `toDateKey` (componentes locais) e NUNCA de `toISOString()`, que
 * converte para UTC e, em qualquer horário antes das 21h no Brasil, gravaria a
 * promoção começando na véspera do dia escolhido.
 *
 * Os segundos são fixos por extremidade: `00` no início, `59` no fim. As duas
 * pontas são inclusivas e a granularidade oferecida é o minuto — um fim às 18:00
 * significa "até o fim de 18:00", e não "às 18:00:00 em ponto", que deixaria 59
 * segundos de promoção fora da conta.
 *
 * É o mesmo padrão de `campaignRules.ts`, repetido aqui de propósito: são duas
 * ocorrências, e a regra do repositório é que duas não são duplicata. Na terceira
 * isto sobe para o `packages/core` e campanhas migra junto.
 */
function composeInstant(date: Date, time: string, seconds: "00" | "59"): string {
  const [hour = "00", minute = "00"] = time.split(":");
  return `${toDateKey(date)}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${seconds}`;
}

/** Instante do início da vigência. */
export function toStartInstant(date: Date, time: string): string {
  return composeInstant(date, time || DEFAULT_START_TIME, "00");
}

/** Instante do fim da vigência, inclusivo até o último segundo do minuto escolhido. */
export function toEndInstant(date: Date, time: string): string {
  return composeInstant(date, time || DEFAULT_END_TIME, "59");
}

/**
 * Lê o dia de um instante da API montando o `Date` pelos componentes.
 *
 * `new Date("2026-09-19T14:00:00")` funcionaria hoje, mas basta o backend um dia
 * acrescentar `Z` para a mesma string virar UTC e o calendário abrir no dia
 * anterior. Recortar a string tira essa dependência.
 */
export function instantToDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

/** Lê a hora `"HH:mm"` de um instante da API, ou devolve o padrão. */
export function instantToTime(value: string | null | undefined, fallback: string): string {
  if (!value || value.length < 16) return fallback;
  return value.slice(11, 16);
}

/** Instante local de agora, no mesmo formato dos campos da API — comparável como string. */
export function nowInstant(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${toDateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Situação da promoção agora.
 *
 * A comparação é feita sobre as STRINGS dos instantes, porque
 * `"yyyy-MM-ddTHH:mm:ss"` ordena como data — o mesmo truque de `campaignRules`.
 * Comparar por dia deixaria passar uma relâmpago das 14h às 18h como "no ar" às
 * 20h do mesmo dia.
 */
export function promotionSituation(promotion: PromotionDto, now?: Date): PromotionSituation {
  if (!promotion.isActive) return "inativa";

  const agora = nowInstant(now);

  if (promotion.validFrom > agora) return "programada";
  if (promotion.validUntil != null && promotion.validUntil < agora) return "encerrada";

  return "no-ar";
}

/** Formulário vazio: Dia a Dia percentual começando hoje, sem prazo. */
export function emptyPromotionForm(today: Date = new Date()): PromotionForm {
  return {
    productGroupId: null,
    productGroupName: "",
    type: PROMOTION_TYPE.Everyday,
    discountType: PROMOTION_DISCOUNT_TYPE.Percentage,
    discountValue: "",
    startDate: today,
    startTime: DEFAULT_START_TIME,
    endDate: today,
    endTime: DEFAULT_END_TIME,
    noEndDate: true,
    maxQuantityPerSale: "",
    targetQuantity: "",
    isActive: true,
    showOnSite: false,
    feedImage: null,
    storyImage: null,
  };
}

/** Preenche o formulário a partir de uma promoção existente. */
export function formFromPromotion(promotion: PromotionDto): PromotionForm {
  return {
    productGroupId: promotion.productGroupId,
    productGroupName: promotion.productGroupName,
    type: (enumCode(promotion.type, PROMOTION_TYPE) ?? PROMOTION_TYPE.Everyday) as PromotionForm["type"],
    discountType: (enumCode(promotion.discountType, PROMOTION_DISCOUNT_TYPE) ??
      PROMOTION_DISCOUNT_TYPE.Percentage) as PromotionForm["discountType"],
    discountValue: String(promotion.discountValue ?? "").replace(".", ","),
    startDate: instantToDate(promotion.validFrom),
    startTime: instantToTime(promotion.validFrom, DEFAULT_START_TIME),
    endDate: instantToDate(promotion.validUntil) ?? instantToDate(promotion.validFrom),
    endTime: instantToTime(promotion.validUntil, DEFAULT_END_TIME),
    noEndDate: promotion.validUntil == null,
    maxQuantityPerSale: promotion.maxQuantityPerSale == null ? "" : String(promotion.maxQuantityPerSale),
    targetQuantity: promotion.targetQuantity == null ? "" : String(promotion.targetQuantity),
    isActive: promotion.isActive,
    showOnSite: promotion.showOnSite,
    feedImage: artworkFromPromotion(promotion.feedImageId, promotion.feedImageUrl),
    storyImage: artworkFromPromotion(promotion.storyImageId, promotion.storyImageUrl),
  };
}

/**
 * A arte gravada, como o formulário a carrega.
 *
 * `url` ausente COM id presente e significa "a imagem sumiu do catálogo": a
 * associação sobrevive à remoção do arquivo. O slot volta vazio em vez de
 * mostrar miniatura quebrada, e salvar de novo limpa o vínculo morto.
 */
function artworkFromPromotion(imageId?: number | null, url?: string | null): PromotionArtwork | null {
  if (imageId == null || !url) return null;
  return { imageId, url };
}

/**
 * O formulário de uma promoção NOVA copiada de outra.
 *
 * Copia produto, tipo, desconto, limite, meta e o horário; **não** copia a data.
 * A relâmpago da loja é semanal, então a data proposta é a **próxima ocorrência
 * do mesmo dia da semana** — repetir a de sábado passado num sábado que já
 * passou seria cadastro condenado, e obrigar a redigitar tudo é o que este
 * atalho existe para evitar.
 *
 * O Dia a Dia não tem dia da semana: ele começa hoje, que é quando alguém
 * decidiu repetir o patamar.
 *
 * `showOnSite` fica desligado de propósito: duas relâmpagos no banner não podem
 * se sobrepor, e herdar a marcação faria o salvamento voltar um 400 sobre uma
 * caixa que a pessoa não marcou.
 *
 * @param origem Promoção a copiar.
 * @param hoje Data de referência, injetada para o teste não depender do relógio.
 */
export function repeatFormFromPromotion(origem: PromotionDto, hoje: Date): PromotionForm {
  const base = formFromPromotion(origem);
  const relampago = enumCode(origem.type, PROMOTION_TYPE) === PROMOTION_TYPE.Flash;

  const inicio = relampago
    ? nextWeekdayOccurrence(base.startDate ?? hoje, hoje, base.endTime)
    : startOfDay(hoje);

  return {
    ...base,
    startDate: inicio,
    // Cópia, e não o mesmo objeto: `Date` é mutável, e um `setDate()` em qualquer
    // um dos dois campos moveria o outro junto, em silêncio.
    endDate: relampago ? new Date(inicio) : undefined,
    noEndDate: relampago ? false : true,
    isActive: true,
    showOnSite: false,
    // As artes NÃO são copiadas: a validade está escrita dentro da imagem
    // ("SOMENTE NESTE SÁBADO"), e herdá-la publicaria no grupo de WhatsApp um
    // cartaz com a data da semana passada. O prompt se regenera de graça.
    feedImage: null,
    storyImage: null,
  };
}

/** Meia-noite do dia informado, sem hora. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A próxima data, de hoje em diante, em que a janela copiada ainda cabe — no mesmo
 * dia da semana da original.
 *
 * Devolve HOJE quando hoje já é esse dia e o horário ainda não passou: a loja
 * cadastra a relâmpago no próprio sábado de manhã, e empurrar para o sábado
 * seguinte obrigaria a corrigir a data toda vez.
 *
 * **A hora entra na conta**, e não só o dia da semana. O dono confere a relâmpago
 * DEPOIS que ela acaba — é quando a aba Performance tem número, e a própria tela o
 * avisa de que "os números são parciais" enquanto ela está no ar. Às 19h40 de
 * sábado, uma cópia de 14h–18h caía em HOJE, passava na validação (que compara
 * datas) e no servidor (que compara datas), e a promoção nascia **Encerrada** — o
 * dono achando que tinha programado o sábado seguinte.
 *
 * @param original Dia da promoção copiada, de onde sai o dia da semana.
 * @param hoje Instante de referência, injetado para o teste não depender do relógio.
 * @param endTime Hora de fim copiada, `"HH:mm"` — é ela que diz se hoje ainda serve.
 */
function nextWeekdayOccurrence(original: Date, hoje: Date, endTime: string): Date {
  const alvo = startOfDay(hoje);
  const distancia = (original.getDay() - alvo.getDay() + 7) % 7;
  alvo.setDate(alvo.getDate() + distancia);

  if (distancia === 0 && toEndInstant(alvo, endTime) <= nowInstant(hoje)) {
    alvo.setDate(alvo.getDate() + 7);
  }

  return alvo;
}

/**
 * O que impede o formulário de ser enviado, em uma frase — ou `null`.
 *
 * As mesmas recusas do servidor, com a mesma redação: barrar aqui poupa uma ida
 * ao balcão do 400, e repetir a frase evita que a pessoa leia duas explicações
 * diferentes para o mesmo problema.
 *
 * O que NÃO é conferido aqui, porque a tela não tem como saber: sobreposição de
 * vigência, banner já ocupado e preço final acima do de tabela. Os três são do
 * servidor, e qualquer heurística local seria palpite sobre dado que a tela não
 * tem — a mesma regra que o editor de campanhas segue.
 */
export function describeFormProblem(
  form: PromotionForm,
  options: { isNew?: boolean; now?: Date } = {},
): string | null {
  if (!form.productGroupId) return "Escolha o produto da promoção.";

  // Campo VAZIO é cobrado antes de parsear: `parseAmountOrNull("")` devolve 0, e
  // como zero é um desconto legítimo no Dia a Dia (a isca), sem esta linha quem
  // esquecesse de digitar salvaria uma promoção de 0% sem perceber. A função
  // separa "digitou bobagem" de "digitou número", não "não digitou" de "zero".
  if (!form.discountValue.trim()) return "Informe o valor do desconto.";

  const value = parseAmountOrNull(form.discountValue);
  if (value == null) return "Informe um valor de desconto válido.";
  if (value < 0) return "O valor do desconto não pode ser negativo.";

  if (form.discountType === PROMOTION_DISCOUNT_TYPE.Percentage && value > 90)
    return "O desconto percentual não pode passar de 90%.";

  if (form.type === PROMOTION_TYPE.Flash && value <= 0)
    return "Uma promoção relâmpago precisa de um desconto maior que zero.";

  // Percentual zero é destaque sem corte de preço (a isca da porta); PREÇO final
  // zero é outra coisa, e gravaria o produto a R$ 0,00 no balcão.
  if (form.discountType === PROMOTION_DISCOUNT_TYPE.FinalPrice && value <= 0)
    return "O preço promocional tem que ser maior que zero.";

  if (Number.isNaN(parsePositiveIntegerOrNaN(form.maxQuantityPerSale)))
    return "O limite por venda tem que ser um número inteiro de unidades.";

  if (Number.isNaN(parsePositiveIntegerOrNaN(form.targetQuantity)))
    return "A meta tem que ser um número inteiro de unidades.";

  if (!form.startDate) return "Informe o dia da promoção.";

  if (form.type === PROMOTION_TYPE.Flash) {
    // A relâmpago é de UM dia: o fim herda o dia do início, e o que se escolhe é
    // só o intervalo de horário dentro dele.
    if (toEndInstant(form.startDate, form.endTime) <= toStartInstant(form.startDate, form.startTime))
      return "O fim da promoção relâmpago tem que ser depois do início.";

    const agora = options.now ?? new Date();

    if (toDateKey(form.startDate) < toDateKey(agora))
      return "A promoção relâmpago tem que ser de hoje ou de um dia futuro.";

    // A hora também conta — mas SÓ no cadastro novo.
    //
    // Às 19h40 de sábado, "Nova promoção" já vem com a data de hoje: escolher
    // Relâmpago, digitar 14h–18h e salvar passava por esta validação (que compara
    // datas) e pelo servidor (que compara datas), e a promoção nascia "Encerrada".
    // Na EDIÇÃO a mesma recusa seria errada: corrigir a meta da relâmpago que
    // acabou de terminar é gesto legítimo, e travá-lo trancaria o cadastro.
    if (options.isNew && toEndInstant(form.startDate, form.endTime) <= nowInstant(agora))
      return "Esta promoção relâmpago já teria terminado. Escolha outro dia ou outro horário.";

    return null;
  }

  if (!form.noEndDate) {
    if (!form.endDate) return "Informe o fim da vigência ou marque “sem prazo”.";

    if (toEndInstant(form.endDate, form.endTime) < toStartInstant(form.startDate, form.startTime))
      return "O fim da vigência não pode ser anterior ao início.";
  }

  return null;
}

/**
 * Monta o payload.
 *
 * A relâmpago compõe o fim com o dia do INÍCIO: é o que garante, do lado da tela,
 * a mesma regra que o `CHECK` do banco cobra — começar e terminar no mesmo dia.
 * Deixar o fim sair do `endDate` abriria a porta para uma relâmpago das 23h de
 * sábado às 4h de domingo, que passa pelo teto de 24 horas e cai num dia em que a
 * loja nem abre.
 *
 * Números vazios viram `null`, não zero: `maxQuantityPerSale: 0` e "sem limite"
 * são a mesma coisa para o servidor, mas mandar zero faria a intenção depender de
 * uma normalização remota em vez de estar escrita aqui.
 */
export function buildPromotionPayload(
  form: PromotionForm,
  artworks: { feedImageId: number | null; storyImageId: number | null } = {
    feedImageId: form.feedImage?.imageId ?? null,
    storyImageId: form.storyImage?.imageId ?? null,
  },
): SavePromotionPayload {
  const startDate = form.startDate ?? new Date();
  const isFlash = form.type === PROMOTION_TYPE.Flash;

  // O intervalo de horário é do RELÂMPAGO. O Dia a Dia é um patamar: vale o dia
  // inteiro, e a tela nem mostra o campo. Compor com o que estiver no
  // formulário faria um patamar começar às 14h caso a pessoa tivesse passado
  // pelo tipo Relâmpago antes de decidir — com o campo já fora da tela para ela
  // desfazer.
  const startTime = isFlash ? form.startTime : DEFAULT_START_TIME;
  const endTime = isFlash ? form.endTime : DEFAULT_END_TIME;

  const validUntil = isFlash
    ? toEndInstant(startDate, endTime)
    : form.noEndDate
      ? null
      : toEndInstant(form.endDate ?? startDate, endTime);

  return {
    productGroupId: form.productGroupId ?? 0,
    type: form.type,
    discountType: form.discountType,
    discountValue: parseAmountOrNull(form.discountValue) ?? 0,
    validFrom: toStartInstant(startDate, startTime),
    validUntil,
    maxQuantityPerSale: normalizeCount(form.maxQuantityPerSale),
    targetQuantity: normalizeCount(form.targetQuantity),
    isActive: form.isActive,
    // Banner é coisa de relâmpago, e o servidor recusa fora dela. Zerar aqui
    // evita que trocar o tipo com a caixa marcada devolva um 400 que a pessoa
    // não relaciona com a caixa.
    showOnSite: isFlash && form.showOnSite,
    // Os ids chegam RESOLVIDOS de quem salva: a arte escolhida e ainda não
    // enviada não tem id, e o upload acontece no salvamento. Nulo apaga o
    // vínculo, que é o que tirar a arte do formulário significa.
    feedImageId: artworks.feedImageId,
    storyImageId: artworks.storyImageId,
  };
}

/**
 * Inteiro positivo de um campo de texto, ou `null` quando o campo está VAZIO.
 *
 * Usa `parseAmountOrNull`, e não `Number`: `Number("1.000")` é **1** em
 * JavaScript, porque o ponto ali é separador decimal. O dono digitando "1.000"
 * na meta veria o investimento projetado mil vezes menor — e decidiria o preço
 * olhando esse número. O parser do `packages/core` entende o formato pt-BR.
 *
 * Texto inválido devolve `NaN` de propósito: quem chama distingue "não informou"
 * (null) de "digitou bobagem" (NaN) e cobra o segundo, em vez de gravar "sem
 * limite" em silêncio numa promoção cujo cartaz promete um limite.
 */
export function parsePositiveIntegerOrNaN(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = parseAmountOrNull(value);
  if (parsed == null || !Number.isInteger(parsed) || parsed <= 0) return Number.NaN;

  return parsed;
}

/**
 * O que vai no payload: inteiro positivo, ou `null` para "sem limite"/"sem meta".
 *
 * O `NaN` do parser já foi cobrado por `describeFormProblem`; aqui ele cai em
 * `null` como rede, porque `NaN` viaja no JSON como `null` de qualquer jeito — e
 * é melhor que isso seja decisão escrita do que acidente de serialização.
 */
function normalizeCount(value: string): number | null {
  const parsed = parsePositiveIntegerOrNaN(value);
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
}
