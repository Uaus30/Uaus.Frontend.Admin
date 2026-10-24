import { afterEach, describe, expect, it } from "vitest";
import type { TaskCardSummaryDto } from "@workspace/api-client-react";
import {
  brasiliaNowMs,
  countTasks,
  firstName,
  formatWhen,
  matchesWho,
  priorityDef,
  relativeAge,
  sortDone,
  sortPending,
  visibleTasks,
} from "../tasks";

function task(overrides: Partial<TaskCardSummaryDto>): TaskCardSummaryDto {
  return {
    id: 1,
    number: 1,
    title: "Tarefa",
    status: "Pending",
    priority: "Normal",
    hasDescription: false,
    attachmentsCount: 0,
    labels: [],
    assignee: { userId: 3, firstName: "Ana", fullName: "Ana Souza" },
    createdAt: "2026-10-20T10:00:00",
    ...overrides,
  };
}

/** "Agora" no relógio de parede de Brasília, como `brasiliaNowMs` devolve. */
const at = (wallClock: string) => new Date(`${wallClock}Z`).getTime();

/**
 * O que está sendo protegido: a ordem da lista (mais urgente primeiro e, na
 * mesma prioridade, a que espera há mais tempo), o filtro por pessoa — que abre
 * em "minhas" e nunca mostra a tarefa sem responsável como de alguém —, e a idade
 * da tarefa dita em hora de Brasília em qualquer fuso do aparelho.
 */
describe("ordem da lista", () => {
  it("pendentes: prioridade maior primeiro, depois a mais antiga, depois o id", () => {
    const items = [
      task({ id: 1, priority: "Low", createdAt: "2026-10-01T08:00:00" }),
      task({ id: 2, priority: "Normal", createdAt: "2026-10-22T08:00:00" }),
      task({ id: 3, priority: "Urgent", createdAt: "2026-10-22T09:00:00" }),
      task({ id: 4, priority: "Normal", createdAt: "2026-10-10T08:00:00" }),
      task({ id: 5, priority: 3, createdAt: "2026-10-23T08:00:00" }),
      task({ id: 6, priority: "Normal", createdAt: "2026-10-10T08:00:00" }),
    ];

    expect(sortPending(items).map((t) => t.id)).toEqual([3, 5, 4, 6, 2, 1]);
  });

  it("finalizadas: a concluída por último primeiro", () => {
    const items = [
      task({ id: 1, status: "Done", finishedAt: "2026-10-20T10:00:00" }),
      task({ id: 2, status: "Done", finishedAt: "2026-10-23T09:00:00" }),
      task({ id: 3, status: "Done", finishedAt: "2026-10-21T18:30:00" }),
    ];

    expect(sortDone(items).map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it("prioridade desconhecida (servidor mais novo) é tratada como Normal", () => {
    expect(priorityDef("SomethingNew").name).toBe("Normal");
    expect(priorityDef(4).name).toBe("Urgente");
    expect(priorityDef("High").name).toBe("Alta");
  });
});

describe("filtro por pessoa", () => {
  const mine = task({ id: 1, assignee: { userId: 3, firstName: "Ana", fullName: "Ana Souza" } });
  const bruno = task({ id: 2, assignee: { userId: 9, firstName: "Bruno", fullName: "Bruno Lima" } });
  const orphan = task({ id: 3, assignee: undefined });
  const done = task({ id: 4, status: "Done", finishedAt: "2026-10-22T10:00:00" });

  it("minhas, todas e uma pessoa", () => {
    expect(matchesWho(mine, "mine", 3)).toBe(true);
    expect(matchesWho(bruno, "mine", 3)).toBe(false);
    expect(matchesWho(bruno, 9, 3)).toBe(true);
    expect(matchesWho(bruno, "all", 3)).toBe(true);
  });

  it("sem responsável só aparece em todas; sem sessão, minhas não tem nada", () => {
    expect(matchesWho(orphan, "mine", 3)).toBe(false);
    expect(matchesWho(orphan, 3, 3)).toBe(false);
    expect(matchesWho(orphan, "all", 3)).toBe(true);
    expect(matchesWho(mine, "mine", null)).toBe(false);
  });

  it("a lista e as contagens separam pendentes de finalizadas", () => {
    const items = [mine, bruno, orphan, done];

    expect(visibleTasks(items, "pending", "mine", 3).map((t) => t.id)).toEqual([1]);
    expect(visibleTasks(items, "pending", "all", 3).map((t) => t.id)).toHaveLength(3);
    expect(visibleTasks(items, "done", "mine", 3).map((t) => t.id)).toEqual([4]);
    expect(countTasks(items, "pending", "all", 3)).toBe(3);
    expect(countTasks(items, "done", 9, 3)).toBe(0);
  });
});

describe("idade e data da tarefa", () => {
  const now = at("2026-10-23T15:20:00");

  it("fala como se fala", () => {
    expect(relativeAge("2026-10-23T15:19:40", now)).toBe("agora");
    expect(relativeAge("2026-10-23T14:58:00", now)).toBe("há 22 min");
    expect(relativeAge("2026-10-23T09:10:00", now)).toBe("há 6 h");
    expect(relativeAge("2026-10-22T23:50:00", now)).toBe("ontem");
    expect(relativeAge("2026-10-19T10:00:00", now)).toBe("há 4 dias");
    expect(relativeAge("2026-10-15T10:00:00", now)).toBe("há 1 semana");
    expect(relativeAge("2026-10-01T10:00:00", now)).toBe("há 3 semanas");
    expect(relativeAge("2026-07-20T10:00:00", now)).toBe("há 3 meses");
    expect(relativeAge("não é data", now)).toBe("");
  });

  it("ontem é o dia de calendário: a anotação das 23h vista às 8h é de ontem", () => {
    expect(relativeAge("2026-10-22T23:00:00", at("2026-10-23T08:00:00"))).toBe("ontem");
  });

  it("hoje, ontem, dia e mês; de outro ano, com o ano", () => {
    expect(formatWhen("2026-10-23T10:12:30", now)).toBe("hoje às 10:12");
    expect(formatWhen("2026-10-22T16:40:00", now)).toBe("ontem às 16:40");
    expect(formatWhen("2026-10-20T11:05:00", now)).toBe("20/10 às 11:05");
    expect(formatWhen("2025-12-30T11:05:00", now)).toBe("30/12/2025");
  });

  // Armadilha 8 do CLAUDE.md: a data da API não tem fuso e é hora de Brasília. A
  // idade não pode mudar com o fuso do aparelho — nem no CI, que roda em UTC.
  describe("em qualquer fuso do aparelho", () => {
    const originalTimeZone = process.env.TZ;
    afterEach(() => {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    });

    for (const timeZone of ["UTC", "America/Manaus", "Asia/Tokyo"]) {
      it(`${timeZone}: o "agora" é o relógio de Brasília`, () => {
        process.env.TZ = timeZone;
        // 18:20 UTC = 15:20 em Brasília.
        const brasilia = brasiliaNowMs(new Date("2026-10-23T18:20:00Z"));

        expect(brasilia).toBe(now);
        expect(relativeAge("2026-10-23T09:10:00", brasilia)).toBe("há 6 h");
        expect(formatWhen("2026-10-23T10:12:00", brasilia)).toBe("hoje às 10:12");
      });
    }
  });
});

describe("firstName", () => {
  it("o primeiro nome, com espaços sobrando ou vazio", () => {
    expect(firstName("Ana Souza")).toBe("Ana");
    expect(firstName("  Bruno  Lima ")).toBe("Bruno");
    expect(firstName(null)).toBe("");
  });
});
