import { describe, expect, it } from "vitest";
import { buildPromotionPrompt, describeValidity, extractAttribute } from "../promotionPrompt";
import type { PromotionPromptInput } from "../promotionPrompt";

/**
 * O prompt da arte.
 *
 * O que está protegido aqui é o que **vai impresso no cartaz** que circula no
 * grupo de WhatsApp: preço, limite e validade. Um erro nessas três linhas não é
 * um erro de tela — é a cliente na porta da loja cobrando um preço que acabou.
 *
 * As três artes de referência (copo americano, xuxinhas, batons) divergem entre
 * si, então os testes cobrem os blocos CONDICIONAIS: o que entra quando o dado
 * existe, e o que não entra quando ele não existe.
 */

// 19/09/2026 é um sábado.
const SABADO = new Date(2026, 8, 19, 10, 0);

function entrada(parcial: Partial<PromotionPromptInput> = {}): PromotionPromptInput {
  return {
    productName: "Copo Americano",
    price: 0.99,
    validFrom: "2026-09-19T14:00:00",
    validUntil: "2026-09-19T18:00:59",
    format: "feed",
    signature: "Máximo 30",
    ...parcial,
  };
}

describe("describeValidity", () => {
  it("o dia inteiro de hoje", () => {
    const frase = describeValidity("2026-09-19T00:00:00", "2026-09-19T23:59:59", SABADO);

    expect(frase).toBe("VÁLIDO APENAS PARA HOJE!");
  });

  it("hoje ATÉ uma hora — só quando a promoção já começou de manhã cedo", () => {
    // Começa à meia-noite: o "até" sozinho é verdadeiro.
    expect(describeValidity("2026-09-19T00:00:00", "2026-09-19T12:00:59", SABADO)).toBe(
      "SOMENTE HOJE ATÉ O MEIO-DIA!",
    );
  });

  it("hoje COM horário de início diz as duas pontas", () => {
    // REGRESSÃO: o ramo de hoje descartava o início. Sábado 9h, o dono cadastra a
    // relâmpago de 14h–18h do próprio dia, gera a arte e publica no grupo às
    // 9h30: "SOMENTE HOJE ATÉ AS 18H" faz a cliente chegar às 10h e o caixa
    // cobrar o preço cheio.
    expect(describeValidity("2026-09-19T14:00:00", "2026-09-19T18:00:59", SABADO)).toBe(
      "SOMENTE HOJE, DAS 14H ÀS 18H!",
    );
    expect(describeValidity("2026-09-19T08:00:00", "2026-09-19T12:00:59", SABADO)).toBe(
      "SOMENTE HOJE, DAS 8H AO MEIO-DIA!",
    );
  });

  it("a meia-noite tem nome, como o meio-dia", () => {
    // "DAS 0H" não é frase de cartaz. O horário de início é opcional e o padrão
    // é 00:00, então o caso aparece sozinho.
    const quinta = new Date(2026, 8, 17, 9, 0);

    expect(describeValidity("2026-09-19T00:00:00", "2026-09-19T10:00:59", quinta)).toBe(
      "SOMENTE NESTE SÁBADO, DA MEIA-NOITE ÀS 10H!",
    );
  });

  it("o dia futuro COM horário não duplica a preposição", () => {
    // REGRESSÃO: a hora trazia o "AS" junto e o template punha outro, então o
    // ramo que a loja mais usa — a relâmpago de sábado das 14h às 18h, cadastrada
    // na sexta — saía "DAS AS 14H ÀS AS 18H" impresso no cartaz do WhatsApp.
    const sexta = new Date(2026, 8, 18, 16, 0);

    expect(describeValidity("2026-09-19T14:00:00", "2026-09-19T18:00:59", sexta)).toBe(
      "SOMENTE NESTE SÁBADO, DAS 14H ÀS 18H!",
    );
  });

  it("o meio-dia rege as duas pontas do intervalo", () => {
    const quinta = new Date(2026, 8, 17, 9, 0);

    expect(describeValidity("2026-09-19T12:00:00", "2026-09-19T18:00:59", quinta)).toBe(
      "SOMENTE NESTE SÁBADO, DO MEIO-DIA ÀS 18H!",
    );
    expect(describeValidity("2026-09-19T08:00:00", "2026-09-19T12:00:59", quinta)).toBe(
      "SOMENTE NESTE SÁBADO, DAS 8H AO MEIO-DIA!",
    );
  });

  it("concorda com o gênero do dia da semana", () => {
    // REGRESSÃO: "NESTE SEGUNDA-FEIRA". Cinco dos sete dias são "-feira", e feira
    // é feminina — o artigo fixo errava na maioria da semana.
    const domingo = new Date(2026, 8, 20, 9, 0);

    // 21/09/2026 é segunda; 26/09/2026 é sábado.
    expect(describeValidity("2026-09-21T00:00:00", "2026-09-21T23:59:59", domingo)).toBe(
      "SOMENTE NESTA SEGUNDA-FEIRA — O DIA TODO!",
    );
    expect(describeValidity("2026-09-25T00:00:00", "2026-09-25T23:59:59", domingo)).toBe(
      "SOMENTE NESTA SEXTA-FEIRA — O DIA TODO!",
    );
  });

  it("a sete dias volta a data, porque o dia da semana seria o de hoje", () => {
    // "NESTE SÁBADO" lido num sábado significa HOJE.
    const sabado = new Date(2026, 8, 19, 9, 0);

    expect(describeValidity("2026-09-26T00:00:00", "2026-09-26T23:59:59", sabado)).toContain("26/09/2026");
  });

  it("o dia futuro é nomeado pelo dia da semana dentro da semana", () => {
    // Cadastrada na sexta para o sábado: "NESTE SÁBADO" é o que a cliente
    // confere sem abrir o calendário.
    const sexta = new Date(2026, 8, 18, 16, 0);

    expect(describeValidity("2026-09-19T00:00:00", "2026-09-19T23:59:59", sexta)).toBe(
      "SOMENTE NESTE SÁBADO — O DIA TODO!",
    );
  });

  it("além de uma semana, a data não tem substituto", () => {
    // "No sábado" a três semanas daqui é ambíguo, e o cartaz não pode ser.
    const hoje = new Date(2026, 8, 1, 9, 0);

    expect(describeValidity("2026-09-26T00:00:00", "2026-09-26T23:59:59", hoje)).toContain("26/09/2026");
  });

  it("sem prazo não inventa data", () => {
    expect(describeValidity("2026-09-19T00:00:00", null, SABADO)).toBe("PROMOÇÃO POR TEMPO LIMITADO!");
  });
});

