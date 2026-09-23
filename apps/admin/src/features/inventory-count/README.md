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
  aba **Estoque** do produto e pelo item **Contagem de estoque** do menu da
  listagem de produtos.
- `components/InventoryCountPanel.tsx`: a aba inteira; escolhe entre o convite a
  começar e a conferência em andamento.
- `components/InventoryCountStart.tsx`: o convite, com o que a conferência faz e
  o botão **Nova conferência**.
- `components/InventoryCountProgress.tsx`: pendentes, conferidos, barra de
  progresso e o encerramento manual.
- `components/InventoryCountTable.tsx`: filtros, listagem e paginação.
- `components/ProductConferenceBanner.tsx`: a tarja dentro da tela do produto.
- `components/StockCountModal.tsx`: a modal da contagem física.
- `lib/photo-coverage.ts`: o cadastro tem foto ou não (dois estados desde 12/09/2026).
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

**A mesma modal abre pela listagem de produtos** (23/09/2026), no menu da linha,
só para Administrador. Ali a linha é um GRUPO, então a modal ganha por cima a
escolha da variação (`picker`) e fica travada (`ready = false`) até haver um SKU
escolhido e o saldo dele chegar do servidor. A observação em branco vira
"Contagem de estoque pela listagem de produtos." (`defaultNotes`): sem ela, o
servidor grava "da conferência de produtos", e quem investigar o documento depois
procuraria uma conferência que não existiu. O desenho está em
`features/products/README.md`, seção 7.

**Sobra que reativa o produto é anunciada.** A sobra é uma entrada, e entrada em
produto Inativo ou "Sem estoque" o devolve a Ativo (23/09/2026). O resultado da
contagem traz a lista, e o `useStockCount` a entrega ao aviso global
(`src/lib/product-reactivation.ts`). O reenvio da mesma contagem, depois de uma
resposta perdida, volta com diferença zero e sem a lista; aí o aviso sai da
comparação do produto antes e depois (`reactivationBetween`).

### 5.1. Rodadas, e o estoque congelado enquanto a rodada está aberta (23/09/2026)

Decisão do dono: **com a conferência aberta, nenhuma venda, cancelamento de venda,
entrada ou baixa**. A contagem compara a prateleira com o saldo, e um saldo que
anda enquanto alguém conta produz a diferença errada. Quem garante é o servidor
(ele recusa com a mensagem pronta). A tela avisa antes:

- a tela de abertura diz, em âmbar e antes do botão, que o estoque vai congelar;
- o cabeçalho da conferência aberta repete "Estoque congelado: o PDV não vende até
  você encerrar";
- a faixa global do admin (`src/components/stock-freeze-banner.tsx`) aparece em
  toda tela e leva de volta à conferência;
- "Registrar Entrada" (aba Estoque) e "Confirmar recebimento" (compras) ficam
  travados. Nas demais telas, a recusa do servidor chega no aviso de erro.

A contagem física segue liberada: é a ferramenta da própria conferência.

Como a loja não vende com a conferência aberta, ela é feita em **rodadas curtas**.
Sem conferência aberta, a tela lê a última rodada encerrada
(`GET /InventoryCounts/last`) e, se ela deixou pendentes, oferece **Continuar de
onde parou (N)** — só os que faltam — ou **Recomeçar do zero**. "Encerrar rodada"
é o fim normal de uma sessão; o que faltou continua na próxima.

- Com pendentes para continuar, **Recomeçar do zero pede confirmação**: o botão
  fica ao lado do "Continuar", e um clique nele apagaria o ponto de partida da
  próxima rodada, que passaria a ser o catálogo inteiro.
- A tela **espera a última rodada** antes de oferecer os botões (`isLoadingCount`),
  e com a atual ou a última em erro mostra "Tentar de novo" em vez deles
  (`loadFailed`): sem a resposta, o "Continuar" some e um clique recomeçaria do
  zero quem queria continuar.

Cada linha pendente mostra a **última conferência** do cadastro numa rodada
anterior ("Nunca conferido" quando não houve), e a tarja da tela do produto
também. Ao recomeçar do zero, é o que separa o conferido ontem do esquecido há
meses.

Abrir e encerrar invalidam o status do congelamento (`getGetStockFreezeStatusQueryKey`):
a faixa e os botões mudam na hora, sem esperar a consulta seguinte de 30 s.

### 6. Cor é leitura, e o vocabulário é o do repositório

Segue `Uaus.Docs/dominio/convencoes-de-interface.md`, sempre com ícone e rótulo
ao lado:

| Onde               | Verde (emerald) | Âmbar (amber)      | Vermelho (destructive)    |
| ------------------ | --------------- | ------------------ | ------------------------- |
| Progresso          | conferidos      | a conferir         | —                         |
| Linha da lista     | conferido       | —                  | cadastro sem foto nenhuma |
| Tarja do produto   | já conferido    | espera conferência | —                         |
| Prévia da contagem | estoque confere | falta (vira baixa) | —                         |

A sobra na prévia usa a cor **primária**, e não um verde novo: "entrou
mercadoria" não é o mesmo "positivo" do vocabulário, e inventar um quinto
significado quebraria os quatro que existem.

---

## 🧪 Testes

- `hooks/__tests__/useInventoryCount.test.tsx`: o padrão de pendentes, o retorno
  à página 1 ao filtrar, os três avisos da marcação (faltam N / concluída /
  devolvido), o carimbo no link do produto e a confirmação do encerramento.
- `lib/__tests__/photo-coverage.test.ts`: os dois estados da foto, incluindo o
  cadastro sem variação viva.
