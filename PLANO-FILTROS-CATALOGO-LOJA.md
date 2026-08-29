# Plano de implementação — filtro por departamento e categoria na loja

> Escrito em 29/08/2026, a partir de leitura dos dois repositórios
> (`Uaus.Frontend.Admin@dev` e `Uaus.Backend.Api`). Documento de execução: cada
> fase tem escopo, arquivos, esboço de código, testes e o gate que precisa ficar
> verde antes da fase seguinte.

> **STATUS (29/08/2026, mesmo dia): executado.** Backend em
> `Uaus.Backend.Api@dev` (`e9c6a2d`), front nesta branch (`777bf88`,
> `ab4deb6`). Três diferenças em relação ao planejado, todas por motivo
> descoberto na execução:
>
> 1. **Filtro navega por link, não por callback.** O plano previa
>    `selectDepartment`/`selectCategory` no hook; virou `<Link>` com `href` de
>    `catalogPath`. Link é rastreável pelo buscador, abre em aba nova e empilha
>    histórico sozinho — os três de graça.
> 2. **A árvore é lida duas vezes** (com busca e sem). O plano resolvia o
>    rótulo perdido com cache de nomes; a segunda leitura resolve rótulo E
>    "filtro inexistente" de uma vez, e sem busca as duas dividem a chave de
>    cache — uma requisição só.
> 3. **A grade perdeu uma coluna por faixa** (`lg:3`, `xl:4`): com a coluna de
>    filtros ao lado, cinco cards deixavam a foto menor que a miniatura.
>
> Pendente: **catálogo do dev tem só 3 produtos visíveis** (3 departamentos,
> 1 categoria cada). O smoke test cobriu todos os caminhos, mas não a
> densidade. Para ampliar, ver a seção 12.

---

## 1. Escopo

Duas entregas ligadas pela mesma taxonomia:

1. **Filtrar a vitrine** (`/produtos`) por **departamento** e por **categoria**,
   combinável com a busca que já existe, com o estado do filtro **na URL** (link
   compartilhável, botão Voltar funcionando).
2. **Trilha de navegação no detalhe** (`/produtos/:id`):
   `Departamento > Categoria > Nome do produto`, com os dois primeiros níveis
   navegando para a vitrine já filtrada.

Toca quatro lugares, nesta ordem: `Uaus.Backend.Api` → `packages/api-client` →
`apps/loja` (filtro) → `apps/loja` (trilha).

**Fora de escopo, deliberadamente** (justificativas na seção 3):
slug em URL de produto/categoria, filtro por etiqueta ou faixa de preço,
restauração de posição de scroll ao voltar do detalhe, categoria clicável dentro
do card da grade, sitemap dinâmico.

---

## 2. O que o levantamento fixou

Fatos verificados no código — o plano se apoia neles, não em suposição.

1. **A taxonomia já existe e é uma árvore de dois níveis.**
   `Department (1) ─< Category (N) ─< ProductGroup (N)`. O grupo aponta para
   `CategoryId`; a categoria aponta para `DepartmentId`
   (`Uaus.Domain/Entities/{Department,Category,ProductGroup}.cs`). **Não há
   coluna nova, nem tabela nova: o freio 2 do CLAUDE.md (migração de esquema)
   não dispara neste trabalho.**

2. **O storefront já resolve a categoria, mas joga o departamento fora.**
   `StorefrontService.PageVisibleGroupsAsync` projeta `CategoryName = g.Category.Name`
   e o DTO expõe `categoryName` — o card e o detalhe já mostram a categoria como
   texto morto (`ProductCard.tsx:34`, `product-detail.tsx:78`). O departamento
   nunca é lido.

3. **A regra de visibilidade da vitrine está escrita em dois lugares** —
   listagem (`PageVisibleGroupsAsync`) e detalhe (`GetProductAsync`) repetem
   `!IsDeleted && ShowOnSite && Products.Any(ativo)`. Somar um terceiro lugar
   (a árvore de filtros) sem extrair o predicado é o caminho para a faceta e a
   grade divergirem.

4. **Categoria e departamento não podem ficar órfãos.**
   `CategoryService.DeleteAsync` recusa apagar categoria com grupo vinculado
   (`CategoryService.cs:127`) e `DepartmentService.DeleteAsync` recusa apagar
   departamento com categoria vinculada (`DepartmentService.cs:81`). Logo, um
   grupo visível **nunca** aponta para categoria/departamento excluído — a
   árvore não precisa filtrar `IsDeleted` da taxonomia, e filtrar seria pior:
   criaria diferença entre o que a faceta conta e o que a grade mostra.

