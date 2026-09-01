import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESULTS_TOP_GAP, useKeepResultsInView } from "../useKeepResultsInView";

const VIEWPORT_HEIGHT = 800;

/** Posição de scroll da janela — jsdom não rola nada sozinho. */
function rolarPara(scrollY: number) {
  Object.defineProperty(window, "scrollY", { value: scrollY, writable: true, configurable: true });
}

/**
 * Dublê da coluna de resultados. `getBoundingClientRect` em jsdom devolve tudo
 * zerado, então a grade é descrita pela posição dela no documento e pela
 * altura, e o retângulo é derivado do scroll atual.
 */
function gradeDe({ top, height }: { top: number; height: number }) {
  const node = document.createElement("div");
  node.getBoundingClientRect = () => ({ top: top - window.scrollY, height }) as DOMRect;
  return node;
}

/** Monta o hook já com a coluna na ref, como a página faz. */
function montar(node: HTMLDivElement, enabled = true) {
  const ref = { current: node as HTMLDivElement | null };
  return renderHook(({ key, ligado }) => useKeepResultsInView(ref, key, ligado), {
    initialProps: { key: "antes", ligado: enabled },
  });
}

describe("useKeepResultsInView", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: VIEWPORT_HEIGHT, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não mexe na página quando a lista nova ainda passa da tela", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    rolarPara(2500);

    const { rerender } = montar(gradeDe({ top: 700, height: 2600 }));
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("puxa até o começo da grade quando a lista nova é curta demais", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // Um produto só: sem correção, o visitante ficaria olhando o rodapé.
    rolarPara(960);

    const { rerender } = montar(gradeDe({ top: 700, height: 430 }));
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).toHaveBeenCalledWith({ top: 700 - RESULTS_TOP_GAP });
  });

  it("para no fim da grade, não no começo, quando a lista ainda enche a tela", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // Fim da grade em 2100 e o visitante em 3000: a lista inteira ficou acima
    // da tela.
    rolarPara(3000);

    const { rerender } = montar(gradeDe({ top: 700, height: 1400 }));
    rerender({ key: "depois", ligado: true });

    // Fim da grade (2100) encostado no rodapé da tela.
    expect(scrollSpy).toHaveBeenCalledWith({ top: 2100 - VIEWPORT_HEIGHT });
  });

  it("deixa quieto quem ainda vê produto, mesmo perto do fim da lista", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // Fim da grade em 2941, visitante em 2600: sobrou grade na tela, então a
    // posição dele é boa — corrigir aqui seria o mesmo pulo de antes, menor.
    rolarPara(2600);

    const { rerender } = montar(gradeDe({ top: 568, height: 2373 }));
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("mede a grade, não a coluna — o rabo da lista não conta como produto na tela", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // Coluna vai até 1240 por causa do sentinela e do "isso é tudo"; a grade
    // acaba em 998. Em 961 o visitante não vê produto nenhum.
    rolarPara(961);

    const coluna = gradeDe({ top: 568, height: 672 });
    const grade = gradeDe({ top: 568, height: 430 });
    grade.setAttribute("data-catalog-results", "");
    coluna.append(grade);

    const { rerender } = montar(coluna);
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).toHaveBeenCalledWith({ top: 568 - RESULTS_TOP_GAP });
  });

  it("nunca desce a página — posição mais alta que a grade fica como está", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    rolarPara(0);

    const { rerender } = montar(gradeDe({ top: 700, height: 430 }));
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("segura a altura da coluna enquanto a lista nova está em voo", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    rolarPara(2500);

    const { result, rerender } = montar(gradeDe({ top: 700, height: 2600 }));
    rerender({ key: "medida", ligado: true });
    // Chegou a lista nova? Ainda não: o documento não pode encolher no meio,
    // senão o navegador gruda o scroll no novo fim e sobe a página sozinho.
    rerender({ key: "carregando", ligado: false });

    expect(result.current).toEqual({ minHeight: 2600 });
  });

  it("solta a altura quando a lista nova chega", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    rolarPara(2500);

    const { result, rerender } = montar(gradeDe({ top: 700, height: 2600 }));
    rerender({ key: "medida", ligado: true });
    rerender({ key: "carregando", ligado: false });
    rerender({ key: "depois", ligado: true });

    expect(result.current).toBeUndefined();
  });

  it("ignora coluna sem altura, que é grade que ainda não existe", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    rolarPara(1200);

    const { rerender } = montar(gradeDe({ top: 0, height: 0 }));
    rerender({ key: "depois", ligado: true });

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
