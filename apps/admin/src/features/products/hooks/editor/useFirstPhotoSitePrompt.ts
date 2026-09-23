import { useState } from "react";

type UseFirstPhotoSitePromptParams = {
  /** O grupo aberto. Nulo em cadastro novo, que já nasce com "Exibir no site" ligado. */
  groupId: number | null;
  /** Quantas fotos a galeria tem agora. */
  imageCount: number;
  /** O "Exibir no site" do formulário. */
  isPublic: boolean;
  /** Liga o "Exibir no site" no formulário — vale no próximo Salvar, junto com a foto. */
  onPublish: () => void;
};

/**
 * A primeira foto de um cadastro fora do site pergunta se ele vai ao ar
 * (decisão do dono, 23/09/2026).
 *
 * Foto nova não liga o "Exibir no site" sozinha, e o interruptor mora na aba
 * Opcionais, longe da galeria: em 06/09/2026 uma sessão subiu 175 fotos à mão,
 * e dos 128 cadastros prontos e fora do site medidos em produção em 22/09/2026,
 * 126 tinham foto daquela sessão.
 *
 * Pergunta só na PRIMEIRA foto do cadastro aberto: a passagem de zero para uma
 * numa galeria que ainda não tinha tido foto nenhuma nesta abertura. Por isso
 * não pergunta:
 * - quando o cadastro abriu com foto — trocar a foto (tirar e pôr outra) passa
 *   por zero, mas não é a primeira;
 * - quando alguém desliga o "Exibir no site" depois de pôr a foto, nem se
 *   depois tira e repõe a foto — a escolha já foi feita;
 * - de novo depois do "Agora não".
 *
 * O ajuste é feito durante a renderização, comparando com a anterior, e não num
 * efeito: `setState` síncrono em efeito é a cascata de render que o lint
 * recusa, e é o molde que a documentação do React recomenda para reagir à
 * mudança de uma entrada.
 */
export function useFirstPhotoSitePrompt({
  groupId,
  imageCount,
  isPublic,
  onPublish,
}: UseFirstPhotoSitePromptParams) {
  // `hadPhotos` só vai de falso para verdadeiro dentro do mesmo cadastro: é o
  // que separa a PRIMEIRA foto de uma foto trocada.
  const [seen, setSeen] = useState({ groupId, imageCount, hadPhotos: imageCount > 0 });
  const [open, setOpen] = useState(false);

  if (seen.groupId !== groupId || seen.imageCount !== imageCount) {
    const sameProduct = seen.groupId === groupId;
    const firstPhoto = sameProduct && !seen.hadPhotos && imageCount > 0;
    const ask = firstPhoto && groupId !== null && !isPublic;

    setSeen({
      groupId,
      imageCount,
      hadPhotos: sameProduct ? seen.hadPhotos || imageCount > 0 : imageCount > 0,
    });
    if (ask) setOpen(true);
    else if (!sameProduct) setOpen(false);
  }

  return {
    open,
    publish: () => {
      onPublish();
      setOpen(false);
    },
    dismiss: () => setOpen(false),
  };
}
