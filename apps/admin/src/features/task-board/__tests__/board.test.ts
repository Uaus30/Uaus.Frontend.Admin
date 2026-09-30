import { describe, expect, it } from "vitest";
import { TASK_CARD_STATUS, type TaskCardSummaryDto } from "@workspace/api-client-react";
import {
  BOARD_COLUMNS,
  cardPriority,
  columnDropId,
  columnTitle,
  findColumnOf,
  formatFileSize,
  groupByColumn,
  parseColumnDropId,
  POSITION_STEP,
  positionBetween,
  statusCode,
} from "../board";

/**
 * Regras puras do quadro. O que está sendo protegido: a posição gravada ao
 * soltar (só o cartão movido é escrito — errar aqui embaralha a coluna a cada
 * arrasto), o agrupamento por coluna com o status vindo como NOME da API, e o
 * ida-e-volta dos ids de soltura do dnd-kit.
 */

function card(overrides: Partial<TaskCardSummaryDto>): TaskCardSummaryDto {
  return {
    id: 1,
    number: 1,
    title: "Cartão",
    status: "Backlog",
    position: 1024,
    isArchived: false,
    hasDescription: false,
    checklistTotal: 0,
    checklistDone: 0,
    attachmentsCount: 0,
    labels: [],
    members: [],
    createdAt: "2026-09-30T10:00:00",
    ...overrides,
  };
}

describe("positionBetween", () => {
  it("sem vizinhos começa no passo", () => {
    expect(positionBetween(undefined, undefined)).toBe(POSITION_STEP);
  });

  it("só com o anterior soma o passo (fim da coluna)", () => {
    expect(positionBetween(3000, undefined)).toBe(3000 + POSITION_STEP);
  });

  it("só com o próximo fica na metade dele (topo da coluna)", () => {
    expect(positionBetween(undefined, 1024)).toBe(512);
  });

  it("entre dois vizinhos fica na média", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("continua estritamente entre os vizinhos depois de muitas médias", () => {
    // Cinquenta inserções sempre no mesmo lugar: a posição tem que continuar
    // entre as duas pontas — é o que garante que a ordem gravada é a vista.
    let prev = 1024;
    const next = 2048;
    for (let i = 0; i < 50; i++) {
      const p = positionBetween(prev, next);
      expect(p).toBeGreaterThan(prev);
      expect(p).toBeLessThan(next);
      prev = p;
    }
  });
});

describe("groupByColumn", () => {
  it("agrupa pelo status vindo como nome e ordena por posição", () => {
    const columns = groupByColumn([
      card({ id: 1, status: "Doing", position: 2000 }),
      card({ id: 2, status: "Doing", position: 1000 }),
      card({ id: 3, status: "Done", position: 5 }),
      card({ id: 4, status: 2, position: 1 }),
    ]);

    expect(columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([2, 1]);
    expect(columns[TASK_CARD_STATUS.Done].map((c) => c.id)).toEqual([3]);
    expect(columns[TASK_CARD_STATUS.Pending].map((c) => c.id)).toEqual([4]);
    expect(columns[TASK_CARD_STATUS.Backlog]).toEqual([]);
  });

  it("desempata posições iguais pelo id, como o servidor", () => {
    const columns = groupByColumn([
      card({ id: 9, status: "Backlog", position: 1024 }),
      card({ id: 3, status: "Backlog", position: 1024 }),
    ]);

    expect(columns[TASK_CARD_STATUS.Backlog].map((c) => c.id)).toEqual([3, 9]);
  });

  it("findColumnOf acha a coluna do cartão e devolve undefined fora do quadro", () => {
    const columns = groupByColumn([card({ id: 7, status: "Testing" })]);

    expect(findColumnOf(columns, 7)).toBe(TASK_CARD_STATUS.Testing);
    expect(findColumnOf(columns, 8)).toBeUndefined();
  });
});

describe("ids de soltura das colunas", () => {
  it("ida e volta para todas as colunas", () => {
    for (const column of BOARD_COLUMNS) {
      expect(parseColumnDropId(columnDropId(column.status))).toBe(column.status);
    }
  });

  it("id de cartão (número) e texto estranho não são coluna", () => {
    expect(parseColumnDropId(42)).toBeUndefined();
    expect(parseColumnDropId("column:99")).toBeUndefined();
    expect(parseColumnDropId("card:1")).toBeUndefined();
  });
});

describe("rótulos e prioridade", () => {
  it("statusCode e columnTitle aceitam nome ou número", () => {
    expect(statusCode("Done")).toBe(TASK_CARD_STATUS.Done);
    expect(statusCode(3)).toBe(TASK_CARD_STATUS.Doing);
    expect(columnTitle("Pending")).toBe("Pendente");
    expect(columnTitle(99)).toBe("—");
  });

  it("cardPriority é a maior entre as etiquetas; zero sem etiqueta", () => {
    const label = (priority: string) => ({
      id: 1,
      name: "x",
      color: "red",
      priority,
      createdAt: "2026-09-30T10:00:00",
    });

    expect(cardPriority([])).toBe(0);
    expect(cardPriority([label("Low"), label("Urgent"), label("Normal")])).toBe(4);
  });

  it("formatFileSize escolhe a unidade", () => {
    expect(formatFileSize(12)).toBe("12 B");
    expect(formatFileSize(340 * 1024)).toBe("340 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});
