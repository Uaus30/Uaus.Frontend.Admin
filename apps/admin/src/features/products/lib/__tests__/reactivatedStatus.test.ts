import { describe, expect, it } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import { withReactivatedStatus, withReactivatedStatuses } from "../reactivatedStatus";

const ATIVO = String(PRODUCT_STATUS.Active);
const SEM_ESTOQUE = String(PRODUCT_STATUS.OutOfStock);
const INATIVO = String(PRODUCT_STATUS.Inactive);

const reativouO10 = [{ productId: 10, productName: "BALDE [PRETO]", previousStatus: "OutOfStock" }];

describe("withReactivatedStatus — o formulário depois da entrada que reativou", () => {
  it("troca para Ativo o status que ainda espelha o de antes da entrada", () => {
    // Sem isto, o próximo Salvar gravaria "Sem estoque" por cima da reativação.
    const form = { id: 10, status: SEM_ESTOQUE, name: "BALDE" };

    expect(withReactivatedStatus(form, reativouO10)).toEqual({ id: 10, status: ATIVO, name: "BALDE" });
  });

  it("entende o status como o formulário o guarda: id numérico ou nome do enum", () => {
    // O formulário guarda o id das opções; sem as opções carregadas, fica o nome cru.
    const reativouInativo = [{ productId: 10, productName: "BALDE", previousStatus: "Inactive" }];

    expect(withReactivatedStatus({ id: 10, status: INATIVO }, reativouInativo).status).toBe(ATIVO);
    expect(withReactivatedStatus({ id: 10, status: "Inactive" }, reativouInativo).status).toBe(ATIVO);
  });

  it("não desfaz o status que a pessoa mudou à mão e ainda não salvou", () => {
    const form = { id: 10, status: INATIVO };

    expect(withReactivatedStatus(form, reativouO10)).toBe(form);
  });

  it("devolve o mesmo objeto para outra variação e para a que ainda não foi salva", () => {
    const outra = { id: 11, status: SEM_ESTOQUE };
    const nova = { id: null, status: SEM_ESTOQUE };

    expect(withReactivatedStatus(outra, reativouO10)).toBe(outra);
    expect(withReactivatedStatus(nova, reativouO10)).toBe(nova);
  });
});

describe("withReactivatedStatuses — as variações do grupo", () => {
  it("troca só a variação reativada", () => {
    const variacoes = [
      { id: 10, status: SEM_ESTOQUE },
      { id: 11, status: SEM_ESTOQUE },
    ];

    expect(withReactivatedStatuses(variacoes, reativouO10)).toEqual([
      { id: 10, status: ATIVO },
      { id: 11, status: SEM_ESTOQUE },
    ]);
  });

  it("devolve a MESMA lista quando nenhuma muda — o React não renderiza à toa", () => {
    const variacoes = [{ id: 11, status: SEM_ESTOQUE }];

    expect(withReactivatedStatuses(variacoes, reativouO10)).toBe(variacoes);
  });
});
