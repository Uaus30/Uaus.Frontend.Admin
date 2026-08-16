import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import { closeLocalDatabase } from "./database";
import {
  nextOfflineSaleNumber,
  readCachedCashRegisterSession,
  readCachedCompanySettings,
  writeCachedCashRegisterSession,
  writeCachedCompanySettings,
} from "./meta";
import type { LocalCompanySettings } from "./types";

/**
 * Os metadados da base local contra um IndexedDB de verdade.
 *
 * `meta.test.ts` cobre a regra do sequencial com o `updateMany` simulado por um
 * Map. O que só o banco prova é a **atomicidade**: duas reservas concorrentes
 * numa transação readwrite de verdade não podem sair com o mesmo número. Era
 * assim que dois cupons offline saíam impressos como `OFF-14`.
 */

/** Sessão de caixa como o servidor a devolve, no que o PDV guarda dela. */
const SESSION = { id: 7, openedAt: "2026-08-15T08:00:00", openingAmount: 100 };

/** Configurações da loja, incluindo a identidade que sai no cupom. */
const SETTINGS: LocalCompanySettings = {
  usesCashRegister: true,
  storeName: "Uaus",
  addressLine: "Rua das Flores, 10",
};

beforeEach(() => {
  resetLocalDatabase();
});

describe("nextOfflineSaleNumber na base de verdade", () => {
  it("deve começar em 1 e seguir de um em um", async () => {
    expect(await nextOfflineSaleNumber()).toBe(1);
    expect(await nextOfflineSaleNumber()).toBe(2);
  });

  it("não deve repetir o número em duas reservas concorrentes", async () => {
    // Regressão: a reserva fazia ler-e-gravar em DUAS transações, e duas vendas
    // fechadas quase ao mesmo tempo liam o mesmo valor. Dois cupons saíam
    // impressos com o mesmo `OFF-n`, e a conferência do turno passava a ter dois
    // comprovantes que se diziam a mesma venda.
    const reserved = await Promise.all([
      nextOfflineSaleNumber(),
      nextOfflineSaleNumber(),
      nextOfflineSaleNumber(),
    ]);

    expect([...reserved].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("deve continuar de onde parou depois de reabrir a base", async () => {
    // O caso da queda de energia: a máquina reinicia e o PDV reabre a base. O
    // sequencial precisa continuar, senão o turno teria dois `OFF-1`.
    await nextOfflineSaleNumber();
    await nextOfflineSaleNumber();
    closeLocalDatabase();

    expect(await nextOfflineSaleNumber()).toBe(3);
  });
});

describe("cópia local da sessão de caixa", () => {
  it("deve devolver a sessão guardada depois de reabrir a base", async () => {
    // É o que faz o PDV sobreviver a um recarregamento sem internet: sem a
    // cópia, `GET /CashRegisterSessions/current` falharia e o caixa cairia na
    // tela de abertura, que também exige internet — travado justamente na
    // situação para a qual o offline existe.
    await writeCachedCashRegisterSession(SESSION);
    closeLocalDatabase();

    expect(await readCachedCashRegisterSession<typeof SESSION>()).toEqual(SESSION);
  });

  it("deve descartar a cópia no fechamento do caixa", async () => {
    // Uma sessão encerrada não pode ressuscitar num recarregamento offline: o
    // PDV voltaria vendendo num turno que o servidor já fechou, e as vendas
    // seriam recusadas na sincronização.
    await writeCachedCashRegisterSession(SESSION);

    await writeCachedCashRegisterSession(null);

    expect(await readCachedCashRegisterSession()).toBeNull();
  });

  it("deve devolver nulo quando nunca houve sessão guardada", async () => {
    expect(await readCachedCashRegisterSession()).toBeNull();
  });
});

describe("cópia local das configurações da empresa", () => {
  it("deve guardar e devolver as configurações que decidem a primeira tela", async () => {
    // Elas dizem se o PDV exige abertura de caixa — pergunta que a primeira tela
    // responde antes de qualquer requisição ter dado certo. Sem a cópia, um PDV
    // aberto sem internet mostraria o padrão em vez do comportamento da loja.
    await writeCachedCompanySettings(SETTINGS);
    closeLocalDatabase();

    expect(await readCachedCompanySettings()).toEqual(SETTINGS);
  });

  it("deve devolver nulo quando o PDV nunca conseguiu lê-las do servidor", async () => {
    // Nulo e "controle de caixa desligado" são coisas diferentes: quem escolhe o
    // padrão é a tela, porque isso é regra de produto, não de persistência.
    expect(await readCachedCompanySettings()).toBeNull();
  });
});