5. **`useLocation` do wouter ignora a query string.**
   `use-browser-location.js:42` lê `location.pathname`; a busca sai por
   `useSearch`/`useSearchParams` (wouter 3.10, `useSearchParams` existe e
   devolve `[URLSearchParams, setSearchParams]`). Consequência prática: o
   `ScrollToTop` **não** dispara quando só o filtro muda — quem quiser subir a
   página ao trocar de filtro faz isso explicitamente.

6. **Os testes atuais do storefront travam ids e contagens exatos**
   (`result.Items.Select(x => x.ProductGroupId).Should().Equal(2, 1)`,
   `FilteredItems.Should().Be(2)`). Ampliar o catálogo do `GivenCatalog()`
   quebraria testes que nada têm a ver com este trabalho — por isso a fase 1 usa
   fixture separada.

7. **O `models.ts` tem portão de contrato no CI.** Mudou DTO no backend, o
   retrato `scripts/contrato/contrato-backend.json` é regerado no mesmo trabalho
   (`docs/contrato-backend.md` §4). E campo nulo **some** do JSON — nunca chega
   `null` (§1): todo campo opcional novo entra como `?:` no TypeScript.

---

## 3. Decisões de desenho

### 3.1 A faceta conta com a MESMA regra da grade

A lista de filtros mostra contagem (`Cozinha (7)`), e a contagem obedece a busca
ativa. O endpoint da árvore aceita o mesmo `search` da listagem e agrupa sobre
exatamente o mesmo predicado de visibilidade.

_Alternativa recusada:_ contagem do catálogo inteiro, independente da busca. É
mais barata de cachear e mente na tela: o visitante busca "caneca", lê
"Cozinha (7)", clica e recebe 2 produtos. Faceta que promete número que a grade
não entrega é pior que faceta sem número.

_Consequência aceita:_ a árvore é refetchada a cada busca com debounce. É **uma**
consulta agrupada sobre colunas indexadas, e o React Query dedupe/cacheia por
chave; ao lado do fan-out de imagens e etiquetas da listagem, é ruído.

### 3.2 O filtro NÃO exclui a própria dimensão

Departamentos e categorias são contados só com o `search` aplicado — nunca com o
departamento/categoria selecionado. É o que mantém a lista de filtros estável:
selecionar "Casa" não pode fazer os outros departamentos sumirem da lista, senão
o visitante fica preso no filtro que escolheu.

### 3.3 A URL é o estado

`/produtos?departamento=3&categoria=7&busca=caneca`, parâmetros em português
(as rotas do site já são: `/produtos`, `/contato`), ids numéricos.

- `departamento`/`categoria` navegam com **push** (é navegação deliberada: o
  Voltar tem que desfazer o filtro).
- `busca` navega com **replace** (senão cada letra digitada vira uma entrada de
  histórico e o Voltar fica intransitável).

Isso é o que faz a trilha do detalhe funcionar como link de verdade, o
compartilhamento por WhatsApp levar a pessoa ao mesmo resultado, e o Voltar
depois de abrir um produto devolver a vitrine filtrada.

_Alternativa recusada:_ manter `search` em `useState` como hoje e pôr só os
filtros na URL. Fica um estado híbrido, e o Voltar volta para a lista sem a
busca — o bug clássico de vitrine.

### 3.4 Sem slug

`departamento=3`, não `departamento=casa-e-cozinha`. O detalhe do produto já é
`/produtos/:id` numérico, e não há coluna `Slug` em lugar nenhum: derivar slug do
nome resolve a ida (`Casa e Cozinha` → `casa-e-cozinha`) e não resolve a volta
sem varrer a tabela, além de quebrar todo link salvo quando a lojista corrigir um
acento no nome. Slug é trabalho próprio — coluna, unicidade, redirect de slug
antigo — e vale a pena junto com slug de produto, não sozinho aqui.

### 3.5 Os ids da taxonomia vão só no DTO do DETALHE

`StorefrontProductDetailDto` ganha `departmentId`, `departmentName`,
`categoryId` (`categoryName` já existe). O DTO do **card** não ganha nada.

Motivo: quem precisa dos ids é a trilha, que só existe no detalhe. Repetir três
campos em 24 cards por página engorda o payload público sem nenhuma tela ler. E
tornar a categoria do card um link exigiria desmontar o card — hoje ele é **um**
`<Link>` inteiro (`ProductCard.tsx:22`), e âncora dentro de âncora é HTML
inválido; o nome do filtro selecionado a página pega da árvore, que já está
carregada.

### 3.6 Departamento e categoria juntos combinam por E

Se vier `departamento=3&categoria=99` e a categoria 99 for de outro
departamento, o resultado é **vazio**. Inventar "categoria vence" esconderia
link errado em vez de mostrá-lo; a UI nunca monta essa combinação, e o vazio
tem estado de tela próprio com botão de limpar.

---

## 4. Fase 1 — Backend (`Uaus.Backend.Api`)

> Repositório vizinho. Editar backend **exige autorização na conversa** — peça
> antes de começar esta fase.

