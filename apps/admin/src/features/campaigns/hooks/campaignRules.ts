/**
 * Regras puras da campanha: instantes do período, rascunhos do questionário,
 * validação e montagem do payload.
 *
 * Vive fora do `useCampaigns` porque nada aqui depende de React, de rede ou de
 * estado — e porque o controlador estouraria o teto de 300 linhas carregando
 * também estas funções. Precedente no repositório:
 * `features/products/hooks/editor/utils.ts`.
 */

import { toDateKey } from "@workspace/core";
import type { CampaignDto, CampaignQuestionDto, SaveCampaignPayload } from "@workspace/api-client-react";
import type { CampaignForm, CampaignQuestionDraft } from "../types";

/** Tetos do questionário. São os mesmos do `SaveCampaignRequest` do backend. */
export const MAX_QUESTIONS = 6;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;

/** Hora padrão do início: o dia escolhido conta desde o primeiro minuto. */
export const DEFAULT_START_TIME = "00:00";
/** Hora padrão do fim: o último minuto do dia, inclusivo. */
export const DEFAULT_END_TIME = "23:59";

/**
 * Compõe o instante `"yyyy-MM-ddTHH:mm:ss"` que o backend espera.
 *
 * O dia sai de `toDateKey` (componentes locais) e nunca de `toISOString()`, que
 * converte para UTC e, em qualquer horário antes das 21h no Brasil, gravaria a
 * campanha começando na véspera do dia escolhido.
 *
 * Os segundos são fixos por extremidade: `00` no início, `59` no fim. O período
 * é inclusivo nas duas pontas e a granularidade oferecida é o minuto — um fim
 * às 18:00 significa "até o fim de 18:00", e não "às 18:00:00 em ponto", que
 * deixaria 59 segundos de campanha fora do relatório.
 */
function composeInstant(date: Date, time: string, seconds: "00" | "59"): string {
  const [hour = "00", minute = "00"] = time.split(":");
  return `${toDateKey(date)}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${seconds}`;
}

/** Instante do início do período. */
export function toStartInstant(date: Date, time: string): string {
  return composeInstant(date, time || DEFAULT_START_TIME, "00");
}

/** Instante do fim do período, inclusivo até o último segundo do minuto escolhido. */
export function toEndInstant(date: Date, time: string): string {
  return composeInstant(date, time || DEFAULT_END_TIME, "59");
}

/**
 * Lê o dia de um instante da API montando o `Date` pelos componentes.
 *
 * `new Date("2026-09-30T00:00:00")` funcionaria hoje, mas basta o backend um
 * dia acrescentar `Z` para a mesma string virar UTC e o calendário abrir no dia
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
 * A campanha está no ar agora?
 *
 * Vale só para o **questionário**: campanha fora do ar não apresenta pergunta
 * nenhuma no caixa e não invalida cupom nenhum — quem decide dinheiro é a
 * vigência do cupom.
 *
 * A comparação é lexicográfica porque `"yyyy-MM-ddTHH:mm:ss"` ordena como data,
 * e assim não existe `Date` intermediário para o fuso deslocar.
 */
export function isCampaignRunning(campaign: CampaignDto, now?: Date): boolean {
  if (!campaign.isActive) return false;
  const instant = nowInstant(now);
  if (instant < campaign.startsAt) return false;
  return campaign.endsAt == null || instant <= campaign.endsAt;
}

/** Contador que gera chave de React estável para pergunta/opção ainda sem id. */
let draftSequence = 0;
function nextKey(prefix: string): string {
  draftSequence += 1;
  return `${prefix}-${draftSequence}`;
}

/** Opção em branco. */
export function emptyOptionDraft(): CampaignQuestionDraft["options"][number] {
  return { id: null, key: nextKey("o"), label: "" };
}

/** Pergunta em branco, já com o mínimo de opções que o servidor exige. */
export function emptyQuestionDraft(): CampaignQuestionDraft {
  return {
    id: null,
    key: nextKey("q"),
    label: "",
    isRequired: true,
    options: Array.from({ length: MIN_OPTIONS }, emptyOptionDraft),
  };
}

/** Converte o questionário vindo da API em rascunhos, **preservando os ids**. */
export function draftsFromDto(questions: CampaignQuestionDto[]): CampaignQuestionDraft[] {
  return questions.map((question) => ({
    id: question.id,
    key: nextKey("q"),
    label: question.label,
    isRequired: question.isRequired,
    options: question.options.map((option) => ({
      id: option.id,
      key: nextKey("o"),
      label: option.label,
    })),
  }));
}

/**
 * Primeira recusa do questionário, ou `null` quando ele está válido.
 *
 * As mensagens repetem as do backend de propósito: quem digitar errado lê a
 * mesma frase com o gate disparando no cliente ou no servidor.
 *
 * Opção com rótulo vazio **não conta** — campo em branco é "não preenchi", não
 * uma alternativa. Sem isso, uma pergunta com uma opção escrita e outra vazia
 * passaria daqui e voltaria como 400.
 */
export function describeQuestionsProblem(questions: CampaignQuestionDraft[]): string | null {
  if (questions.length > MAX_QUESTIONS)
    return `A campanha aceita no máximo ${MAX_QUESTIONS} perguntas!`;

  for (const question of questions) {
    const label = question.label.trim();
    if (!label) return "Informe o texto da pergunta da campanha!";

    const options = question.options.map((option) => option.label.trim()).filter(Boolean);

    if (options.length < MIN_OPTIONS)
      return `A pergunta "${label}" precisa de pelo menos ${MIN_OPTIONS} opções de resposta ativas!`;

    if (options.length > MAX_OPTIONS)
      return `A pergunta "${label}" aceita no máximo ${MAX_OPTIONS} opções de resposta!`;

    const normalized = options.map((option) => option.toLowerCase());
    if (new Set(normalized).size !== normalized.length)
      return `A pergunta "${label}" tem opções de resposta repetidas!`;
  }

  return null;
}

/**
 * Monta o payload aninhado do salvamento.
 *
 * Dois detalhes que não quebram compilação e quebram o histórico:
 * - o `id` de pergunta e de opção **viaja preservado**; sem ele o servidor cria
 *   uma linha nova e exclui logicamente a antiga, e o relatório — que agrega
 *   por id — para de enxergar as respostas já dadas;
 * - `sortOrder` é derivado da POSIÇÃO no array, contando de 1. É o que faz
 *   "subir/descer" na tela virar ordem gravada, sem uma segunda verdade sobre
 *   a ordem viajando no rascunho.
 *
 * A lista é o estado final desejado, nunca um delta: pergunta que não vier aqui
 * é excluída logicamente pelo servidor.
 */
export function buildCampaignPayload(
  form: CampaignForm,
  questions: CampaignQuestionDraft[],
): SaveCampaignPayload {
  const startsOn = form.startsOnDate ?? new Date();

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    startsAt: toStartInstant(startsOn, form.startsAtTime),
    endsAt: form.endsOnDate ? toEndInstant(form.endsOnDate, form.endsAtTime) : null,
    isActive: form.isActive,
    questions: questions.map((question, questionIndex) => ({
      id: question.id,
      label: question.label.trim(),
      sortOrder: questionIndex + 1,
      isRequired: question.isRequired,
      options: question.options
        .filter((option) => option.label.trim())
        .map((option, optionIndex) => ({
          id: option.id,
          label: option.label.trim(),
          sortOrder: optionIndex + 1,
        })),
    })),
  };
}
