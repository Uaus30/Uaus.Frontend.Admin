import { describe, expect, it } from "vitest";
import { compararContrato } from "./comparar.mjs";
import { parseCSharpFile, parseEnums, toCamelCase } from "./parse-csharp.mjs";
import { parseTypeScriptFile } from "./parse-typescript.mjs";

/**
 * Os testes reproduzem defeitos REAIS que já custaram tela quebrada, escritos
 * com o mesmo formato de código dos dois repositórios. Um teste que só afirma o
 * que o próprio dublê devolve não protege nada; estes falham se o comparador
 * parar de enxergar o defeito que motivou a ferramenta.
 */

const SERIALIZACAO_ATUAL = { ignoraNulos: true, enumComoTexto: true };

/** Monta o retrato do backend a partir de um trecho de C#, como o extrator faz. */
function contratoDe(csharp, { serializacao = SERIALIZACAO_ATUAL } = {}) {
  return {
    versao: 1,
    geradoEm: "2026-08-15",
    origem: { repositorio: "teste", commit: null, commitData: null, pastas: [], arquivos: 1 },
    serializacao,
    enums: parseEnums(csharp),
    tipos: parseCSharpFile(csharp, "Teste.cs"),
  };
}

const conferir = (csharp, typescript, opcoes) =>
  compararContrato(contratoDe(csharp, opcoes), parseTypeScriptFile(typescript, "models.ts"));

const regras = (resultado) => resultado.achados.map((a) => `${a.regra}|${a.tipo}.${a.campo}`);

describe("o defeito que derrubou a tela de Desempenho", () => {
  // `decimal? ChangePercentage` + WhenWritingNull = campo OMITIDO do JSON. O
  // tipo dizia `number | null` sem `?`, o `=== null` da tela nunca dava true e
  // a página ficou preta.
  const CSHARP = `
    namespace Uaus.Application.DTOs.Dashboard
    {
        public class PerformanceRangeDto
        {
            public decimal Revenue { get; set; }
            /// <summary>Variação percentual, ou <c>null</c> quando não há base.</summary>
            public decimal? ChangePercentage { get; set; }
        }
    }`;

  it("acusa o campo anulável declarado sem `?` no TypeScript", () => {
    const resultado = conferir(
      CSHARP,
      `export interface PerformanceRangeDto {
         revenue: number;
         changePercentage: number | null;
       }`,
    );

    expect(regras(resultado)).toEqual(["nulo-sem-opcional|PerformanceRangeDto.changePercentage"]);
    expect(resultado.achados[0].severidade).toBe("alto");
  });

  it("aceita o campo depois do conserto, com `?`", () => {
    const resultado = conferir(
      CSHARP,
      `export interface PerformanceRangeDto {
         revenue: number;
         changePercentage?: number | null;
       }`,
    );

    expect(resultado.achados).toEqual([]);
  });

  it("separa o caso pior: sem `?` e sem `| null`, qualquer `.toFixed()` estoura", () => {
    const resultado = conferir(
      CSHARP,
      `export interface PerformanceRangeDto {
         revenue: number;
         changePercentage: number;
       }`,
    );

    expect(regras(resultado)).toEqual(["nulo-nao-declarado|PerformanceRangeDto.changePercentage"]);
  });

  it("cala a regra se o backend parar de omitir nulo", () => {
    // O dia em que alguém trocar para `JsonIgnoreCondition.Never`, `T | null`
    // sem `?` passa a ser a declaração CORRETA. A regra obedece ao retrato.
    const resultado = conferir(
      CSHARP,
      `export interface PerformanceRangeDto {
         revenue: number;
         changePercentage: number | null;
       }`,
      { serializacao: { ignoraNulos: false, enumComoTexto: true } },
    );

    expect(resultado.achados).toEqual([]);
  });
});

describe("enum serializado pelo nome", () => {
  it("acusa campo de enum tipado como `number`", () => {
    const resultado = conferir(
      `public enum UserRole { None, Admin, Seller }
       public class UserDto
       {
           public UserRole Role { get; set; }
       }`,
      `export interface UserDto { role: number; }`,
    );

    expect(regras(resultado)).toEqual(["enum-como-numero|UserDto.role"]);
  });

  it("aceita o alias EnumValue, que é como o repositório lê enum", () => {
    const resultado = conferir(
      `public enum UserRole { None, Admin }
       public class UserDto { public UserRole Role { get; set; } }`,
      `export interface UserDto { role: EnumValue; }`,
    );

    expect(resultado.achados).toEqual([]);
  });
});