### 4.1 DTOs

**`Uaus.Application/DTOs/Storefront/StorefrontDepartmentDto.cs`** (arquivo novo):

```csharp
namespace Uaus.Application.DTOs.Storefront
{
    /// <summary>
    /// Categoria na lista de filtros da vitrine, com quantos produtos visíveis
    /// ela tem AGORA — a contagem já considera a busca ativa, porque faceta que
    /// promete um número que a grade não entrega é pior que faceta sem número.
    /// </summary>
    public class StorefrontCategoryDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int ProductCount { get; set; }
    }

    /// <summary>
    /// Departamento na lista de filtros, com as categorias que têm produto
    /// visível. Departamento sem nenhum grupo exibível não aparece: filtro que
    /// leva a lugar nenhum é ruído na tela do cliente.
    /// </summary>
    public class StorefrontDepartmentDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;

        /// <summary>Soma das categorias — não é COUNT próprio: o grupo pertence a uma categoria só.</summary>
        public int ProductCount { get; set; }

        public List<StorefrontCategoryDto> Categories { get; set; } = [];
    }
}
```

**`StorefrontProductDto.cs`** — acrescentar ao `StorefrontProductDetailDto` (e
**só** a ele, decisão 3.5):

```csharp
        /// <summary>Departamento da categoria do grupo — o primeiro nível da trilha do site.</summary>
        public long DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;

        /// <summary>Id da categoria; o nome já vem em <see cref="CategoryName"/>. Os dois viram link para a vitrine filtrada.</summary>
        public long CategoryId { get; set; }
```

### 4.2 Serviço

**`Uaus.Application/Services/StorefrontService.cs`**

Extrair o predicado repetido para um lugar só — é o coração da fase:

```csharp
        /// <summary>
        /// Predicado ÚNICO de visibilidade da vitrine: grupo não excluído, com
        /// "Exibir no site" ligado e com ao menos um produto ativo, opcionalmente
        /// filtrado pela busca.
        ///
        /// Listagem, detalhe e árvore de filtros derivam daqui. Se a árvore
        /// contasse por regra própria, o cliente clicaria em "Cozinha (7)" e
        /// receberia 3 produtos — e nada nesse desencontro gera erro.
        /// </summary>
        private IQueryable<ProductGroup> VisibleGroups(string? search)
        {
            var query = _dbContext.ProductGroups
                .AsNoTracking()
                .Where(g => !g.IsDeleted
                            && g.ShowOnSite
                            && g.Products.Any(p => !p.IsDeleted && p.Status == ProductStatus.Active));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(g => g.Name.ToLower().Contains(term)
                                      || (g.Description != null && g.Description.ToLower().Contains(term)));
            }

            return query;
        }
```

`PageVisibleGroupsAsync` passa a receber os filtros e a usar o predicado:

```csharp
        private async Task<PagedResult<VisibleGroup>> PageVisibleGroupsAsync(
            string? search, long? departmentId, long? categoryId, int page, int size)
        {
            var query = VisibleGroups(search);

            // Vindos os dois, valem os dois: categoria de outro departamento devolve
            // vazio de propósito — "categoria vence" esconderia link errado.
            if (categoryId is > 0)
                query = query.Where(g => g.CategoryId == categoryId);

            if (departmentId is > 0)
                query = query.Where(g => g.Category.DepartmentId == departmentId);

            return await query
                .OrderByDescending(g => g.Id)
                .Select(g => new VisibleGroup { /* ...campos atuais... */ })
                .ToPagedResultAsync(page, size);
        }
```

`GetProductAsync` projeta os três campos novos (`VisibleGroup` ganha
`DepartmentId`, `DepartmentName`, `CategoryId`; `g.Category.DepartmentId`,
`g.Category.Department.Name`, `g.CategoryId`) e os copia para o DTO de detalhe.

A árvore, em **uma** consulta agrupada:

```csharp
        /// <summary>
        /// Árvore de filtros da vitrine. Não é paginada: taxonomia de loja de
        /// bairro cabe numa tela, e filtro que pagina deixa de ser filtro.
        /// </summary>
        public async Task<List<StorefrontDepartmentDto>> GetDepartmentsAsync(string? search = null)
        {
            var rows = await VisibleGroups(search)
                .GroupBy(g => new
                {
                    g.Category.DepartmentId,
                    DepartmentName = g.Category.Department.Name,
                    g.CategoryId,
                    CategoryName = g.Category.Name,
                })
                .Select(grouped => new
                {
                    grouped.Key.DepartmentId,
                    grouped.Key.DepartmentName,
                    grouped.Key.CategoryId,
                    grouped.Key.CategoryName,
                    ProductCount = grouped.Count(),
                })
                .ToListAsync();

            // Ordem alfabética com StringComparer.CurrentCulture, como as etiquetas:
            // "Órgãos" depois de "Ovos", não no fim por causa do acento.
            return [.. rows
                .GroupBy(row => new { row.DepartmentId, row.DepartmentName })
                .Select(department => new StorefrontDepartmentDto
                {
                    Id = department.Key.DepartmentId,
                    Name = department.Key.DepartmentName,
                    ProductCount = department.Sum(row => row.ProductCount),
                    Categories = [.. department
                        .Select(row => new StorefrontCategoryDto
                        {
                            Id = row.CategoryId,
                            Name = row.CategoryName,
                            ProductCount = row.ProductCount,
                        })
                        .OrderBy(category => category.Name, StringComparer.CurrentCulture)],
                })
                .OrderBy(department => department.Name, StringComparer.CurrentCulture)];
        }
```

