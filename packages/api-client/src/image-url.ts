import { API_BASE_URL } from "./client";

/**
 * URL pública de uma imagem guardada pela API.
 *
 * O banco grava o caminho relativo (`/uploads/produtos/x.png`), não a URL
 * inteira — é o que permite trocar o host da API sem reescrever linha nenhuma.
 * Quem exibe precisa recolocar a base, e é só isso que esta função faz.
 *
 * **Por que mora no `api-client` e não em cada app.** A base é a
 * {@link API_BASE_URL}, que já vive aqui, e o valor dela muda por ambiente
 * (`/api` no navegador, host absoluto fora dele). Uma segunda implementação num
 * app significaria uma segunda regra de base: o admin mostrando a foto e o PDV
 * mostrando o ícone de imagem quebrada, sem nada quebrar no build.
 *
 * URL absoluta passa intacta: imagem vinda de fora (busca na web, catálogo de
 * fornecedor) já traz o host e prefixá-la geraria um endereço inexistente.
 *
 * @param url Caminho gravado no cadastro, relativo ou absoluto.
 */
export function buildPublicImageUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}
