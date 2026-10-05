/**
 * Para testes que MONTAM o editor (Tiptap/ProseMirror) no jsdom — importe por
 * efeito: `import "@/components/rich-text/__tests__/jsdom-layout";`.
 *
 * O jsdom não tem layout, e o `Range` dele não tem `getClientRects` nem
 * `getBoundingClientRect`. O autofocus do editor rola até o cursor depois de um
 * quadro, medindo a seleção — e a medida estourava FORA do teste, como exceção
 * não tratada que reprova a suíte inteira, e só às vezes (dependia de o teste
 * terminar antes ou depois do quadro; visto no gates de 05/10/2026). Lista
 * vazia e retângulo zerado é o que o ProseMirror já sabe tratar.
 */
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return [] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return new DOMRect(0, 0, 0, 0);
  };
}

export {};