### 4.3 Interface e controller

`IStorefrontService`: nova assinatura de `GetProductsAsync` e o
`GetDepartmentsAsync`, com o XML doc explicando por que a árvore não pagina e
por que a contagem segue a busca.

`StorefrontController`:

```csharp
        [HttpGet("products")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProducts(
            string? search = null,
            long? departmentId = null,
            long? categoryId = null,
            int page = 1,
            int size = 24)
            => Ok(await _service.GetProductsAsync(
                search: search, departmentId: departmentId, categoryId: categoryId, page: page, size: size));

        /// <summary>Departamentos e categorias com produto visível, para a lista de filtros do site.</summary>
        [HttpGet("departments")]
        [AllowAnonymous]
        public async Task<IActionResult> GetDepartments(string? search = null)
            => Ok(await _service.GetDepartmentsAsync(search));
```

> ⚠️ **Armadilha que compila calada.** A chamada atual do controller é
> **posicional**: `_service.GetProductsAsync(search, page, size)`. Inserindo
> `departmentId`/`categoryId` depois de `search`, `page` (int) converte
> implicitamente para `long?` e vai parar em `departmentId` — **sem erro de
> compilação**, com a vitrine devolvendo vazio em produção. Por isso a chamada
> acima usa **argumentos nomeados**. Depois de mexer na assinatura, procure
> outros chamadores: `grep -rn "GetProductsAsync" --include=*.cs`.

### 4.4 Testes (`Uaus.Api.Tests/Services/StorefrontServiceTests.cs`)

**Não** altere `GivenCatalog()` — os testes existentes travam ids e contagens
exatos (fato 6). Acrescente uma fixture:

```csharp
        /// <summary>
        /// Catálogo do filtro, somado ao <see cref="GivenCatalog"/>: departamento 2
        /// "Casa" com duas categorias (10 "Cozinha", 11 "Banho"), grupo visível em
        /// cada uma, e um grupo OCULTO na Cozinha — é ele que prova que a faceta
        /// não conta o que a grade não mostra.
        /// </summary>
        private void GivenTaxonomy() { /* ... */ }
```

Casos novos:

| Teste | O que trava |
| ----- | ----------- |
| `GetDepartmentsAsync_deve_agrupar_categorias_por_departamento_com_contagem` | Árvore montada, soma do departamento = soma das categorias |
| `GetDepartmentsAsync_nao_deve_contar_grupo_oculto_excluido_ou_sem_produto_ativo` | Faceta usa a MESMA regra da grade |
| `GetDepartmentsAsync_nao_deve_listar_departamento_sem_grupo_visivel` | Filtro nunca leva a lista vazia |
| `GetDepartmentsAsync_deve_respeitar_a_busca` | Contagem cai junto com a busca |
| `GetDepartmentsAsync_deve_ordenar_por_nome` | `CurrentCulture` (acento) |
| `GetProductsAsync_deve_filtrar_por_categoria` | — |
| `GetProductsAsync_deve_filtrar_por_departamento_trazendo_as_duas_categorias` | Filtro sobe um nível |
| `GetProductsAsync_deve_devolver_vazio_quando_a_categoria_nao_e_do_departamento` | Decisão 3.6 |
| `GetProductsAsync_deve_combinar_busca_e_filtro` | Os dois somam, não se substituem |
| `GetProductsAsync_nao_deve_vazar_grupo_oculto_pelo_filtro_de_categoria` | Filtro não é porta dos fundos da visibilidade |
| `GetProductAsync_deve_devolver_a_trilha_do_produto` | `departmentId/Name` e `categoryId/Name` no detalhe |

### 4.5 Gate da fase 1

```bash
dotnet build && dotnet test
```

Commit no `Uaus.Backend.Api` (conventional, assunto em português sem acento,
corpo explicando o porquê). **Lembre-se:** a `api-dev` do Railway não deploya
sozinha — sem ação manual lá, a fase 3 não tem endpoint para consumir em
preview.

---

## 5. Fase 2 — `packages/api-client`

### 5.1 `src/models.ts`

