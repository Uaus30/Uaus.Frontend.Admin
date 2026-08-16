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
 * Página exibida na grade do catálogo.
 *
 * É um tipo próprio, e não o `UiPagedResult` do api-client, porque o catálogo
 * tem duas origens: sem filtro de tipo a página vem do servidor; com filtro,
 * ela é recortada aqui do catálogo inteiro — o endpoint `GET /Images` não
 * filtra por tipo, e paginar no servidor daria um total que não corresponde ao
 * que está na tela. Os quatro campos abaixo são o que as duas origens têm em
 * comum, e `totalPages` fica de fora de propósito: quem desenha o rodapé
 * deriva o número a partir de `total` e do tamanho da página.
 */
export type ImageCatalogPage = {
  /** Itens da página corrente. */
  data: CatalogImage[];
  /** Página corrente, começando em 1. */
  page: number;
  /** Itens por página em vigor. */
  limit: number;
  /** Total de imagens do filtro aplicado — do servidor ou do recorte local. */
  total: number;
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
