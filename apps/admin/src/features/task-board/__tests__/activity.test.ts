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
 * manda o tipo pelo NOME), "concluiu" e "reabriu" sem as situações óbvias, as
 * linhas antigas do quadro (colunas, membros, checklist) que continuam legíveis,
 * tipo desconhecido que não vira linha em branco, e o comentário que só o autor edita.
 */
describe("describeActivity", () => {
  it("criou a tarefa; a situação de nascimento só aparece quando não é Pendente (linhas do quadro)", () => {
    expect(describeActivity(row({ kind: "Created", toStatus: "Pending" }))).toEqual({
      text: "criou a tarefa",
      to: undefined,
    });
    expect(describeActivity(row({ kind: "Created", toStatus: "Backlog" }))).toEqual({
      text: "criou a tarefa",
      to: "Backlog",
    });
    expect(describeActivity(row({ kind: "Created" }))).toEqual({ text: "criou a tarefa", to: undefined });
  });

  it("concluir e reabrir dizem o que foi feito; o movimento entre colunas antigas leva as duas", () => {
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Pending", toStatus: "Done" }))).toEqual({
      text: "concluiu a tarefa",
    });
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Testing", toStatus: "Done" })).text).toBe(
      "concluiu a tarefa",
    );
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Done", toStatus: "Pending" }))).toEqual({
      text: "reabriu a tarefa",
    });
    expect(describeActivity(row({ kind: "Moved", fromStatus: "Backlog", toStatus: "Doing" }))).toEqual({
      text: "moveu a tarefa",
      from: "Backlog",
      to: "Doing",
    });
  });

  it("responsável e prioridade trazem o nome novo entre aspas", () => {
    expect(describeActivity(row({ kind: "AssigneeChanged", text: "Bruno Lima" }))).toEqual({
      text: "passou a tarefa para",
      quote: "Bruno Lima",
    });
    expect(describeActivity(row({ kind: "PriorityChanged", text: "Alta" }))).toEqual({
      text: "mudou a prioridade para",
      quote: "Alta",
    });
  });

  it("os fatos com complemento trazem o nome entre aspas, inclusive os antigos", () => {
    expect(describeActivity(row({ kind: "LabelAdded", text: "Bug" }))).toEqual({
      text: "adicionou a etiqueta",
      quote: "Bug",
    });
    expect(describeActivity(row({ kind: "AttachmentAdded", text: "nota.pdf" })).quote).toBe("nota.pdf");
    expect(describeActivity(row({ kind: "ChecklistItemChecked", text: "Ligar" })).text).toBe(
      "concluiu no checklist",
    );
    expect(describeActivity(row({ kind: "MemberAdded", text: "Ana Souza" })).text).toBe("adicionou o membro");
    expect(describeActivity(row({ kind: "TitleChanged", text: "Novo" })).text).toBe("renomeou a tarefa para");
  });

  it("solução: registrou, editou e removeu", () => {
    expect(describeActivity(row({ kind: "SolutionAdded" })).text).toBe("registrou a solução");
    expect(describeActivity(row({ kind: "SolutionEdited" })).text).toBe("editou a solução");
    expect(describeActivity(row({ kind: "SolutionRemoved" })).text).toBe("removeu a solução");
  });

  it("aceita o tipo pelo número também", () => {
    expect(describeActivity(row({ kind: 4 })).text).toBe("arquivou a tarefa");
    expect(describeActivity(row({ kind: 22, text: "Ana" })).text).toBe("passou a tarefa para");
  });

  it("tipo que a tela não conhece (servidor mais novo) não vira linha em branco", () => {
    expect(describeActivity(row({ kind: "SomethingNew" })).text).toBe("atualizou a tarefa");
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
