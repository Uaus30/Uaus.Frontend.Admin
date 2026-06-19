/**
 * Representa os metadados de uma imagem registrada no catálogo.
 */
export type CatalogImage = {
  /** ID único da imagem no banco de dados */
  id: number;
  /** Nome amigável definido para o arquivo */
  name: string;
  /** URL pública ou parcial no servidor CDN */
  url: string;
  /** Tipo associado (enum mapeado de API) */
  type: number;
  /** Data de registro e upload */
  createdAt: string;
};

/**
 * Representa os valores do formulário para upload de uma nova imagem.
 */
export type ImageUploadForm = {
  /** Nome amigável atribuído à imagem */
  name: string;
  /** ID do tipo da imagem (selecionado do dropdown) */
  typeId: string;
  /** Arquivo físico selecionado do disco */
  file: File | null;
  /** URL local criada para renderização de preview temporário */
  previewUrl: string | null;
};
