import type {
  CampaignDto,
  CampaignQuestionDto,
  CampaignQuestionOptionDto,
  CouponDto,
  SaveCampaignPayload,
} from "@workspace/api-client-react";

/**
 * Valores do formulário da campanha, como estão nos controles da tela.
 *
 * O período é **instante** (data + hora), mas o `DatePicker` de `packages/ui`
 * só fala `Date` de calendário. Por isso o dia e a hora vivem em campos
 * separados aqui e só viram `"yyyy-MM-ddTHH:mm:ss"` no submit: guardar o
 * instante já composto obrigaria a tela a desmontar e remontar a string a cada
 * tecla digitada na hora, e é exatamente aí que alguém acaba escrevendo
 * `new Date("2026-09-30")` — que volta um dia no Brasil.
 */
export interface CampaignForm {
  name: string;
  description: string;
  /** Dia do início, no calendário local. `undefined` = ainda não escolhido. */
  startsOnDate?: Date;
  /** Hora do início, `"HH:mm"` (valor nativo do `<input type="time">`). */
  startsAtTime: string;
  /** Dia do fim. `undefined` = período em aberto, que é um caso válido. */
  endsOnDate?: Date;
  /** Hora do fim, `"HH:mm"`. Ignorada enquanto não houver dia de fim. */
  endsAtTime: string;
  isActive: boolean;
}

/**
 * Uma alternativa de resposta enquanto está sendo editada.
 *
 * `id` **preservado** é o que separa editar de duplicar: sem ele o servidor
 * cria uma opção nova, a antiga sai por exclusão lógica e o relatório histórico
 * — que agrega por id de opção — se desliga das respostas já gravadas.
 */
export interface CampaignOptionDraft {
  /** Id no banco, ou `null` para opção que ainda não existe. */
  id: number | null;
  /**
   * Chave estável de React. Opção nova não tem id, e usar o índice do array
   * como `key` faria o React reaproveitar o input errado ao reordenar ou
   * remover — o texto digitado "pula" de linha.
   */
  key: string;
  label: string;
}

/**
 * Uma pergunta do questionário enquanto está sendo editada.
 *
 * Não há `sortOrder` aqui de propósito: a ordem é a **posição no array**, e o
 * `sortOrder` enviado ao servidor é derivado dela no submit. Guardar os dois
 * criaria duas verdades sobre a mesma ordem, e a que a tela mostra não é
 * necessariamente a que seria gravada.
 */
export interface CampaignQuestionDraft {
  /** Id no banco, ou `null` para pergunta que ainda não existe. */
  id: number | null;
  /** Chave estável de React — mesmo motivo do rascunho de opção. */
  key: string;
  label: string;
  /** Resposta obrigatória para o caixa conseguir aplicar o cupom. */
  isRequired: boolean;
  options: CampaignOptionDraft[];
}

export type { CampaignDto, CampaignQuestionDto, CampaignQuestionOptionDto, CouponDto, SaveCampaignPayload };