Na seção do storefront (linha ~1466), acrescentar os tipos e os campos, no
padrão de comentário do bloco (o bloco avisa para não "completar" DTO público
com campo interno — o comentário novo tem que dizer por que estes três podem
sair):

```ts
/** Categoria na lista de filtros da vitrine. */
export interface StorefrontCategoryDto {
  id: number;
  name: string;
  /** Produtos visíveis nesta categoria, já considerando a busca ativa. */
  productCount: number;
}

/** Departamento na lista de filtros, com as categorias que têm produto visível. */
export interface StorefrontDepartmentDto {
  id: number;
  name: string;
  productCount: number;
  categories: StorefrontCategoryDto[];
}
```

E em `StorefrontProductDetailDto`: `departmentId: number; departmentName: string;
categoryId: number;`. Sem `?` — são não anuláveis no C# e sempre preenchidos.

### 5.2 `src/hooks/storefront.ts`

```ts
export interface StorefrontProductsPageParams {
  search?: string;
  /** Filtro por departamento (nível 1 da taxonomia). */
  departmentId?: number;
  /** Filtro por categoria (nível 2). Com os dois, valem os dois. */
  categoryId?: number;
  page?: number;
  size?: number;
}
```

`getStorefrontProductsPage` repassa os dois na query string — `apiGetOrThrow` já
omite parâmetro `undefined`, então o filtro ausente não vira `departmentId=`.

Hook novo, com chave de cache **própria** (armadilha 1 do CLAUDE.md: a factory
devolve só o prefixo; quem consulta acrescenta os parâmetros):

```ts
/** Prefixo da árvore de filtros — quem consulta acrescenta a busca. */
export const getGetStorefrontDepartmentsQueryKey = (): QueryKey => ["storefront-departments"];

export function getStorefrontDepartments(search?: string): Promise<StorefrontDepartmentDto[]> {
  return apiGetOrThrow<StorefrontDepartmentDto[]>("/Storefront/departments", { search }, { auth: false });
}

/**
 * Árvore de filtros da vitrine. `staleTime` de catálogo, não de referência: a
 * contagem acompanha a busca e o cadastro do admin, então envelhece junto com a
 * grade — cachear mais que ela deixaria "Cozinha (7)" ao lado de 3 cards.
 */
export function useGetStorefrontDepartments(search?: string) {
  return useQuery<StorefrontDepartmentDto[], ApiError>({
    queryKey: [...getGetStorefrontDepartmentsQueryKey(), search ?? ""],
    queryFn: () => getStorefrontDepartments(search),
    staleTime: STALE_TIME.catalogo,
  });
}
```

### 5.3 Testes e retrato do contrato

- `src/hooks/storefront.test.ts`: um caso para o path e os parâmetros do
  `getStorefrontDepartments`, e um provando que `departmentId`/`categoryId`
  entram na query string da listagem e **somem** quando `undefined`.
- Regerar o retrato **no mesmo trabalho** (`docs/contrato-backend.md` §4):

```bash
node scripts/contrato/extrair-contrato.mjs --backend ../Uaus.Backend.Api
node scripts/contrato/conferir-contrato.mjs
```

> Só rode `--atualizar-baseline` se a conferência acusar divergência **que você
> consertou**. Baseline serve para travar ganho, não para calar divergência nova.

### 5.4 Gate da fase 2

```bash
npm run build:types
npm test -w @workspace/api-client-react
```

---

## 6. Fase 3 — `apps/loja`: o filtro

### 6.1 `src/routes.ts` — o caminho da vitrine filtrada

```ts
/** Filtros da vitrine que vivem na URL. Ausente = sem filtro. */
export interface CatalogFilters {
  departmentId?: number;
  categoryId?: number;
  search?: string;
}

/**
 * Monta `/produtos?...` a partir dos filtros. Existe para a trilha do detalhe e
 * os chips falarem o MESMO dialeto de query string que a vitrine lê — nome de
 * parâmetro digitado à mão em dois lugares diverge no primeiro rename.
 */
export function catalogPath(filters: CatalogFilters = {}): string { /* ... */ }
```

Parâmetros: `departamento`, `categoria`, `busca`.

### 6.2 `src/features/catalog/hooks/useCatalogFilters.ts` (novo)

Responsabilidade única: ler e escrever os filtros na URL.

- Lê com `useSearchParams()` do wouter; ids inválidos (`?departamento=abc`) são
  tratados como ausentes — não como erro de tela.
- O campo de busca tem estado local (resposta imediata ao digitar) sincronizado
  para a URL pelo `useDebounce` do `@workspace/ui`, com **`replace: true`**.
- Mudança externa da URL (Voltar, trilha do detalhe, chip) reidrata o campo
  local **durante o render**, comparando com o último valor escrito — o mesmo
  padrão que `useProductDetail` já usa para zerar a galeria ao trocar de
  produto, e não um efeito (que renderizaria um frame com o valor velho).