describe("extractAttribute", () => {
  it("acha a medida no nome", () => {
    expect(extractAttribute("COPO AMERICANO 300ML")).toBe("300ML");
    expect(extractAttribute("BALDE DE PLASTICO 12L")).toBe("12L");
    expect(extractAttribute("XICARAS DE VIDRO 6 PÇS")).toBe("6PÇS");
  });

  it("acha na descrição quando o nome não tem", () => {
    expect(extractAttribute("JARRA MARACATU", "Jarra de 1,560ml com tampa")).toBe("1,560ML");
  });

  it("não inventa medida onde não há", () => {
    // "TAMANHO ÚNICO" escrito no cartaz seria afirmação que ninguém conferiu.
    expect(extractAttribute("CANECA DE PORCELANA")).toBeNull();
  });

  it("a dimensão dupla sai inteira", () => {
    // REGRESSÃO: a regra pegava só a segunda medida, e o cartaz da toalha 45×70
    // saía anunciando uma toalha de "70CM" — que não é o produto.
    expect(extractAttribute("TOALHA DE ROSTO 45X70CM")).toBe("45X70CM");
    expect(extractAttribute("TAPETE 40 x 60 CM")).toBe("40X60CM");
  });
});

describe("buildPromotionPrompt", () => {
  it("manda escrever exatamente o que está entre aspas, em português", () => {
    const texto = buildPromotionPrompt(entrada(), SABADO);

    expect(texto).toContain("escreva EXATAMENTE o que está entre aspas, em português do Brasil");
    expect(texto).toContain('"COPO AMERICANO"');
    expect(texto).toContain('"R$ 0,99"');
    expect(texto).toContain('"SOMENTE HOJE, DAS 14H ÀS 18H!"');
    expect(texto).toContain('"Máximo 30"');
  });

  it("o limite só entra quando existe", () => {
    expect(buildPromotionPrompt(entrada({ maxQuantityPerSale: 6 }), SABADO)).toContain(
      '"LIMITE DE 6 UNIDADES POR CLIENTE"',
    );
    expect(buildPromotionPrompt(entrada(), SABADO)).not.toContain("LIMITE DE");
  });

  it("o endereço só entra quando a loja tem um cadastrado", () => {
    // Duas das três artes publicadas trazem endereço; uma não. Por isso o bloco
    // é condicional em vez de obrigatório.
    const com = buildPromotionPrompt(
      entrada({ addressLine: "Av. Brasil, 100", cityState: "TAPIRA-PR" }),
      SABADO,
    );

    expect(com).toContain('"Av. Brasil, 100 — TAPIRA-PR"');
    expect(buildPromotionPrompt(entrada(), SABADO)).not.toContain("Endereço");
  });

  it("preço que varia entre variações vira A PARTIR DE", () => {
    // Percentual num grupo de preços diferentes dá preços diferentes, e o cartaz
    // não pode prometer o menor como se valesse para todas.
    const texto = buildPromotionPrompt(entrada({ price: 0.99, priceMax: 1.49 }), SABADO);

    expect(texto).toContain('"A PARTIR DE"');
    expect(texto).not.toContain('"POR APENAS"');
  });

  it("o 9:16 reserva a área que a interface do Instagram cobre", () => {
    const story = buildPromotionPrompt(entrada({ format: "story" }), SABADO);
    const feed = buildPromotionPrompt(entrada({ format: "feed" }), SABADO);

    expect(story).toContain("9:16");
    expect(story).toContain("interface do Instagram cobre");
    expect(feed).not.toContain("interface do Instagram");
  });
});
