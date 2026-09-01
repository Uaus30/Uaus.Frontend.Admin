import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import type {
  CategoryDto,
  DepartmentDto,
  ImageDto,
  ProductGroupDto,
  ProductImageDto,
  ProductTagDto,
  TagDto,
} from "@workspace/api-client-react";
import { getProductsPage } from "@/services/products.service";
import { buildProductCollections, type EnrichedProduct } from "@/services/mappers";

/**
 * Quanto se espera parar de digitar antes de consultar.
 *
 * O leitor de código de barras não "bipa": ele DIGITA, caractere por caractere,
 * em milissegundos. Sem a espera, um EAN-13 bipado dispararia treze consultas —
 * e as doze primeiras seriam por prefixos que não são o código de ninguém.
 */
const DEBOUNCE_MS = 400;

/** Quantas linhas trazer da busca. Ver {@link procurarExato}. */
const LIMITE_BUSCA = 20;

/**
 * O termo tem cara de código de barras?
 *
 * Só dígitos porque é essa a regra do backend: `GET /Products?search=` decide
 * entre buscar por código e buscar por NOME olhando se o termo é todo numérico
 * (`IsBarcodeSearch`). Mandar "COPO" aqui traria produtos por nome, e a tela
 * carregaria um produto que ninguém pediu.
 *
 * O mínimo de 8 é o EAN-8, o menor código de verdade. Abaixo disso o operador
 * ainda está digitando, e a busca por `Contains` devolveria meia base.
 */
function pareceCodigoDeBarras(termo: string): boolean {
  return /^\d{8,}$/.test(termo);
}

type CatalogosDoProduto = {
  productGroups: ProductGroupDto[];
  categories: CategoryDto[];
  departments: DepartmentDto[];
  tags: TagDto[];
  productTags: ProductTagDto[];
  images: ImageDto[];
  productImages: ProductImageDto[];
};

type UseBarcodeLookupParams = CatalogosDoProduto & {
  /**
   * A tela pode receber um produto agora?
   *
   * Verdadeiro só com a tela ABERTA e em cadastro NOVO. Editando, o operador já
   * escolheu o produto — trocá-lo por outro no meio da digitação jogaria fora o
   * que ele acabou de preencher. Duplicata na edição continua sendo recusada
   * pelo backend na hora de salvar.
   */
  podeCarregar: boolean;
  /** Carrega o produto encontrado na tela. É o `openDetail` do editor. */
  carregarProduto: (produto: EnrichedProduct) => void;
};

/**
 * Reconhece um código de barras já cadastrado enquanto ele é digitado ou bipado.
 *
 * Sem isto, o operador descobria a duplicata só ao salvar: preenchia nome,
 * departamento, categoria, preço e foto, clicava em Salvar e recebia o
 * "Já existe um produto cadastrado com este código de barras!" do backend — com
 * o cadastro certo em algum lugar da lista e o trabalho todo para refazer.
 *
 * Aqui a tela troca de assunto no momento do bipe: carrega o produto existente
 * e avisa. O que era retrabalho vira o caminho curto para editar o que já está lá.
 *
 * ## Por que não é um efeito
 *
 * A consulta é reação a um EVENTO (o operador digitou), não sincronização de
 * estado. Num efeito, além de o lint recusar o `setState` síncrono que carregar
 * o produto exige, seria preciso sincronizar o "já carreguei este" para não
 * reabrir o mesmo produto a cada render.
 */
export function useBarcodeLookup(params: UseBarcodeLookupParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Espelho do último render.
   *
   * O disparo é adiado, e quando ele acontece os valores capturados no
   * agendamento já podem estar velhos — `podeCarregar` inclusive, que é o que
   * impede a busca de sobrescrever um cadastro que a pessoa abriu no meio do
   * caminho, ou de reabrir a tela que ela acabou de fechar.
   */
  const paramsRef = useRef(params);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sem lista de dependências: o espelho tem que acompanhar TODO render. A
  // atualização mora num efeito porque escrever em ref durante o render é
  // proibido — e não faz falta, já que quem lê o espelho é o temporizador,
  // 400ms depois de os efeitos terem rodado.
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * O produto cujo código de barras é EXATAMENTE o termo, ou nada.
   *
   * O backend filtra por `Contains`, então "7891234567890" também casaria com um
   * código maior que o contenha. Duplicata é igualdade, não semelhança: quem
   * decide é a comparação aqui.
   */
  async function procurarExato(termo: string) {
    const pagina = await queryClient.fetchQuery({
      queryKey: ["product-by-barcode", termo],
      queryFn: () => getProductsPage({ search: termo, limit: LIMITE_BUSCA }),
      staleTime: 30_000,
    });

    return pagina.data.find((produto) => produto.barcode === termo) ?? null;
  }

  async function carregarSeJaExiste(termo: string) {
    if (!paramsRef.current.podeCarregar) return;

    let encontrado;
    try {
      encontrado = await procurarExato(termo);
    } catch {
      // A consulta é conveniência, não garantia: o backend continua recusando
      // código repetido ao salvar. Um erro aqui não pode virar aviso na tela de
      // quem está apenas digitando.
      return;
    }

    if (!encontrado) return;

    const atual = paramsRef.current;
    // Relido DEPOIS da viagem: nesse intervalo a pessoa pode ter fechado a tela
    // ou aberto outro produto pela lista.
    if (!atual.podeCarregar) return;

    const [linha] = buildProductCollections({
      products: [encontrado],
      productGroups: atual.productGroups,
      categories: atual.categories,
      departments: atual.departments,
      tags: atual.tags,
      productTags: atual.productTags,
      images: atual.images,
      productImages: atual.productImages,
    }).enrichedProducts;

    toast({
      title: "Este produto já está cadastrado",
      description: linha?.productGroup
        ? `O código ${termo} é de "${linha.productGroup.name}". Os dados dele foram carregados para edição.`
        : `O código ${termo} já pertence a "${encontrado.name}".`,
      variant: "warning",
    });

    // Sem o grupo não há departamento, categoria nem nome de grupo para exibir:
    // carregar assim entregaria um formulário meio vazio com cara de cadastro
    // novo. O aviso acima já preveniu a pessoa; o backend recusa o resto.
    if (!linha?.productGroup) return;

    atual.carregarProduto(linha);
  }

  /** Chamado a cada tecla do campo de código de barras. */
  function lookupBarcode(barcode: string) {
    if (timerRef.current) clearTimeout(timerRef.current);

    const termo = barcode.trim();
    if (!pareceCodigoDeBarras(termo)) return;

    timerRef.current = setTimeout(() => void carregarSeJaExiste(termo), DEBOUNCE_MS);
  }

  return { lookupBarcode };
}
