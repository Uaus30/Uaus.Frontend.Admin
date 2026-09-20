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
    render(<PriceTag price={1.75} promotion={promocao()} />);

    expect(screen.getByText(/0,99/)).toBeTruthy();
    expect(screen.getByText(/1,75/)).toBeTruthy();
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