describe("campo que o backend não tem", () => {
  it("acusa o campo inventado no front", () => {
    // Caso real: `ProductDto.canDelete` só existe no TypeScript, e o
    // `variation.canDelete === false` da tela nunca desabilitava o botão.
    const resultado = conferir(
      `public class ProductDto { public long Id { get; set; } }`,
      `export interface ProductDto { id: number; canDelete: boolean; }`,
    );

    expect(regras(resultado)).toEqual(["campo-inexistente-no-backend|ProductDto.canDelete"]);
  });
});

describe("o que o parser precisa entender para não mentir", () => {
  it("achata a herança em vez de acusar os campos do ancestral como ausentes", () => {
    const resultado = conferir(
      `public abstract class BaseDto { public decimal Total { get; set; } }
       public class CategoryReportDto : BaseDto { public long Id { get; set; } }`,
      `export interface CategoryReportDto { total: number; id: number; }`,
    );

    expect(resultado.achados).toEqual([]);
  });

  it("não confunde propriedade de classe aninhada com a da classe de fora", () => {
    const resultado = conferir(
      `public class ExternoDto
       {
           public long Id { get; set; }
           public class InternoDto { public string? Apelido { get; set; } }
       }`,
      `export interface ExternoDto { id: number; }`,
    );

    expect(resultado.achados).toEqual([]);
  });

  it("ignora `class` escrito dentro de comentário e de literal de texto", () => {
    const resultado = conferir(
      `namespace X
       {
           /// <summary>Esta é a class que resume o relatório.</summary>
           public class RelatorioDto
           {
               public string Rotulo { get; set; } = "public class Fantasma { }";
           }
       }`,
      `export interface RelatorioDto { rotulo: string; }`,
    );

    expect(resultado.achados).toEqual([]);
    expect(resultado.pares).toEqual(["RelatorioDto"]);
  });

  it("casa lista de C# com array do TypeScript, item a item", () => {
    const resultado = conferir(
      `public class ItemDto { public string? Nome { get; set; } }
       public class PedidoDto { public List<ItemDto> Itens { get; set; } = []; }`,
      `export interface ItemDto { nome?: string | null; }
       export interface PedidoDto { itens: ItemDto[]; }`,
    );

    expect(resultado.achados).toEqual([]);
  });

  it("acusa lista de um lado e valor único do outro", () => {
    const resultado = conferir(
      `public class PedidoDto { public List<string> Avisos { get; set; } = []; }`,
      `export interface PedidoDto { avisos: string; }`,
    );

    expect(regras(resultado)).toEqual(["colecao-divergente|PedidoDto.avisos"]);
  });

  it("casa tipo renomeado no front pela referência, sem acusar incompatibilidade", () => {
    const resultado = conferir(
      `public class PeriodTotalsDto { public decimal Revenue { get; set; } }
       public class ResumoDto { public PeriodTotalsDto Sales { get; set; } = null!; }`,
      `export interface FinancialPeriodTotalsDto { revenue: number; }
       export interface ResumoDto { sales: FinancialPeriodTotalsDto; }`,
    );

    // Sobra só o aviso do `= null!`, que é outro assunto: o C# jura não-nulo com
    // a checagem desligada. O que NÃO pode aparecer é `tipo-incompativel` — a
    // renomeação é deliberada e acusá-la faria o relatório perder credibilidade.
    expect(regras(resultado)).toEqual(["nulo-perdoado|ResumoDto.sales"]);
    expect(resultado.limites.some((l) => l.includes("por referência"))).toBe(true);
  });

  it("aplica a política camelCase do .NET inclusive em sigla", () => {
    expect(toCamelCase("ChangePercentage")).toBe("changePercentage");
    expect(toCamelCase("Id")).toBe("id");
    expect(toCamelCase("URL")).toBe("url");
    expect(toCamelCase("IPAddress")).toBe("ipAddress");
  });
});
