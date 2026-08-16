# Módulo de Catálogo de Imagens (`features/images`)

Este módulo gerencia o armazenamento, visualização, categorização e recuperação de URLs públicas de imagens carregadas na plataforma. Ele adota o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

- `components/ImageCatalog.tsx`: Exibe o filtro de busca, dropdown para filtragem de tipo, grid visual de imagens com miniaturas de preview, badge de tipo correspondente e botões de ação rápida para copiar URL de CDN, abrir em nova aba, renomear e excluir.
- `components/ImageUploadModal.tsx`: Dialog de upload permitindo arrastar/selecionar arquivos de imagem, geração de preview local, e configuração do nome e tipo da imagem.
- `components/ImageRenameModal.tsx`: Dialog focado na atualização do nome descritivo de registros de imagem já armazenados.
- `hooks/useImages.ts`: Gerencia o upload assíncrono multipart, queries paginadas com filtros, cópia de URL para o clipboard do usuário, renomeação de arquivos e exclusão de registros.
- `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Upload e Preview

- Ao selecionar um arquivo, o nome é preenchido por padrão com o nome do arquivo (removendo a extensão).
- Gera um ObjectURL local temporário para preview da imagem selecionada antes do envio final.
- O upload envia o arquivo físico e campos textuais via multipart form request no backend.

### 2. URL de Visualização Pública

- A renderização da URL utiliza a função auxiliar `buildPublicImageUrl` da infraestrutura core para resolver caminhos relativos para CDNs ou servidores locais correspondentes.

### 3. Clipboard Integration

- Ao clicar no ícone de cópia, resolve a URL absoluta correspondente e a grava na área de transferência (`navigator.clipboard`), alterando temporariamente o ícone de feedback por 2 segundos.

### 4. Paginação com duas origens

- Sem filtro de tipo, a página vem do servidor. **Com** filtro, ela é recortada aqui do catálogo inteiro: o endpoint `GET /Images` não filtra por tipo, e paginar no servidor daria um total que não corresponde ao que está na grade. O tipo `ImageCatalogPage` (em `types.ts`) é o que as duas origens têm em comum.
- Este é o único módulo do admin com **seletor de itens por página** — as miniaturas são o único conteúdo em que caber mais na tela compensa a espera do carregamento. Trocar o tamanho volta para a página 1: com 100 por página, a página 7 costuma deixar de existir e a grade ficaria vazia logo depois da troca.
- O hook **não** calcula mais `totalPages`: quem deriva é o `TablePagination`, a partir de `total` e do tamanho da página. Duas fórmulas para a mesma resposta era como o admin acumulou três rodapés diferentes.
