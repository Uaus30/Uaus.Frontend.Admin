import { describe, expect, it } from "vitest";
import {
  AGE_RANGE,
  checkCustomerIdentity,
  ageRangeFromBirthDate,
  cityFromCityState,
  formatCpf,
  formatDateBr,
  isoDateToBr,
  isValidCpf,
  normalizeCpf,
  normalizePhone,
  parseCustomerSearch,
  parseDateBr,
  readDuplicateCustomer,
} from "./customer";

describe("normalizePhone", () => {
  it.each([
    ["99876-4321", "44998764321"],
    ["9876-4321", "4498764321"],
    ["(44) 99876-4321", "44998764321"],
    ["044 99876 4321", "44998764321"],
    ["+55 44 99876-4321", "44998764321"],
    ["(11) 98765-4321", "11987654321"],
    // Com 11 dígitos, 55 é o DDD de Santa Maria, não o código do país.
    ["55 99876-4321", "55998764321"],
  ])("guarda %s como %s, igual ao servidor", (typed, expected) => {
    expect(normalizePhone(typed, 44)).toEqual({ ok: true, phone: expected });
  });

  it("usa o DDD padrão da loja no número sem DDD", () => {
    expect(normalizePhone("99876-4321", 11).phone).toBe("11998764321");
  });

  it("campo vazio não é erro", () => {
    expect(normalizePhone("", 44)).toEqual({ ok: true, phone: null });
    expect(normalizePhone(" ( ) - ", 44)).toEqual({ ok: true, phone: null });
  });

  it.each(["1234567", "449987643210", "20 99876-4321", "44 89876-4321"])("recusa %s", (typed) => {
    expect(normalizePhone(typed, 44).ok).toBe(false);
  });
});

describe("CPF", () => {
  it("guarda só os dígitos, inclusive o zero da frente", () => {
    expect(normalizeCpf(" 012.345.678-90 ")).toBe("01234567890");
    expect(normalizeCpf("")).toBeNull();
  });

  it.each([
    ["52998224725", true],
    ["01234567890", true],
    ["52998224724", false],
    ["11111111111", false],
    ["5299822472", false],
  ])("confere os verificadores de %s", (digits, valid) => {
    expect(isValidCpf(digits)).toBe(valid);
  });

  it("aplica a máscara enquanto o operador digita", () => {
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("5299822")).toBe("529.982.2");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529982247251234")).toBe("529.982.247-25");
  });
});

describe("ageRangeFromBirthDate", () => {
  const today = new Date(2026, 9, 1);

  it.each([
    ["2008-10-02", AGE_RANGE.UpTo17],
    ["2008-10-01", AGE_RANGE.From18To24],
    ["2001-10-01", AGE_RANGE.From25To34],
    ["1966-10-02", AGE_RANGE.From45To59],
    ["1966-10-01", AGE_RANGE.From60],
  ])("quem nasceu em %s está na faixa %s, igual ao servidor", (birthDate, expected) => {
    expect(ageRangeFromBirthDate(birthDate, today)).toBe(expected);
  });

  it("devolve null com data inválida", () => {
    expect(ageRangeFromBirthDate("01/10/2000", today)).toBeNull();
  });
});

describe("data de nascimento digitada", () => {
  const today = new Date(2026, 9, 1);

  it("aplica a máscara dd/mm/aaaa", () => {
    expect(formatDateBr("0")).toBe("0");
    expect(formatDateBr("0103")).toBe("01/03");
    expect(formatDateBr("01031990")).toBe("01/03/1990");
  });

  it("converte para o formato da API", () => {
    expect(parseDateBr("01/03/1990", today)).toBe("1990-03-01");
  });

  it.each(["31/02/1990", "01/03/1899", "02/10/2026", "01/03/90"])("recusa %s", (typed) => {
    expect(parseDateBr(typed, today)).toBeNull();
  });

  it("volta do formato da API para o da tela", () => {
    expect(isoDateToBr("1990-03-01")).toBe("01/03/1990");
    expect(isoDateToBr(null)).toBe("");
  });
});

describe("cityFromCityState", () => {
  it.each([
    ["TAPIRA - PR", "Tapira"],
    ["TAPIRA/PR", "Tapira"],
    ["são jorge do ivaí - PR", "São Jorge Do Ivaí"],
    ["", ""],
  ])("tira a cidade de %s", (cityState, expected) => {
    expect(cityFromCityState(cityState)).toBe(expected);
  });
});

describe("parseCustomerSearch", () => {
  it("lê o telefone com máscara como número", () => {
    expect(parseCustomerSearch("(44) 99876-4321")).toMatchObject({
      digits: "44998764321",
      phoneDigits: "44998764321",
      isNumeric: true,
    });
  });

  it("tira o 55 e o zero só do lado do telefone", () => {
    expect(parseCustomerSearch("+55 44 99876-4321").phoneDigits).toBe("44998764321");
    expect(parseCustomerSearch("012.345.678-90")).toMatchObject({
      digits: "01234567890",
      phoneDigits: "1234567890",
    });
  });

  it("menos de 4 dígitos ou com letra é busca por nome", () => {
    expect(parseCustomerSearch("123").isNumeric).toBe(false);
    expect(parseCustomerSearch("Ana 1234").isNumeric).toBe(false);
  });
});

describe("readDuplicateCustomer", () => {
  it("lê o cliente do corpo do 409, em PascalCase", () => {
    const error = {
      payload: { Message: "Já existe", Conflict: { Id: 7, Name: "Maria", Phone: "44998764321" } },
    };

    expect(readDuplicateCustomer(error)).toEqual({
      id: 7,
      name: "Maria",
      phone: "44998764321",
      document: null,
    });
  });

  it("devolve null em erro sem o conflito", () => {
    expect(readDuplicateCustomer({ payload: { Message: "Telefone inválido" } })).toBeNull();
    expect(readDuplicateCustomer(new Error("rede"))).toBeNull();
  });
});

describe("checkCustomerIdentity", () => {
  const today = new Date(2026, 9, 1);
  const empty = { name: "", phone: "", document: "", birthDate: "" };

  it("normaliza o que está certo", () => {
    expect(
      checkCustomerIdentity(
        { name: "Ana", phone: "99876-4321", document: "529.982.247-25", birthDate: "01/03/1990" },
        44,
        today,
      ),
    ).toEqual({ errors: {}, phone: "44998764321", document: "52998224725", birthDate: "1990-03-01" });
  });

  it("exige o nome e o telefone ou o CPF", () => {
    const { errors } = checkCustomerIdentity(empty, 44, today);

    expect(Object.keys(errors).sort()).toEqual(["name", "phone"]);
  });

  it("aceita só o CPF", () => {
    expect(
      checkCustomerIdentity({ ...empty, name: "Ana", document: "52998224725" }, 44, today).errors,
    ).toEqual({});
  });

  it("aponta o campo errado", () => {
    const { errors } = checkCustomerIdentity(
      { name: "Ana", phone: "98765", document: "52998224724", birthDate: "31/02/1990" },
      44,
      today,
    );

    expect(Object.keys(errors).sort()).toEqual(["birthDate", "document", "phone"]);
  });
});
