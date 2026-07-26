import { describe, expect, it } from "vitest";
import {
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  USER_STATUS,
  enumCode,
} from "@workspace/api-client-react";

/**
 * A API serializa enums pelo nome do membro em C# ("Paid", "Active"), mas as
 * telas comparam com o código numérico. Estes testes travam essa conversão.
 */
describe("enumCode", () => {
  it("deve converter o nome vindo da API para o código numérico", () => {
    expect(enumCode("Paid", PAYMENT_STATUS)).toBe(2);
    expect(enumCode("Cancelled", PAYMENT_STATUS)).toBe(5);
    expect(enumCode("Active", PRODUCT_STATUS)).toBe(2);
    expect(enumCode("Inactive", PRODUCT_STATUS)).toBe(4);
    expect(enumCode("Bloqued", USER_STATUS)).toBe(3);
  });

  it("deve devolver o número quando a API já manda o código", () => {
    expect(enumCode(2, PAYMENT_STATUS)).toBe(2);
    expect(enumCode(0, PAYMENT_STATUS)).toBe(0);
  });

  it("deve aceitar código numérico enviado como texto", () => {
    expect(enumCode("4", PRODUCT_STATUS)).toBe(4);
  });

  it("deve devolver zero para valores ausentes ou desconhecidos", () => {
    expect(enumCode(null, PAYMENT_STATUS)).toBe(0);
    expect(enumCode(undefined, PAYMENT_STATUS)).toBe(0);
    expect(enumCode("Inexistente", PAYMENT_STATUS)).toBe(0);
  });

  it("não deve confundir status de produto com status de pagamento", () => {
    // "Inactive" vale 4 em produtos, mas não existe em pagamentos.
    expect(enumCode("Inactive", PRODUCT_STATUS)).toBe(PRODUCT_STATUS.Inactive);
    expect(enumCode("Inactive", PAYMENT_STATUS)).toBe(0);
  });
});