- Trocar de departamento **limpa a categoria** (categoria pertence a um
  departamento; manter as duas produziria o vazio da decisão 3.6).
- `clearFilters()` volta para `/produtos` limpo.

### 6.3 `src/features/catalog/hooks/useDepartmentTree.ts` (novo)

Envolve `useGetStorefrontDepartments(debouncedSearch)` e devolve o que a tela
precisa: `departments`, `isLoading`, `selectedDepartment`, `selectedCategory`
(resolvidos por id, para os chips e o título) e `isUnknownFilter` — id na URL
que não existe na árvore, estado que a tela tem que saber tratar (link velho
depois de a lojista apagar a categoria).

### 6.4 `useCatalog.ts` — passa a receber os filtros

Hoje ele é dono da busca; passa a **consumir** `useCatalogFilters`:

```ts
const query = useGetStorefrontProductsInfinite({
  search: normalizedSearch,
  departmentId: filters.departmentId,
  categoryId: filters.categoryId,
  size: CATALOG_PAGE_SIZE,
});
```

E os estados de vazio ganham um caso a mais — a mensagem tem que dizer o que
fazer, e "não achamos nada" com um filtro ligado sem oferecer limpá-lo é beco
sem saída:

| Situação | Estado | Mensagem |
| -------- | ------ | -------- |
| Sem busca, sem filtro, zero itens | `isEmpty` | "Nenhum produto cadastrado" (atual) |
| Busca ativa, zero itens | `isSearchEmpty` | "Nenhum produto encontrado" (atual) |
| Filtro ativo (com ou sem busca), zero itens | `isFilterEmpty` (novo) | "Nada em <Categoria>" + botão **Limpar filtros** |

### 6.5 Componentes

- **`components/CatalogFilters.tsx`** — a árvore. Departamento como cabeçalho e
  categorias abaixo; item selecionado com `aria-current="true"`; contagem ao
  lado do nome. Coluna fixa a partir de `lg`, `position: sticky`.
- **`components/CatalogFilterSheet.tsx`** — no mobile, a mesma árvore dentro do
  `Sheet` do `@workspace/ui` (já usado no repo; Radix resolve Esc, foco e trava
  de scroll — o mesmo argumento que o `ProductGallery` registra para o Dialog).
  Botão "Filtrar" com o número de filtros ativos.
- **`components/ActiveFilters.tsx`** — chips do que está ligado, cada um com "×",
  mais "Limpar tudo". É o que impede o visitante de ficar preso num filtro que
  ele não vê (no mobile a árvore está fechada).

`products.tsx` vira `lg:grid-cols-[260px_1fr]`, com a coluna de filtros à
esquerda e a grade à direita; abaixo de `lg`, botão + `Sheet`. O `<h1>` e o
`usePageTitle` passam a citar o filtro ("Uaus | Cozinha") — é o que faz o link
compartilhado chegar com nome, e o que o buscador lê.

**Rolagem:** ao trocar de filtro, subir explicitamente (`window.scrollTo` ou
`scrollIntoView` no topo da grade). O `ScrollToTop` global **não** cobre isso
(fato 5): sem essa linha, quem filtra no meio da lista continua no meio, agora
olhando produtos de outra categoria.

### 6.6 Testes

Em `hooks/__tests__/`, com a cerimônia do repositório (`vi.mock` +
`importOriginal`, dublando só o que fala com a rede — sem redefinir chave de
cache):

- `useCatalogFilters.test.tsx` (`.tsx`: precisa do `<Router>`) — com
  `memoryLocation({ path: "/produtos", searchPath: "departamento=3", record: true })`
  do `wouter/memory-location`, que já expõe `searchHook`:
  lê filtro da URL; id inválido vira ausente; trocar departamento limpa
  categoria; busca escreve com `replace` (conferir `history`); Voltar reidrata
  o campo.
- `useCatalog.test.ts` — acrescentar: os filtros chegam ao
  `useGetStorefrontProductsInfinite`; `isFilterEmpty` liga com filtro e zero
  itens (e **não** liga sem filtro).
- `useDepartmentTree.test.ts` — resolve nomes por id; `isUnknownFilter` com id
  fora da árvore.

### 6.7 Gate da fase 3

```bash
npm run typecheck:loja
npm test -w @workspace/loja
npm run lint
npx prettier --write <só os arquivos tocados>
```

---

## 7. Fase 4 — `apps/loja`: a trilha no detalhe

### 7.1 `components/ProductBreadcrumb.tsx` (novo)

`<nav aria-label="Você está aqui">` com `<ol>`; `Departamento > Categoria` como
`<Link>` do wouter para `catalogPath({...})`, e o nome do produto como
`<li aria-current="page">` — texto, não link (link para a página atual é ruído
para leitor de tela). Separador `›` com `aria-hidden`.

