import { describe, expect, it } from "vitest";
import { adminNewTabProps, isIosInstalledApp } from "../installed-app";

/** `standalone` só existe no Safari do iOS; nos outros navegadores ele falta. */
const navegador = (standalone?: boolean) =>
  (standalone === undefined ? {} : { standalone }) as unknown as Navigator;

describe("isIosInstalledApp", () => {
  it("reconhece o app instalado na tela de início do iPhone", () => {
    expect(isIosInstalledApp(navegador(true))).toBe(true);
  });

  it("o Safari aberto como navegador, no iPhone, não é o app", () => {
    expect(isIosInstalledApp(navegador(false))).toBe(false);
  });

  it("Android e computador não têm a propriedade: nunca são o app do iPhone", () => {
    // O app instalado no Android divide o armazenamento com o Chrome, e a nova
    // aba já chega logada — tratar como iPhone tiraria a nova aba à toa.
    expect(isIosInstalledApp(navegador())).toBe(false);
  });
});

describe("adminNewTabProps", () => {
  it("fora do app do iPhone, abre em nova aba", () => {
    expect(adminNewTabProps(navegador())).toEqual({ target: "_blank", rel: "noreferrer" });
  });

  it("no app do iPhone, abre na mesma janela: a nova aba cairia no login do Safari", () => {
    expect(adminNewTabProps(navegador(true))).toEqual({});
  });
});
