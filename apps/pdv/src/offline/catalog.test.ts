import { describe, expect, it } from "vitest";
import { filterCustomers, filterProducts, normalizeForSearch } from "./catalog";
import type { LocalCustomer, LocalProduct } from "./types";

/** Monta um produto da base local com o campo de busca já normalizado. */
function product(id: number, name: string, barcode: string, stock = 10): LocalProduct {
  return {
    id,
    name,
    barcode,
    price: 10,
    stock,
    status: 2,
    productGroupId: 1,
    searchName: normalizeForSearch(name),
  };
}

/** Monta um cliente da base local com o campo de busca já normalizado. */
function customer(id: number, name: string, document: string | null): LocalCustomer {
  return { id, name, document, phone: null, searchName: normalizeForSearch(name) };
}

const CATALOG = [
  product(1, "Café torrado", "111"),
  product(2, "Caneta azul", "222"),
  product(3, "Descafeinado premium", "333"),
  product(4, "Borracha", "1112"),
];

describe("normalizeForSearch", () => {
  it("deve remover acentos e baixar a caixa", () => {
    expect(normalizeForSearch("Café João ÁÉÍÓÚ")).toBe("cafe joao aeiou");
  });
});

describe("filterProducts", () => {
  it("deve devolver vazio com o termo em branco", () => {
    expect(filterProducts(CATALOG, "   ")).toEqual([]);
  });

  it("deve achar por nome ignorando acento", () => {
    // O operador digita "cafe" e precisa achar "Café".
    expect(filterProducts(CATALOG, "cafe").map((p) => p.id)).toEqual([1, 3]);
  });

  it("deve priorizar o código de barras exato", () => {
    // Leitor bipando: o match exato tem que vir primeiro, senão o produto de
    // código parecido entraria no carrinho.
    expect(filterProducts(CATALOG, "111")[0].id).toBe(1);
  });

  it("deve priorizar nome que começa com o termo sobre nome que contém", () => {
    expect(filterProducts(CATALOG, "cafe").map((p) => p.name)).toEqual([
      "Café torrado",
      "Descafeinado premium",
    ]);
  });

  it("deve achar por código de barras parcial", () => {
    expect(filterProducts(CATALOG, "1112").map((p) => p.id)).toEqual([4]);
  });

  it("deve respeitar o limite de resultados", () => {
    expect(filterProducts(CATALOG, "a", 2)).toHaveLength(2);
  });

  it("não deve trazer produto que não casa com o termo", () => {
    expect(filterProducts(CATALOG, "xyz")).toEqual([]);
  });

  // A partir daqui, a paridade com a busca ONLINE. A busca do balcão troca de
  // motor conforme a internet; divergir faz o operador achar o produto com rede
  // e não achar sem, sem nada na tela explicando.
  const COMBINADOS = [
    product(10, "BACIA PLÁSTICA 2L C/ TAMPA", "7891000001"),
    product(11, "TAMPA AVULSA PARA BACIA", "7891000002"),
    product(12, "APOIO DE BACIA INOX", "7891000006"),
    product(13, "CHICLETE BUBBALOO [uva]", "7891000004"),
    product(14, "COPO TÉRMICO 473ML", "7891000005"),
  ];

  it("deve casar combinando os termos, em qualquer ordem", () => {
    // O caso que motivou a fase 2: "bacia com tampa" não existe literalmente em
    // "BACIA PLÁSTICA 2L C/ TAMPA" — o "com" está escrito "C/".
    //
    // O que se afirma aqui é o CONJUNTO: trocar a ordem das palavras não muda
    // quem casa. A ordem entre eles muda, e deve mudar — quem digita "tampa"
    // primeiro vê antes o que começa com "TAMPA". Isso é o teste de relevância
    // abaixo, e é o mesmo degrau que o backend aplica.
    expect(filterProducts(COMBINADOS, "bacia com tampa").map((p) => p.id)).toEqual([10, 11]);
    expect(
      filterProducts(COMBINADOS, "tampa bacia")
        .map((p) => p.id)
        .sort(),
    ).toEqual([10, 11]);
  });

  it("deve pôr na frente o que começa com a primeira palavra digitada", () => {
    // Mesmo degrau do backend: entre dois produtos que casam com as duas
    // palavras, ganha o que começa pela que o operador digitou primeiro.
    expect(filterProducts(COMBINADOS, "tampa bacia")[0].id).toBe(11);
    expect(filterProducts(COMBINADOS, "bacia tampa")[0].id).toBe(10);
  });

  it("deve achar pelo valor da grade, que vem dentro do nome local", () => {
    // O snapshot compõe o nome com o colchete antes de gravar, então a variação
    // é alcançável offline como é no servidor.
    expect(filterProducts(COMBINADOS, "bubbaloo uva").map((p) => p.id)).toEqual([13]);
  });

  it("deve achar por pedaço de palavra enquanto o operador digita", () => {
    // O campo busca a cada tecla: exigir a palavra inteira deixaria a lista
    // vazia até a última letra.
    expect(filterProducts(COMBINADOS, "termic").map((p) => p.id)).toEqual([14]);
  });

  it("deve ordenar por relevância, não por nome", () => {
    // Por nome a ordem seria APOIO, BACIA, TAMPA — e o que o operador procura
    // cairia no meio. Mesmos degraus do backend.
    expect(filterProducts(COMBINADOS, "bacia").map((p) => p.id)).toEqual([10, 12, 11]);
  });

  it("deve exigir TODAS as palavras", () => {
    expect(filterProducts(COMBINADOS, "bacia inexistente")).toEqual([]);
  });
});

describe("filterCustomers", () => {
  const CUSTOMERS = [
    customer(1, "Ana Souza", "123.456.789-01"),
    customer(2, "Bruno Émerson", "98765432100"),
    customer(3, "Carla", null),
  ];

  it("deve achar por nome ignorando acento", () => {
    expect(filterCustomers(CUSTOMERS, "emerson").map((c) => c.id)).toEqual([2]);
  });

  it("deve achar por documento sem pontuação", () => {
    // O cadastro guarda com pontos, o operador digita só os números.
    expect(filterCustomers(CUSTOMERS, "12345678901").map((c) => c.id)).toEqual([1]);
  });

  it("deve achar por documento com pontuação", () => {
    expect(filterCustomers(CUSTOMERS, "987.654.321-00").map((c) => c.id)).toEqual([2]);
  });

  it("deve ignorar cliente sem documento na busca por número", () => {
    expect(filterCustomers(CUSTOMERS, "999")).toEqual([]);
  });

  it("deve devolver vazio com o termo em branco", () => {
    expect(filterCustomers(CUSTOMERS, "")).toEqual([]);
  });
});
