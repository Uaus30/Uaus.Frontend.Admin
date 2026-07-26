import { describe, expect, it } from "vitest";
import { describeApiError } from "../api-error";

/** Reproduz o formato do `ApiError` sem depender do cliente HTTP. */
function apiErrorLike(message: string, payload: unknown) {
  return Object.assign(new Error(message), { status: 400, payload });
}

describe("describeApiError", () => {
  it("deve usar a mensagem do backend quando ela existe", () => {
    const error = apiErrorLike("Estoque insuficiente para baixa do produto #5", {
      message: "Estoque insuficiente para baixa do produto #5",
    });

    expect(describeApiError(error)).toBe("Estoque insuficiente para baixa do produto #5");
  });

  it("deve preferir as frases de validação ao título genérico do ASP.NET", () => {
    const error = apiErrorLike("One or more validation errors occurred.", {
      title: "One or more validation errors occurred.",
      errors: {
        Items: ["A baixa precisa de ao menos um item."],
        Reason: ["Motivo inválido."],
      },
    });

    expect(describeApiError(error)).toBe(
      "A baixa precisa de ao menos um item. Motivo inválido.",
    );
  });

  it("deve aceitar valor solto no dicionário de validação", () => {
    const error = apiErrorLike("erro", { errors: { Reason: "Motivo inválido." } });

    expect(describeApiError(error)).toBe("Motivo inválido.");
  });

  it("deve ignorar entradas de validação vazias e cair na mensagem do erro", () => {
    const error = apiErrorLike("Falhou", { errors: { Reason: ["   "], Items: [] } });

    expect(describeApiError(error)).toBe("Falhou");
  });

  it("deve usar erros locais lançados antes da requisição", () => {
    expect(describeApiError(new Error("Selecione o motivo da baixa."))).toBe(
      "Selecione o motivo da baixa.",
    );
  });

  it("deve cair no texto padrão quando não há nada legível", () => {
    expect(describeApiError(null)).toBe("Tente novamente.");
    expect(describeApiError(new Error("   "))).toBe("Tente novamente.");
    expect(describeApiError({}, "Falha ao salvar.")).toBe("Falha ao salvar.");
  });
});
