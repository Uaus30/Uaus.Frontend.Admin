import type {
  PartnerDto,
  PartnerProfitShareItemDto,
  PartnerProfitSharesDto,
} from "@workspace/api-client-react";

/**
 * Valores do formulário de cadastro/edição de sócio.
 *
 * No modo de criação apenas o nome é enviado: o sócio nasce ativo, com
 * percentual 0 (o ajuste acontece na distribuição de lucros). No modo de
 * edição, desativar o sócio zera o percentual no backend.
 */
export type PartnerFormValues = {
  name: string;
  isActive: boolean;
};

export type { PartnerDto, PartnerProfitShareItemDto, PartnerProfitSharesDto };
