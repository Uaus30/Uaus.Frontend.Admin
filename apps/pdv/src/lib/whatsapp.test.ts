import { describe, expect, it } from "vitest";
import { toWhatsappNumber, whatsappReceiptUrl } from "./whatsapp";

describe("toWhatsappNumber", () => {
  it.each([
    ["44999990001", "5544999990001"],
    ["(44) 99999-0001", "5544999990001"],
    ["4433334444", "554433334444"],
    ["5544999990001", "5544999990001"],
  ])("%s vira %s", (phone, expected) => {
    expect(toWhatsappNumber(phone)).toBe(expected);
  });

  it.each([null, undefined, "", "99990001", "123"])(
    "%s não vira destino: sem DDD o comprovante iria para outra pessoa",
    (phone) => {
      expect(toWhatsappNumber(phone)).toBeNull();
    },
  );
});

describe("whatsappReceiptUrl", () => {
  it("com o telefone, abre a conversa com o cliente", () => {
    expect(whatsappReceiptUrl("Total: R$ 5,00", "44999990001")).toBe(
      "https://wa.me/5544999990001?text=Total%3A%20R%24%205%2C00",
    );
  });

  it("sem telefone, o WhatsApp pergunta para quem mandar", () => {
    const url = whatsappReceiptUrl("*TOTAL*\nok");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    // Quebra de linha e negrito chegam inteiros na mensagem.
    expect(decodeURIComponent(url.split("text=")[1])).toBe("*TOTAL*\nok");
  });
});
