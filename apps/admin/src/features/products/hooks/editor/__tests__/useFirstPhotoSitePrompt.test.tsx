import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFirstPhotoSitePrompt } from "../useFirstPhotoSitePrompt";

type Props = { groupId: number | null; imageCount: number; isPublic: boolean };

function montar(inicial: Props) {
  const onPublish = vi.fn();
  const hook = renderHook((props: Props) => useFirstPhotoSitePrompt({ ...props, onPublish }), {
    initialProps: inicial,
  });
  return { ...hook, onPublish };
}

describe("useFirstPhotoSitePrompt — a primeira foto de cadastro fora do site", () => {
  it("pergunta quando a galeria passa de vazia para uma foto", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: false });
    expect(result.current.open).toBe(false);

    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(true);
  });

  it("Exibir no site liga o interruptor do formulário e fecha", () => {
    const { result, rerender, onPublish } = montar({ groupId: 851, imageCount: 0, isPublic: false });
    rerender({ groupId: 851, imageCount: 2, isPublic: false });

    act(() => result.current.publish());

    expect(onPublish).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });

  it("Agora não vale para o cadastro aberto: tirar e pôr a foto de novo não pergunta outra vez", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: false });
    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    act(() => result.current.dismiss());
    rerender({ groupId: 851, imageCount: 0, isPublic: false });
    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(false);
  });

  it("não pergunta a quem já está no site", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: true });

    rerender({ groupId: 851, imageCount: 1, isPublic: true });

    expect(result.current.open).toBe(false);
  });

  it("não pergunta quando o cadastro já abriu com foto — não é a primeira", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 1, isPublic: false });

    rerender({ groupId: 851, imageCount: 2, isPublic: false });

    expect(result.current.open).toBe(false);
  });

  it("desligar o Exibir no site depois de pôr a foto não reabre a pergunta", () => {
    // A foto entrou com o cadastro no site; desligar depois é escolha feita.
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: true });
    rerender({ groupId: 851, imageCount: 1, isPublic: true });

    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(false);
  });

  it("abrir OUTRO cadastro é carga, não foto nova", () => {
    // A tela pode trocar de grupo sem desmontar; as fotos dele chegam junto com o id.
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: false });

    rerender({ groupId: 900, imageCount: 3, isPublic: false });

    expect(result.current.open).toBe(false);
  });

  it("cadastro novo não pergunta — ele já nasce com Exibir no site ligado", () => {
    const { result, rerender } = montar({ groupId: null, imageCount: 0, isPublic: false });

    rerender({ groupId: null, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(false);
  });
});

describe("useFirstPhotoSitePrompt — foto trocada não é primeira foto", () => {
  it("cadastro que abriu com foto: tirar e pôr outra passa por zero, e não pergunta", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 1, isPublic: false });

    rerender({ groupId: 851, imageCount: 0, isPublic: false });
    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(false);
  });

  it("pôs a foto com o site ligado, desligou, tirou e repôs: a escolha já foi feita", () => {
    const { result, rerender } = montar({ groupId: 851, imageCount: 0, isPublic: true });
    rerender({ groupId: 851, imageCount: 1, isPublic: true });
    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    rerender({ groupId: 851, imageCount: 0, isPublic: false });
    rerender({ groupId: 851, imageCount: 1, isPublic: false });

    expect(result.current.open).toBe(false);
  });
});
