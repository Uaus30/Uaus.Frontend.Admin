import { describe, expect, it } from "vitest";
import { destinoAposLogin, urlLoginCom } from "../destino-login";

describe("urlLoginCom", () => {
  it("carimba o caminho pedido, com query string", () => {
    // REGRESSÃO: o guard mandava para "/login" puro e o login mandava todo mundo
    // para o dashboard. Quem clicava em "editar produto" no PDV sem sessão
    // digitava a senha e caía no painel, sem pista do que tinha pedido.
    expect(urlLoginCom("/produtos?busca=Caf%C3%A9&editar=42")).toBe(
      "/login?redirect=%2Fprodutos%3Fbusca%3DCaf%25C3%25A9%26editar%3D42",
    );
  });

  it("recusa endereço externo em vez de propagá-lo até a volta", () => {
    expect(urlLoginCom("https://site-falso.com")).toBe("/login");
    expect(urlLoginCom("//site-falso.com")).toBe("/login");
  });

  it("recusa o próprio login, que faria laço", () => {
    expect(urlLoginCom("/login")).toBe("/login");
    expect(urlLoginCom("/login?redirect=%2Fprodutos")).toBe("/login");
  });
});

describe("destinoAposLogin", () => {
  it("devolve o caminho carimbado na ida", () => {
    const url = urlLoginCom("/produtos?busca=Caneca&editar=10");
    const busca = url.slice(url.indexOf("?"));

    expect(destinoAposLogin(busca)).toBe("/produtos?busca=Caneca&editar=10");
  });

  it("aceita a query com ou sem a interrogação na frente", () => {
    // `window.location.search` traz o "?"; o `useSearch` do wouter 3 tira.
    expect(destinoAposLogin("?redirect=%2Fprodutos")).toBe("/produtos");
    expect(destinoAposLogin("redirect=%2Fprodutos")).toBe("/produtos");
  });

  it("devolve null sem parâmetro, para quem chama escolher o padrão", () => {
    expect(destinoAposLogin("")).toBeNull();
    expect(destinoAposLogin("?outro=1")).toBeNull();
  });

  it.each([
    ["absoluto", "https://site-falso.com/roubo"],
    ["sem protocolo", "//site-falso.com"],
    ["com barra invertida", "/\\site-falso.com"],
    ["javascript:", "javascript:alert(1)"],
    ["relativo solto", "produtos"],
  ])("recusa destino %s", (_rotulo, destino) => {
    // A tela de login viraria ponte de phishing: o link chega por e-mail com o
    // domínio verdadeiro, a pessoa confere o endereço, digita a senha — e só
    // DEPOIS o navegador sai para o site do atacante, já autenticada.
    expect(destinoAposLogin(`?redirect=${encodeURIComponent(destino)}`)).toBeNull();
  });

  it("aceita a raiz", () => {
    expect(destinoAposLogin("?redirect=%2F")).toBe("/");
  });
});