No mobile a trilha não pode empurrar o preço para baixo da dobra: truncar o nome
do produto com `line-clamp-1` e manter os dois primeiros níveis sempre
visíveis — são eles que servem para navegar.

Entra em `product-detail.tsx` **no lugar** da linha que hoje imprime
`categoryName` solto (`product-detail.tsx:78`), acima do `<h1>`. O link "Voltar
aos produtos" continua; ele volta para a vitrine **sem** filtro, e a trilha é o
caminho filtrado — dois gestos diferentes, ambos úteis.

### 7.2 Dados estruturados

`src/lib/structured-data.ts` (novo), no mesmo padrão imperativo do
`usePageTitle` (efeito que escreve no `document`, sem head manager — o site tem
quatro rotas): injeta um `<script type="application/ld+json">` com
`BreadcrumbList` e o remove ao desmontar.

Vale o esforço porque é exatamente o que o Google usa para trocar a URL crua no
resultado de busca pela trilha legível. O `index.html` já tem JSON-LD de `Store`
— este é por página e não conflita.

### 7.3 Testes

- `ProductBreadcrumb.test.tsx` — renderiza os três níveis; os `href` batem com
  `catalogPath`; o último não é link.
- `useProductDetail.test.ts` — a trilha vem do DTO (protege contra o campo sumir
  numa mudança de contrato).

### 7.4 Smoke test obrigatório (CLAUDE.md §8)

Houve mudança de tela e de integração, então build verde **não** autoriza push:

1. `npm run dev -w @workspace/loja` (ou o preview da Vercel).
2. `/produtos`: filtrar por departamento, depois por categoria; conferir que a
   grade muda, a contagem bate com o número de cards da primeira página e a URL
   reflete o filtro.
3. Recarregar a página com a URL filtrada — o filtro tem que voltar ligado.
4. Buscar com filtro ligado; limpar a busca; limpar o filtro pelo chip.
5. Abrir um produto, conferir a trilha, clicar em cada nível e no Voltar do
   navegador.
6. Console sem exceção; aba Network sem 4xx/5xx nas chamadas de
   `Storefront/products` e `Storefront/departments`.
7. Mobile (375px): botão Filtrar, `Sheet` abre/fecha, trilha não quebra linha.

Registre no handoff **quais comandos e qual cenário** foram verificados.

---

## 8. Fase 5 — documentação

- **`apps/loja/src/features/catalog/README.md`** — seção nova em "Regras de
  negócio": a faceta conta pela mesma regra da grade; a URL é o estado (e por
  que `busca` usa `replace`); trocar departamento limpa categoria; sem slug, e o
  que custaria ter.
- **`packages/api-client/README.md`** — se houver lista de endpoints, incluir
  `/Storefront/departments`.
- **`CLAUDE.md` (front)** — nada a mudar; nenhuma regra nova nasce daqui.
- **`sitemap.xml`** — **não** mexer. Ele é estático e a taxonomia é dado: URL de
  filtro escrita à mão envelhece na primeira categoria renomeada. Se um dia
  valer, o caminho é gerar o sitemap na borda, como o `api/link-preview.ts` já
  faz com o cartão do produto — tarefa própria.

---

## 9. Ordem, gates e freios

| # | Fase | Onde | Gate |
| - | ---- | ---- | ---- |
| 1 | Backend: predicado único, filtros, árvore, trilha | `Uaus.Backend.Api` | `dotnet build && dotnet test` |
| 2 | DTOs, hooks e retrato do contrato | `packages/api-client` | `npm run build:types` + testes do pacote + `conferir-contrato.mjs` |
| 3 | Filtro na vitrine | `apps/loja` | `typecheck:loja`, testes, lint, format |
| 4 | Trilha no detalhe | `apps/loja` | idem + **smoke test da seção 7.4** |
| 5 | Documentação | `apps/loja`, `packages/api-client` | `npm run format:check` |

Antes de dizer que terminou:

```bash
npm run build:types && npm run typecheck:loja && npm test && npm run lint && npm run format:check
```

**Freios do CLAUDE.md nesta tarefa:**

- **Freio 1 (gate vermelho):** vale sempre. Antes de consertar gate quebrado,
  confira se ele já estava vermelho — o working tree é compartilhado com outros
  chats.
- **Freio 2 (migração):** **não dispara.** Nenhuma coluna, tabela ou
  `DATABASE_VERSION` muda.
- **Freio 3 (deploy/segredo):** **não dispara.** `vercel.json` não muda — a nova
  rota entra pelo rewrite `/api/(.*)` que já existe.
- Backend é repositório vizinho: **peça autorização antes da fase 1**.
- `git add` nominal, nunca `-A`. Prettier só nos arquivos tocados.

