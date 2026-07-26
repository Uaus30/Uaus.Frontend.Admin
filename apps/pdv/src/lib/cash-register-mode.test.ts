import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPANY_SETTINGS,
  resolveCashRegisterMode,
} from "./cash-register-mode";

describe("resolveCashRegisterMode", () => {
  it("deve exigir sessão na loja que usa controle de caixa", () => {
    const mode = resolveCashRegisterMode({ usesCashRegister: true });

    expect(mode).toMatchObject({
      usesCashRegister: true,
      requiresOpenSession: true,
      saleRequiresSession: true,
    });
  });

  it("deve cair no padrão quando não há configuração", () => {
    // O padrão é SEM controle de caixa, e precisa ser o mesmo dos outros dois
    // lugares que o declaram: CompanySettingsService.Default no backend e o
    // INSERT do script de schema. Divergir faria a loja ver comportamentos
    // diferentes conforme a leitura da configuração ter dado certo — e o pior
    // caso é exigir abertura de caixa offline, sem ninguém para destravar.
    expect(resolveCashRegisterMode(null).usesCashRegister).toBe(false);
    expect(resolveCashRegisterMode(undefined).usesCashRegister).toBe(false);
    expect(DEFAULT_COMPANY_SETTINGS.usesCashRegister).toBe(false);
  });

  it("deve registrar que a loja não usa controle de caixa", () => {
    expect(resolveCashRegisterMode({ usesCashRegister: false }).usesCashRegister).toBe(false);
  });

  it("nunca deve exigir sessão para a baixa de estoque", () => {
    // Baixa é movimento de estoque, não de dinheiro: o backend resolve a sessão
    // sozinho e não exige caixa aberto.
    expect(resolveCashRegisterMode({ usesCashRegister: true }).writeOffRequiresSession).toBe(false);
    expect(resolveCashRegisterMode({ usesCashRegister: false }).writeOffRequiresSession).toBe(false);
  });

  it("deve dispensar a abertura de caixa quando a loja não controla caixa", () => {
    // O servidor faz a mesma leitura: PdvService.ResolveSaleSessionAsync devolve
    // sessão nula nesse modo, então pedir a abertura na tela só criaria atrito.
    const mode = resolveCashRegisterMode({ usesCashRegister: false });

    expect(mode.requiresOpenSession).toBe(false);
    expect(mode.saleRequiresSession).toBe(false);
  });

  it("deve exigir a abertura de caixa quando a loja controla caixa", () => {
    const mode = resolveCashRegisterMode({ usesCashRegister: true });

    expect(mode.requiresOpenSession).toBe(true);
    expect(mode.saleRequiresSession).toBe(true);
  });
});
