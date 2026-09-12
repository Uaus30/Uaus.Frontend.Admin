# Conferência de Produtos (`features/inventory-count`)

A aba **Conferência de Produtos** da tela de Inventário (`/estoque/inventario?aba=conferencia`)
e a tarja que ela instala dentro da tela do produto.

A conferência é a varredura do catálogo inteiro para acertar, cadastro a
cadastro, o que o dia a dia deixou torto: **foto**, **variações**, **nome e
preço** e o **estoque físico contra o virtual**. Ela existe porque essa varredura
é longa — milhares de cadastros, feitos aos poucos, ao longo de dias — e sem um
documento que lembre o que já passou, a lista de pendentes seria a memória de
quem está conferindo.

O desenho do servidor está em `docs/conferencia-de-produtos.md`, no repositório
`Uaus.Backend.Api`. Aqui fica só o que é de tela.

---

## 📂 Estrutura de Arquivos

- `hooks/useInventoryCount.ts`: o estado da aba — conferência aberta, filtros,
  paginação, as três mutações (iniciar, encerrar, marcar) e a navegação para o
  produto.
- `hooks/useStockCount.ts`: a contagem física de uma variação, usada dentro da
  aba **Estoque** do produto.
- `components/InventoryCountPanel.tsx`: a aba inteira; escolhe entre o convite a
  começar e a conferência em andamento.
- `components/InventoryCountStart.tsx`: o convite, com o que a conferência faz e
  o botão **Nova conferência**.
- `components/InventoryCountProgress.tsx`: pendentes, conferidos, barra de
  progresso e o encerramento manual.
- `components/InventoryCountTable.tsx`: filtros, listagem e paginação.
- `components/ProductConferenceBanner.tsx`: a tarja dentro da tela do produto.
- `components/StockCountModal.tsx`: a modal da contagem física.
- `lib/photo-coverage.ts`: quanto da foto do cadastro está faltando.
- `lib/product-conference-link.ts`: o carimbo `?conferencia=1` no link do
  produto.

---

## ⚙️ Regras de Negócio Importantes

### 1. Dois modos, decididos por UMA pergunta

Há conferência aberta? `GET /InventoryCounts/current` responde **204** quando
não há — e é por isso que o hook usa `apiGet`, não `apiGetOrThrow`: "não há
conferência" é o estado inicial da tela, não um erro.

Sem conferência, a aba é o convite a começar. Com conferência, é o progresso
mais a lista do que falta.

### 2. A lista abre nos PENDENTES, e é isso que a faz terminar

Marcar um item o tira da tela; a lista encolhe até acabar. Os conferidos
continuam a um clique, no seletor de situação, porque desmarcar um clique errado
precisa de caminho de volta.

O acompanhamento do que falta vive **só aqui**: não há contador no menu nem
alerta no painel. Foi decisão do dono — a conferência é uma tarefa que se abre
para fazer, não um alarme que persegue quem está vendendo.

### 3. A correção acontece na tela do PRODUTO, não nesta

A conferência não edita nada por conta própria. "Abrir produto" leva para a tela
de detalhe, que já tem foto, nome, preço, variações e estoque — duplicar isso
aqui seria a segunda implementação a divergir.

Quem sai daqui leva o carimbo `?conferencia=1` na URL. É ele que faz a tarja do
produto **devolver** o operador para esta lista depois de marcar "conferido": sem
o carimbo, quem abriu o produto pela tela de Produtos e marcou de passagem seria
arrancado para o Inventário sem ter pedido.

### 4. O encerramento chega pela RESPOSTA da marcação

`reviewInventoryCountProduct` devolve a conferência já recontada. Quando o item
marcado era o último, ela volta com status **Encerrada**, e é dali que sai o
aviso de conclusão. Perguntar de novo ao servidor abriria uma janela em que a
tela mostra "0 pendentes" com a conferência ainda aberta.

O **encerramento manual** existe porque a conferência aberta bloqueia a próxima:
sem saída, um punhado de itens que ninguém quer conferir prenderia o recurso
para sempre. Ele passa por confirmação que diz quantos ficarão sem conferir.

### 5. A contagem física pede o CONTADO, não a diferença

Contar é o que a pessoa acabou de fazer; pedir a diferença seria pedir uma conta
de cabeça que o servidor faz sem errar. A modal mostra o desfecho antes de
gravar:

| Contagem        | O que é gravado             |
| --------------- | --------------------------- |
| = ao sistema    | nada                        |
| < que o sistema | baixa com motivo Inventário |
| > que o sistema | entrada de Ajuste Manual    |

Fornecedor e custo só aparecem no formulário quando **sobra**, porque só a sobra
vira lote — e lote sem custo envenena o FIFO e a valorização do inventário. Os
dois chegam sugeridos (fornecedor da última entrada, custo atual do produto) e
podem ser trocados.

A contagem é da **variação** aberta na aba Estoque, não do grupo: estoque é do
SKU. O grupo é a unidade da conferência; o SKU é a unidade do estoque.

### 6. Cor é leitura, e o vocabulário é o do repositório

Segue `Uaus.Docs/dominio/convencoes-de-interface.md`, sempre com ícone e rótulo
ao lado:

| Onde               | Verde (emerald) | Âmbar (amber)              | Vermelho (destructive)    |
| ------------------ | --------------- | -------------------------- | ------------------------- |
| Progresso          | conferidos      | a conferir                 | —                         |
| Linha da lista     | conferido       | variações sem foto (parte) | cadastro sem foto nenhuma |
| Tarja do produto   | já conferido    | espera conferência         | —                         |
| Prévia da contagem | estoque confere | falta (vira baixa)         | —                         |

A sobra na prévia usa a cor **primária**, e não um verde novo: "entrou
mercadoria" não é o mesmo "positivo" do vocabulário, e inventar um quinto
significado quebraria os quatro que existem.

---

## 🧪 Testes

- `hooks/__tests__/useInventoryCount.test.tsx`: o padrão de pendentes, o retorno
  à página 1 ao filtrar, os três avisos da marcação (faltam N / concluída /
  devolvido), o carimbo no link do produto e a confirmação do encerramento.
- `lib/__tests__/photo-coverage.test.ts`: os três estados da foto, incluindo o
  cadastro sem variação viva.
