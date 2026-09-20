import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StorefrontPromotionDto } from "@workspace/api-client-react";
import { PriceTag } from "../PriceTag";

/**
 * O "de/por" da vitrine.
 *
 * O que está protegido é o número que a cliente lê antes de sair de casa. Se o
 * card mostrar o preço de tabela numa promoção vigente, ela desiste da viagem;
 * se mostrar o promocional depois que a promoção acabou, ela vem e o caixa
 * cobra outro valor.
 */
function promocao(parcial: Partial<StorefrontPromotionDto> = {}): StorefrontPromotionDto {
  return {
    // Pelo NOME, como a API manda de verdade.
    type: "Flash",
    price: 0.99,
    referencePrice: 1.75,
    ...parcial,
  };
}

describe("PriceTag", () => {
  it("sem promoção, mostra o preço de tabela", () => {
    render(<PriceTag price={25} />);

    expect(screen.getByText("Por apenas")).toBeTruthy();
    expect(screen.getByText(/25,00/)).toBeTruthy();
  });

  it("com promoção, o preço grande é o PROMOCIONAL e o de tabela vai riscado", () => {
    // Afirmar só que os dois números aparecem não discrimina: trocar um pelo
    // outro — o defeito que este arquivo existe para impedir — passaria igual.
    const { container } = render(<PriceTag price={1.75} promotion={promocao()} />);

    const grande = container.querySelector(".font-display");
    expect(grande?.textContent).toContain("0,99");

    const riscado = container.querySelector(".line-through");
    expect(riscado?.textContent).toContain("1,75");
  });

  it("a isca de desconto zero marca o produto sem inventar um de/por", () => {
    // O pote de R$ 2,00 da porta: para o cliente aquele preço É promocional,
    // ainda que nunca tenha sido mais caro (§13 do plano).
    const { container } = render(
      <PriceTag price={2} promotion={promocao({ type: "Everyday", price: 2, referencePrice: null })} />,
    );

    expect(container.querySelector(".line-through")).toBeNull();
    expect(screen.getByText("Por apenas")).toBeTruthy();
  });

  it("sem o de, não inventa um", () => {
    // Abaixo de 5% de corte o servidor nem manda o `referencePrice`: "de R$ 5,00
    // por R$ 4,90" é anúncio que não impressiona e desgasta a palavra promoção.
    render(<PriceTag price={25} promotion={promocao({ price: 24, referencePrice: null })} />);

    expect(screen.queryByText("de")).toBeNull();
    expect(screen.getByText(/24,00/)).toBeTruthy();
  });

  it("a faixa da promoção manda quando as variações têm preços diferentes", () => {
    render(<PriceTag price={25} priceMax={35} promotion={promocao({ price: 15, priceMax: 21 })} />);

    expect(screen.getByText("A partir de")).toBeTruthy();
    expect(screen.getByText(/15,00/)).toBeTruthy();
  });

  it("o limite por cliente sai junto quando existe", () => {
    // É o que a cliente precisa saber ANTES de sair de casa, e é o que o cartaz
    // do WhatsApp já diz.
    render(<PriceTag price={1.75} promotion={promocao({ maxQuantityPerSale: 6 })} />);

    expect(screen.getByText(/Limite de 6 por cliente/)).toBeTruthy();
    expect(render(<PriceTag price={1.75} promotion={promocao()} />).container.textContent).not.toContain(
      "Limite de",
    );
  });
});
