import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useContactForm, validateContactFields } from "../useContactForm";

describe("validateContactFields", () => {
  it("exige nome e mensagem mínimos", () => {
    const errors = validateContactFields({ name: "A", phone: "", message: "oi" });

    expect(errors.name).toBeDefined();
    expect(errors.message).toBeDefined();
    expect(errors.phone).toBeUndefined();
  });

  it("aceita telefone vazio, mas valida o formato quando preenchido", () => {
    expect(validateContactFields({ name: "Maria", phone: "", message: "Olá, tudo bem?" })).toEqual({});

    const shortPhone = validateContactFields({ name: "Maria", phone: "9999", message: "Olá, tudo bem?" });
    expect(shortPhone.phone).toBeDefined();

    const validPhone = validateContactFields({
      name: "Maria",
      phone: "(44) 99999-0000",
      message: "Olá, tudo bem?",
    });
    expect(validPhone.phone).toBeUndefined();
  });
});

describe("useContactForm", () => {
  it("não abre o WhatsApp com o formulário inválido e expõe os erros", () => {
    const openUrl = vi.fn();
    const { result } = renderHook(() => useContactForm(openUrl));

    act(() => result.current.submit());

    expect(openUrl).not.toHaveBeenCalled();
    expect(result.current.errors.name).toBeDefined();
    expect(result.current.errors.message).toBeDefined();
  });

  it("abre o WhatsApp com a mensagem montada quando os campos são válidos", () => {
    const openUrl = vi.fn();
    const { result } = renderHook(() => useContactForm(openUrl));

    act(() => {
      result.current.setField("name", "Maria Silva");
      result.current.setField("message", "Vocês têm caneca térmica?");
    });
    act(() => result.current.submit());

    expect(openUrl).toHaveBeenCalledTimes(1);
    const url = openUrl.mock.calls[0][0] as string;
    expect(url).toContain("https://wa.me/");
    expect(url).toContain(encodeURIComponent("Maria Silva"));
    expect(url).toContain(encodeURIComponent("caneca térmica"));
    // Telefone vazio não vira linha "Telefone:" na mensagem.
    expect(url).not.toContain(encodeURIComponent("Telefone:"));
  });

  it("limpa o erro do campo assim que a pessoa volta a digitar nele", () => {
    const { result } = renderHook(() => useContactForm(vi.fn()));

    act(() => result.current.submit());
    expect(result.current.errors.name).toBeDefined();

    act(() => result.current.setField("name", "M"));
    expect(result.current.errors.name).toBeUndefined();
  });
});
