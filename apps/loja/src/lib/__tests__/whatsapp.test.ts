import { describe, expect, it } from "vitest";
import { formatCurrency } from "@workspace/core";
import { buildContactMessage, buildReservationMessage, buildWhatsAppUrl } from "../whatsapp";
import { SITE_CONTACT } from "../site";

describe("buildWhatsAppUrl", () => {
  it("monta o wa.me da loja com a mensagem codificada", () => {
    const url = buildWhatsAppUrl("Olá! Tudo bem?");

    expect(url).toBe(
      `https://wa.me/${SITE_CONTACT.whatsappNumber}?text=${encodeURIComponent("Olá! Tudo bem?")}`,
    );
  });

  it("codifica quebra de linha e acento — WhatsApp recebe texto cru da URL", () => {
    const url = buildWhatsAppUrl("linha 1\nlinha 2 com ç");

    expect(url).toContain("linha%201%0Alinha%202%20com%20%C3%A7");
  });
});

describe("buildContactMessage", () => {
  it("monta a mensagem com nome, telefone e texto", () => {
    const message = buildContactMessage({
      name: "  Maria Silva  ",
      phone: " (44) 99999-0000 ",
      message: " Vocês têm caneca térmica? ",
    });

    expect(message).toBe(
      "Olá! Meu nome é Maria Silva.\nTelefone: (44) 99999-0000\n\nVocês têm caneca térmica?",
    );
  });

  it("omite a linha do telefone quando não informado", () => {
    const message = buildContactMessage({ name: "João", message: "Oi!" });

    expect(message).not.toContain("Telefone:");
    expect(message).toBe("Olá! Meu nome é João.\n\nOi!");
  });
});

describe("buildReservationMessage", () => {
  it("cita nome, preço formatado e o link do produto", () => {
    const message = buildReservationMessage({
      name: "Caneca Personalizada",
      price: 25,
      url: "https://uaus.com.br/produtos/905",
    });

    expect(message).toContain("*Caneca Personalizada*");
    // A expectativa deriva do próprio formatCurrency: o pt-BR separa "R$" do
    // número com espaço NÃO SEPARÁVEL (U+00A0), e fixar a string na mão prende
    // o teste à tipografia do Intl, não ao comportamento.
    expect(message).toContain(formatCurrency(25));
    expect(message).toContain("https://uaus.com.br/produtos/905");
  });

  it("vira 'a partir de' quando o grupo tem faixa de preço", () => {
    const message = buildReservationMessage({ name: "Caneca", price: 25, priceMax: 35 });

    expect(message).toContain(`a partir de ${formatCurrency(25)}`);
    expect(message).not.toContain(formatCurrency(35));
  });

  it("inclui a variação escolhida quando houver", () => {
    const message = buildReservationMessage({
      name: "Caneca",
      price: 25,
      variationName: "Caneca 300ml",
    });

    expect(message).toContain("Variação: Caneca 300ml");
  });

  it("não inclui linha de variação nem link quando ausentes", () => {
    const message = buildReservationMessage({ name: "Caneca", price: 25 });

    expect(message).not.toContain("Variação:");
    expect(message).not.toContain("http");
  });
});
