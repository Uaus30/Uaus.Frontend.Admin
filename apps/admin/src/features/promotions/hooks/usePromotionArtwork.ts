import { useEffect, useRef } from "react";
import { createImageFromFile } from "@/services/images.service";
import { describeApiError } from "@workspace/core";
import { optimizeImage } from "@/lib/imageOptimizer";
import { describeAspectWarning } from "./promotionArtRules";
import type { PromotionArtFormat } from "./promotionPrompt";
import type { PromotionArtwork, PromotionForm } from "../types";

/**
 * `ImageType.Banner` do backend.
 *
 * Número solto, como o `IMAGE_TYPE_PRODUCTS` das fotos da compra: o catálogo de
 * enums do admin ainda mora em `src/services/`, que está congelado à espera da
 * migração para o `api-client`. Duas ocorrências não são duplicata; na terceira
 * isto vira um mapa no pacote, junto das outras.
 *
 * É este tipo que faz o arquivo cair na pasta `banners` do S3 — a linha estava
 * comentada em `ImageService.GetImageFolder` e foi destravada com esta feature.
 */
const IMAGE_TYPE_BANNER = 1;

/**
 * As duas artes do formulário: escolher, tirar e — no salvamento — subir.
 *
 * Mora fora do `usePromotionEditor` porque o controlador já está perto do teto de
 * 300 linhas e porque isto é um assunto inteiro: otimização, medida da proporção,
 * `blob:` local e upload. O editor só chama.
 */
export function usePromotionArtwork(setForm: React.Dispatch<React.SetStateAction<PromotionForm>>) {
  /*
   * Os `blob:` criados aqui são revogados quando a tela sai.
   *
   * Sem isso, cada troca de arte deixa um blob preso na memória do navegador até
   * a aba fechar — e o cadastro é uma TELA, que a pessoa abre e fecha muitas
   * vezes numa manhã de sexta montando as promoções do sábado.
   */
  const criados = useRef<string[]>([]);

  useEffect(() => {
    const urls = criados.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function pickArtwork(format: PromotionArtFormat, file: File) {
    // Comprimida ANTES de subir, como as fotos da compra e do produto: arte de
    // IA sai em PNG de vários MB, e um punhado delas estoura o que a hospedagem
    // aceita.
    const otimizada = await optimizeImage(file);
    const aviso = await describeAspectWarning(otimizada.file, format);
    const url = URL.createObjectURL(otimizada.file);
    criados.current.push(url);

    const arte: PromotionArtwork = { url, file: otimizada.file, aspectWarning: aviso };
    setForm((atual) => ({ ...atual, ...(format === "feed" ? { feedImage: arte } : { storyImage: arte }) }));
  }

  function clearArtwork(format: PromotionArtFormat) {
    setForm((atual) => ({ ...atual, ...(format === "feed" ? { feedImage: null } : { storyImage: null }) }));
  }

  /** Guarda no formulário o id que o upload acabou de criar — ver `uploadPendingArtwork`. */
  function rememberUploaded(format: PromotionArtFormat, imageId: number) {
    setForm((atual) => {
      const arte = format === "feed" ? atual.feedImage : atual.storyImage;
      if (!arte) return atual;

      const comId = { ...arte, imageId };
      return { ...atual, ...(format === "feed" ? { feedImage: comId } : { storyImage: comId }) };
    });
  }

  return { pickArtwork, clearArtwork, rememberUploaded };
}

/**
 * O id da arte para o payload: o que já existe, ou o que o upload acabou de criar.
 *
 * O arquivo sobe no SALVAMENTO — quem abre o cadastro, anexa a arte e desiste não
 * deixa imagem órfã no catálogo. Nulo é resposta legítima: significa "sem arte",
 * e é o que tirar a arte do formulário grava.
 *
 * **O id volta para o formulário** (`onUploaded`), e essa é a parte que não pode
 * sumir numa refatoração: as três recusas que dependem do banco — sobreposição,
 * banner ocupado e preço acima do de tabela — são ESPERADAS, e a gravação falha
 * depois de as imagens já terem subido. Sem devolver o id, cada nova tentativa
 * subia tudo de novo: duas tentativas com as duas artes deixavam quatro imagens
 * órfãs no catálogo e no S3.
 *
 * @param artwork A arte do formulário, ou nula.
 * @param nome Nome com que a imagem entra no catálogo.
 * @param rotulo Como a arte se chama na mensagem de erro ("4:5", "9:16").
 * @param onUploaded Recebe o id recém-criado, para o formulário guardá-lo.
 */
export async function uploadPendingArtwork(
  artwork: PromotionArtwork | null,
  nome: string,
  rotulo: string,
  onUploaded: (imageId: number) => void,
): Promise<number | null> {
  if (!artwork) return null;
  if (artwork.imageId) return artwork.imageId;
  if (!artwork.file) return null;

  try {
    const criada = await createImageFromFile({ file: artwork.file, name: nome, type: IMAGE_TYPE_BANNER });
    onUploaded(criada.id);
    return criada.id;
  } catch (erro) {
    // O erro cru viraria "Erro ao criar a promoção: 413 ao acessar /Images", e o
    // dono não relacionaria com a arte — reapertaria Salvar, que é exatamente o
    // caminho que multiplica órfãos.
    throw new Error(`Não foi possível enviar a arte ${rotulo}. ${describeApiError(erro)}`, {
      cause: erro,
    });
  }
}
