import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TITULO_DO_APP } from "@/lib/route-title";

/**
 * O admin instala no celular como app, com o nome e o logo da Uaus.
 *
 * Nada aqui quebra o build quando está errado: o Chrome só deixa de oferecer a
 * instalação de verdade e volta a criar um atalho com o favicon ampliado e o
 * título da aba. Quem descobre é o dono, no celular. O PDV já passou por isso:
 * declarava 512x512 para um PNG de 492x512, o Chrome descartava o ícone e o
 * caixa deixou de ser instalável sem erro nenhum na tela.
 */

/**
 * Lido do disco, como no `index-html.test.ts`: o cwd muda entre a suíte do app
 * e a do monorepo, então os dois caminhos são tentados.
 */
function caminhoNoApp(relativo: string): string {
  const candidatos = [resolve(process.cwd(), relativo), resolve(process.cwd(), `apps/admin/${relativo}`)];
  const encontrado = candidatos.find(existsSync);

  if (!encontrado) throw new Error(`${relativo} não encontrado em: ${candidatos.join(", ")}`);
  return encontrado;
}

/** Largura, altura e tipo de cor do PNG, lidos do cabeçalho IHDR. */
function lerPng(relativo: string): { largura: number; altura: number; tipoDeCor: number } {
  const bytes = readFileSync(caminhoNoApp(relativo));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");

  return { largura: bytes.readUInt32BE(16), altura: bytes.readUInt32BE(20), tipoDeCor: bytes[25] };
}

interface IconeDoManifesto {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const html = readFileSync(caminhoNoApp("index.html"), "utf-8");
const manifesto = JSON.parse(readFileSync(caminhoNoApp("public/manifest.webmanifest"), "utf-8")) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: IconeDoManifesto[];
};

describe("instalação do admin como app", () => {
  it("o index.html aponta para o manifesto", () => {
    expect(html).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/);
  });

  it("abre em tela cheia, sem a barra do navegador", () => {
    expect(manifesto.display).toBe("standalone");
    expect(manifesto.start_url).toBeTruthy();
  });

  it("mostra 'Admin' embaixo do ícone, no Android e no iPhone", () => {
    // Pedido do dono (05/10/2026). O Android lê o `short_name`; o iPhone, a
    // tag apple-mobile-web-app-title. Divergindo, o mesmo app teria um nome em
    // cada celular.
    expect(manifesto.short_name).toBe("Admin");
    expect(html).toContain(`<meta name="apple-mobile-web-app-title" content="${manifesto.short_name}" />`);
  });

  it("usa o nome completo da aba onde há espaço: instalação e configurações", () => {
    expect(manifesto.name).toBe(TITULO_DO_APP);
  });

  it("declara cada ícone com o tamanho real do arquivo", () => {
    for (const icone of manifesto.icons) {
      const { largura, altura } = lerPng(`public/${icone.src}`);
      expect(`${largura}x${altura}`, icone.src).toBe(icone.sizes);
    }
  });

  it("tem os ícones que o Chrome exige para instalar: 192 e 512, e um maskable", () => {
    const comum = manifesto.icons.filter((icone) => icone.purpose === "any").map((icone) => icone.sizes);
    expect(comum).toEqual(expect.arrayContaining(["192x192", "512x512"]));

    // O Android recorta o ícone num círculo ou squircle; o maskable tem fundo
    // até a borda e o logo dentro da zona segura, senão a alça da sacola some.
    expect(manifesto.icons.some((icone) => icone.purpose === "maskable")).toBe(true);
  });

  it("dá ao iPhone um ícone de 180x180 sem transparência", () => {
    expect(html).toMatch(/<link\s+rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"/);

    // Tipo de cor 2 é RGB puro. Com canal alfa (4 ou 6), o iOS pinta o
    // transparente de preto por conta própria, em vez do fundo do ícone.
    expect(lerPng("public/apple-touch-icon.png")).toEqual({ largura: 180, altura: 180, tipoDeCor: 2 });
  });
});
