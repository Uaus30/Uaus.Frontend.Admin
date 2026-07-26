import { describe, it, expect, vi } from "vitest";
import {
  CALENDAR_PORTAL_ATTRIBUTE,
  formatDateInput,
  formatDateLabel,
  guardCalendarDismiss,
  isInsideCalendarPortal,
  parseDateInput,
} from "../date-field";

describe("parseDateInput", () => {
  it("interpreta yyyy-MM-dd no fuso local, sem voltar um dia", () => {
    // `new Date("2026-07-18")` daria meia-noite UTC e, em Brasília, 17/07.
    const parsed = parseDateInput("2026-07-18");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(6);
    expect(parsed?.getDate()).toBe(18);
  });

  it("devolve undefined para valor vazio ou ausente", () => {
    expect(parseDateInput("")).toBeUndefined();
    expect(parseDateInput(undefined)).toBeUndefined();
    expect(parseDateInput(null)).toBeUndefined();
  });

  it("devolve undefined para data inválida", () => {
    expect(parseDateInput("18/07/2026")).toBeUndefined();
    expect(parseDateInput("2026-13-45")).toBeUndefined();
  });
});

describe("formatDateInput", () => {
  it("converte Date para yyyy-MM-dd", () => {
    expect(formatDateInput(new Date(2026, 6, 18))).toBe("2026-07-18");
  });

  it("devolve string vazia quando não há data", () => {
    expect(formatDateInput(undefined)).toBe("");
    expect(formatDateInput(null)).toBe("");
    expect(formatDateInput(new Date("inválida"))).toBe("");
  });

  it("faz round-trip com parseDateInput", () => {
    expect(formatDateInput(parseDateInput("2026-01-31"))).toBe("2026-01-31");
  });
});

describe("formatDateLabel", () => {
  it("exibe a data no formato brasileiro", () => {
    expect(formatDateLabel(new Date(2026, 6, 18))).toBe("18/07/2026");
  });
});

describe("isInsideCalendarPortal", () => {
  it("reconhece elementos dentro do portal do calendário", () => {
    const portal = document.createElement("div");
    portal.setAttribute(CALENDAR_PORTAL_ATTRIBUTE, "true");
    const day = document.createElement("button");
    portal.appendChild(day);
    document.body.appendChild(portal);

    expect(isInsideCalendarPortal(day)).toBe(true);
    expect(isInsideCalendarPortal(portal)).toBe(true);

    document.body.removeChild(portal);
  });

  it("ignora elementos fora do portal e alvos não-DOM", () => {
    const outside = document.createElement("div");
    document.body.appendChild(outside);

    expect(isInsideCalendarPortal(outside)).toBe(false);
    expect(isInsideCalendarPortal(null)).toBe(false);

    document.body.removeChild(outside);
  });
});

describe("guardCalendarDismiss", () => {
  it("bloqueia o fechamento quando o clique veio do calendário", () => {
    const portal = document.createElement("div");
    portal.setAttribute(CALENDAR_PORTAL_ATTRIBUTE, "true");
    document.body.appendChild(portal);
    const preventDefault = vi.fn();

    guardCalendarDismiss({ target: portal, preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();

    document.body.removeChild(portal);
  });

  it("deixa o modal fechar em cliques externos de verdade", () => {
    const preventDefault = vi.fn();

    guardCalendarDismiss({ target: document.body, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