Commits sugeridos (um tema cada): `feat(storefront): filtro por departamento e
categoria na vitrine publica` (backend) · `feat(api-client): hooks e DTOs do
filtro de catalogo` · `feat(loja): filtra a vitrine por departamento e
categoria` · `feat(loja): trilha de navegacao no detalhe do produto`.

---

## 10. Riscos e armadilhas

1. **A chamada posicional que compila calada** (seção 4.3). O maior risco do
   plano inteiro: `page` virando `departmentId` não gera erro, e a vitrine sai
   vazia em produção. Argumentos nomeados no controller + `grep` nos chamadores.
2. **Faceta e grade divergirem.** Só o predicado único (`VisibleGroups`) impede;
   se alguém acrescentar regra de visibilidade em um dos três caminhos, o teste
   `nao_deve_contar_grupo_oculto...` é quem avisa.
3. **Chave de cache** (armadilha 1 do CLAUDE.md). A factory devolve o prefixo; a
   busca entra na chave em quem consulta. Errar aqui não quebra nada — a
   contagem só não atualiza.
4. **Histórico do navegador entupido** pela busca na URL. `replace: true` na
   busca, push nos filtros. O teste com `record: true` do `memoryLocation` é o
   que prova.
5. **Loop de sincronização** entre estado local do input e URL. Reidratar
   durante o render comparando com o último valor escrito, como
   `useProductDetail` já faz — não com `useEffect`.
6. **Id de filtro que não existe mais** (link velho, categoria renomeada/
   removida). `isUnknownFilter` + estado de tela com "Limpar filtros"; nunca
   tela em branco.
7. **`api-dev` não deploya sozinha.** Sem ação manual no Railway, a fase 3
   consome contrato antigo e o preview quebra com 404 em
   `/Storefront/departments` — parece bug de front e não é.
8. **Contagem × primeira página.** "Cozinha (30)" com 24 cards na tela é
   correto (scroll infinito), mas confunde na revisão: confira o `total` da
   paginação, não o número de cards.

---

## 11. Checklist de conclusão

- [ ] Backend: predicado de visibilidade em um lugar só, usado pelos três
      caminhos
- [ ] `GET /Storefront/departments` responde árvore com contagem coerente com a
      busca
- [ ] `GET /Storefront/products` aceita `departmentId` e `categoryId`
- [ ] Detalhe devolve `departmentId`, `departmentName`, `categoryId`
- [ ] Controller chama o serviço com **argumentos nomeados**
- [ ] Testes novos do storefront verdes, testes antigos **intocados** e verdes
- [ ] `models.ts` e hooks atualizados; retrato do contrato regerado no mesmo
      trabalho
- [ ] Vitrine filtra por departamento e por categoria, combinando com a busca
- [ ] Filtro na URL: link compartilhável, recarregar mantém, Voltar desfaz
- [ ] Estado de vazio com filtro oferece "Limpar filtros"
- [ ] Trilha `Departamento > Categoria > Produto` no detalhe, com links
      funcionando
- [ ] JSON-LD `BreadcrumbList` na página de detalhe
- [ ] READMEs atualizados com as regras de negócio novas
- [ ] `build:types`, `typecheck:loja`, `test`, `lint`, `format:check` verdes
- [ ] Smoke test da seção 7.4 executado e registrado no handoff

---

## 12. Ampliar o catálogo visível do ambiente de dev

O banco de dev tem **922 grupos**, 693 deles com produto ativo, em 21
departamentos e 80 categorias — e apenas **4** com "Exibir no site" ligado. O
filtro funciona, mas com uma categoria por departamento e contagem 1 não dá
para ver densidade, paginação com filtro nem categoria com irmãs.

A escrita direta no banco foi **bloqueada pela política de permissões da
sessão**, então fica registrado o comando. Ele liga a vitrine para todo grupo
não excluído que tenha ao menos um produto ativo:

```sql
UPDATE product_groups g
   SET show_on_site = true
 WHERE NOT g.is_deleted
   AND NOT g.show_on_site
   AND EXISTS (SELECT 1 FROM products p
                WHERE p.product_group_id = g.id
                  AND NOT p.is_deleted
                  AND p.status = 2);
```

Para desfazer, os quatro que já estavam ligados antes são os grupos
`903, 905, 907, 909`:

```sql
UPDATE product_groups SET show_on_site = false
 WHERE show_on_site AND id NOT IN (903, 905, 907, 909);
```

> Só no banco **de dev** (`uaus_db_dev`, host `altaria.proxy.rlwy.net`). Em
> produção, quem decide o que aparece no site é a lojista, pelo admin.

Notado de passagem, **não corrigido** (é dado, não código): nomes de categoria
do dev estão com mojibake — "UtensÃ­lios Diversos" em vez de "Utensílios
Diversos", UTF-8 lido como Latin-1 em alguma importação antiga.
