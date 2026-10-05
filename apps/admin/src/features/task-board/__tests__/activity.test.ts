import { describe, expect, it } from "vitest";
import type { TaskCardActivityDto } from "@workspace/api-client-react";
import { canEditComment, describeActivity, formatActivityDate, initials } from "../activity";

function row(overrides: Partial<TaskCardActivityDto>): TaskCardActivityDto {
  return {
    id: 1,
    kind: "Comment",
    createdAt: "2026-10-05T14:32:10",
    author: "Ana Souza",
    userId: 1,
    ...overrides,
  };
}

/**
 * O que está sendo protegido: a frase de cada fato do histórico (o servidor
 * manda o tipo pelo NOME), "finalizou" quando o destino é Finalizado, tipo
 * desconhecido que não vira linha em branco, e o comentário que só o autor edita.
 */
describe("describeActivity", () => {
  it("criou o cartão, com a coluna em que nasceu quando há", () => {
    expect(describeActivity(row({ kind: "Created", toStatus: "Backlog" }))).toEqual({
      text: "criou o cartão",
      to: "Backlog",
    });
    expect(describeActivity(row({ kind: "Created" }))).toEqual({ text: "criou o cartão", to: undefined });
  });

  it("mover para Finalizado é 'finalizou a tarefa'; para outra coluna, 'moveu o cartão'", () => {
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Testing", toStatus: "Done" }))).toEqual({
      text: "finalizou a tarefa",
      from: "Testing",
      to: "Done",
    });
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Backlog", toStatus: "Doing" })).text).toBe(
      "moveu o cartão",
    );
  });

  it("os fatos com complemento trazem o nome entre aspas", () => {
    expect(describeActivity(row({ kind: "LabelAdded", text: "Bug" }))).toEqual({
      text: "adicionou a etiqueta",
      quote: "Bug",
    });
    expect(describeActivity(row({ kind: "AttachmentAdded", text: "nota.pdf" })).quote).toBe("nota.pdf");
    expect(describeActivity(row({ kind: "ChecklistItemChecked", text: "Ligar" })).text).toBe(
      "concluiu no checklist",
    );
    expect(describeActivity(row({ kind: "TitleChanged", text: "Novo" })).text).toBe("renomeou o cartão para");
  });

  it("solução: registrou, editou e removeu", () => {
    expect(describeActivity(row({ kind: "SolutionAdded" })).text).toBe("registrou a solução");
    expect(describeActivity(row({ kind: "SolutionEdited" })).text).toBe("editou a solução");
    expect(describeActivity(row({ kind: "SolutionRemoved" })).text).toBe("removeu a solução");
  });

  it("aceita o tipo pelo número também", () => {
    expect(describeActivity(row({ kind: 4 })).text).toBe("arquivou o cartão");
  });

  it("tipo que a tela não conhece (servidor mais novo) não vira linha em branco", () => {
    expect(describeActivity(row({ kind: "SomethingNew" })).text).toBe("atualizou o cartão");
  });
});

describe("canEditComment", () => {
  it("só o autor, só em comentário, e só com a sessão carregada", () => {
    expect(canEditComment(row({ userId: 1 }), 1)).toBe(true);
    expect(canEditComment(row({ userId: 1 }), 2)).toBe(false);
    expect(canEditComment(row({ userId: 1 }), null)).toBe(false);
    expect(canEditComment(row({ userId: null }), 1)).toBe(false);
    expect(canEditComment(row({ kind: "Moved", userId: 1 }), 1)).toBe(false);
  });
});

describe("formatActivityDate e initials", () => {
  it("data e hora sem os segundos", () => {
    expect(formatActivityDate("2026-10-05T14:32:10")).toBe("05/10/2026 às 14:32");
  });

  it("iniciais do primeiro e do último nome", () => {
    expect(initials("Ana Souza")).toBe("AS");
    expect(initials("Wagner da Silva Barbosa")).toBe("WB");
    expect(initials("Sistema")).toBe("S");
    expect(initials("  ")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});
