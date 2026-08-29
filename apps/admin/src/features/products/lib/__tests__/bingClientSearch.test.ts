import { describe, expect, it } from "vitest";
import { tokenize, getStem, matchesQuery, parseResults } from "../bingClientSearch";

describe("bingClientSearch", () => {
  describe("tokenize", () => {
    it("remove acentos, pontuacao e stopwords", () => {
      expect(tokenize("ESMALTE RISQUÉ 8ml - Kit c/ 4")).toEqual(["esmalte", "risque"]);
    });

    it("mantém tokens de 3 letras quando significativos", () => {
      expect(tokenize("RODINHO DE PIA")).toEqual(["rodinho", "pia"]);
    });

    it("retorna vazio para texto sem palavras uteis", () => {
      expect(tokenize("de")).toEqual([]);
      expect(tokenize("")).toEqual([]);
    });

    it("preserva tokens numericos quando nao ha alfabeticos", () => {
      expect(tokenize("7891000100103")).toEqual(["7891000100103"]);
    });
  });

  describe("getStem", () => {
    it("remove diminutivo -inho", () => {
      expect(getStem("rodinho")).toBe("rod");
    });

    it("remove plural -s", () => {
      expect(getStem("grampos")).toBe("grampo");
    });

    it("remove plural -es", () => {
      expect(getStem("mulheres")).toBe("mulher");
    });

    it("nao altera palavras curtas", () => {
      expect(getStem("pia")).toBe("pia");
    });
  });

  describe("matchesQuery", () => {
    it("aceita quando 2+ de 3 tokens da query aparecem no titulo", () => {
      const tokens = tokenize("GRAMPOS DE CABELO ESTRELA");
      expect(matchesQuery("Grampos De Cabelo Estrela 16pcs Y2K", tokens)).toBe(true);
    });

    it("rejeita quando nenhum token da query aparece no titulo", () => {
      const tokens = tokenize("GRAMPOS DE CABELO ESTRELA");
      expect(matchesQuery("Doki Doki Literature Club OST", tokens)).toBe(false);
    });

    it("aceita rodinho de pia com titulo usando rodo", () => {
      const tokens = tokenize("RODINHO DE PIA");
      expect(matchesQuery("Rodo de Pia Plástico Plasvale", tokens)).toBe(true);
    });

    it("aceita esmalte risque", () => {
      const tokens = tokenize("ESMALTE RISQUÉ");
      expect(matchesQuery("ESMALTE RISQUE VERMELHO FELICIDADE", tokens)).toBe(true);
    });

    it("aceita tudo quando nao ha tokens uteis", () => {
      const tokens = tokenize("");
      expect(matchesQuery("Qualquer coisa", tokens)).toBe(true);
    });
  });

  describe("parseResults", () => {
    const buildHtml = (tiles: { murl: string; turl: string; t: string }[]) =>
      tiles
        .map((tile) => `<div class="iusc" m="${JSON.stringify(tile).replace(/"/g, "&quot;")}"></div>`)
        .join("");

    it("extrai resultados pertinentes e descarta irrelevantes", () => {
      const html = buildHtml([
        {
          murl: "https://img1.com/grampo.jpg",
          turl: "https://img1.com/t.jpg",
          t: "Grampos De Cabelo Estrela 16pcs",
        },
        {
          murl: "https://img2.com/random.jpg",
          turl: "https://img2.com/t.jpg",
          t: "Random Video Game Screenshot",
        },
        {
          murl: "https://img3.com/grampo2.jpg",
          turl: "https://img3.com/t.jpg",
          t: "Kit Grampo Cabelo Estrela Infantil",
        },
      ]);

      const results = parseResults(html, 10, "GRAMPOS DE CABELO ESTRELA");
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Grampos De Cabelo Estrela 16pcs");
      expect(results[1].title).toBe("Kit Grampo Cabelo Estrela Infantil");
    });

    it("respeita o limite de resultados", () => {
      const html = buildHtml([
        { murl: "https://img1.com/a.jpg", turl: "https://img1.com/t.jpg", t: "Rodinho de Pia Compacto" },
        { murl: "https://img2.com/b.jpg", turl: "https://img2.com/t.jpg", t: "Rodo de Pia Cozinha Trium" },
        { murl: "https://img3.com/c.jpg", turl: "https://img3.com/t.jpg", t: "Rodo Pia Sanremo Plástico" },
      ]);

      const results = parseResults(html, 2, "RODINHO DE PIA");
      expect(results).toHaveLength(2);
    });

    it("retorna vazio para HTML sem tiles", () => {
      expect(parseResults("<html><body>nada</body></html>", 10, "teste")).toEqual([]);
    });
  });
});
