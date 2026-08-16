# Feature PDV (ponto de venda)

A tela de balcão: busca de produto, carrinho, checkout com N formas de pagamento, histórico do turno, baixa de estoque e operação offline. `pages/pdv.tsx` só compõe — ela não faz query, mutation nem conta. Tudo que decide alguma coisa mora aqui.

A referência do modo offline (IndexedDB, fila, snapshot) é `apps/pdv/docs/offline.md`; este README cobre o que a tela faz com isso.

## Estrutura de Arquivos

### Hooks

- `hooks/use-pdv-operator.ts`: operador autenticado (`/me`) e o desvio para o login. Sem `retry` — um 401 vira redirecionamento na hora, não três tentativas com o operador olhando para um spinner.
- `hooks/use-pdv-payment-methods.ts`: formas de pagamento em uso, mesclando a API com a cópia da base local, mais o mapa `id → nome` que os cupons de vendas antigas usam.
- `hooks/use-pdv-counter.ts`: o balcão. Busca, entrada no carrinho, foco do leitor de código de barras, pausar e retomar venda.
- `hooks/use-product-search.ts`: estado da busca de produtos, disparo por digitação e leitura de código de barras. Usado pelo balcão **e** pelo diálogo de baixa.
- `hooks/use-debounced-value.ts`: o par de parâmetros de toda busca digitada do PDV (`400ms` / `3 caracteres`) e o debounce genérico.
- `hooks/use-sale-checkout.ts`: confirmação do pagamento — validações, gravação (API ou fila), aviso e cupom. É onde o CRUD de Cupom entra (ver "Ponto de extensão" abaixo).
- `hooks/use-sale-history-actions.ts`: cancelar, reimprimir e reabrir para edição uma venda já registrada.
- `hooks/use-sales-report.ts`: relatório consolidado do turno.
- `hooks/use-pdv-session-actions.ts`: abrir caixa, pedir o fechamento e sair do PDV.
- `hooks/use-stock-write-off-draft.ts`: rascunho da baixa de estoque (motivo, itens, observação) e a gravação.
- `hooks/use-offline-queue.ts`: as duas filas locais (vendas e baixas) e as ações do painel offline.
- `hooks/use-pdv-dialogs.ts`, `hooks/use-receipt-printer.ts`: estado dos modais e impressão que não derruba a venda.

### Lib (funções puras, com teste)

- `lib/build-sale-payload.ts`: carrinho + checkout → payload da venda. Desconto separado do preço, taxa pela parcela ativa.
- `lib/build-sale-receipt.ts`: venda gravada + carrinho → `ReceiptData`.
- `lib/format-queue-time.ts`: data curta do painel offline.

### Componentes

`components/pdv-header.tsx` e `pdv-main-menu.tsx` (cabeçalho e menu sanduíche), `pdv-search-panel.tsx` (coluna esquerda), `pdv-cart-panel.tsx` + `pdv-cart-item.tsx` (coluna direita), `pdv-dialogs.tsx` (todos os modais), `preferences-dialog.tsx`, `confirm-discard-dialog.tsx`, `write-off-items-list.tsx`, `offline-queue-rows.tsx`, `offline-status-cards.tsx`.

## Regras de Negócio

### 1. A venda tem dois caminhos, e o cupom não sabe qual foi

Com conexão, a venda vai inteira para a API numa requisição atômica e sai com número definitivo. Sem conexão, entra na fila local e o cupom sai com número provisório (`OFF-n`), carimbado como pendente de sincronização. **Os dois caminhos debitam o estoque local**, então a venda seguinte já enxerga o saldo certo.

Uma reedição regrava a venda existente e **exige** conexão: não há como atualizar na fila uma venda que só existe no servidor.

Os três resultados possíveis são normalizados em `SavedSale` (`types.ts`) antes de qualquer coisa depender deles. Sem isso, cada ramo (aviso, cupom, histórico) se ramificava de novo.

### 2. Chave de idempotência é do checkout, não da tentativa

`saleClientReference` nasce no primeiro clique em "Confirmar" e é reutilizada em toda retentativa daquele mesmo checkout. Se o POST chegou ao servidor mas a resposta voltou como erro (um 504 de proxy), o reenvio com a MESMA chave é reconhecido pelo índice único de `ClientReference` — com chave nova a cada clique, o servidor gravaria uma segunda venda idêntica. Ela só é liberada quando a venda confirma, é descartada ou é pausada. A baixa de estoque usa exatamente a mesma mecânica, com a chave presa ao rascunho.

### 3. Desconto viaja separado do preço

No payload, `unitPrice` é o que o cliente pagou e `discount` é o abatimento por unidade; `unitPrice + discount` reconstrói o preço de tabela **do momento da venda**. É disso que dependem o relatório de descontos e qualquer auditoria de cupom.

A mesma regra explica a reedição: ao reabrir uma venda, o preço de tabela vem da própria venda, e não do cadastro de hoje — usar o preço atual reescreveria o histórico (mudar o preço no admin alteraria retroativamente o desconto de uma venda antiga).

Há três caminhos para descontar (diálogo de desconto da venda, preço digitado na linha do carrinho, remoção do desconto) e todos passam por `computeDiscount` do `@workspace/core`. Preço acima do de tabela é recusado: gravaria desconto negativo.

### 4. Taxa de parcelamento sai da parcela ativa

A taxa é calculada no PDV sobre o percentual da parcela **ativa** daquela forma de pagamento. Parcela inativa — ou forma que veio da base local sem aquela parcela — vale zero, nunca a taxa de outra parcela.

O pagamento do checkout é inicializado **uma vez** por abertura. Sem esse guard, qualquer refetch de `/PaymentMethods` em segundo plano (foco na janela, reconexão invalidando o cache) trocava a identidade do array e a seleção do operador — cartão, parcelas, divisão, valor recebido — era silenciosamente substituída pela primeira forma da lista.

### 5. Movimento pendente trava o turno

Fechamento de caixa e saída do PDV consultam a soma de **vendas e baixas** que o servidor ainda não conhece. Fechar com fila pendente contaria uma gaveta que o servidor não conhece; sair deixaria movimento preso neste navegador — e o logout limpa o cadastro local, então o operador seguinte nem saberia da pendência. Antes de recusar o fechamento, o PDV tenta sincronizar: na maioria das vezes a fila sobe e o operador segue direto.

Descartar um movimento recusado **não devolve estoque local**: a recusa já devolveu o saldo quando o movimento saiu do ar, e devolver de novo inflaria a base local.

### 6. Sem caixa aberto, sem venda — quando a loja usa caixa

`resolveCashRegisterMode` (em `lib/cash-register-mode.ts`) traduz a configuração da empresa nas perguntas que a tela faz. Com controle de caixa, a tela fica bloqueada pelo diálogo de abertura e a venda exige `cashRegisterSessionId`. A **baixa de estoque nunca exige sessão**: é movimento de estoque, não de dinheiro — quem resolve o turno dela é o servidor.

### 7. O cursor pertence ao campo de busca

O caixa é operado com leitor de código de barras, que digita no campo focado. Todo caminho que encerra uma venda devolve o cursor para a busca; nenhum caminho o refoca no meio de uma venda, porque isso roubava o cursor de quem estava editando a quantidade ou o preço de um item. Uma leitura de código de barras (termo que casa exatamente com **um** produto) não passa pela lista de resultados: o produto vai direto ao destino e o campo é limpo.

### 8. Busca: 400ms e 3 caracteres, em toda a tela

Eram três debounces copiados com números diferentes (600ms/3 no balcão e na baixa, 400ms/2 no consumidor). O par único está documentado em `hooks/use-debounced-value.ts`: 400ms ainda absorve a rajada do leitor (que emite o código inteiro em menos de 100ms) sem meio segundo de tela parada; 3 caracteres evitam disparar no meio de qualquer palavra e voltar com o teto de 20 resultados.

Como a digitação já dispara sozinha, **não há botão de buscar**. O formulário continua ali por causa do Enter, que é a única saída para um termo com menos de 3 caracteres. **Esc limpa o campo**, igual ao "x" — o balcão trabalha sem tirar a mão do teclado.

### 9. Busca sem resultado não é erro

"Não encontrei" aparece dentro da lista de resultados, no lugar do primeiro item, e **não** vira toast. O aviso pipocava a cada termo digitado pela metade (o debounce dispara com 3 caracteres) e gastava o mesmo toast vermelho que carrega "estoque insuficiente" — o operador aprendia a dispensar vermelho sem ler. Offline o texto ganha uma segunda linha sobre a base local: ali "não encontrei" quase sempre quer dizer "o catálogo não foi baixado", e essa diferença decide se ele procura outro termo ou vai atrás do snapshot.

Por isso `useProductSearch` expõe `notFound` separado de `results`: antes da primeira busca a lista também está vazia, e a tela precisa distinguir "ainda não procurei" de "procurei e não existe".

### 10. Produto zerado vai para o fim da lista

`lib/product-search.ts` ordena os dois caminhos da busca (API e base local) deixando estoque zero por último, com ordenação estável para não embaralhar a relevância que a API devolveu. Zerado não pode ser vendido nem baixado; no topo, com o teto de 20 resultados, ele empurrava para fora da tela o item que o operador consegue usar. Continua aparecendo — sumir com ele faria o operador concluir que o cadastro foi apagado.

### 11. Forma de pagamento na ordem de cadastro

O checkout lista as formas por ID crescente. Sem ordenar, a lista herdava a ordem de quem respondeu (paginação da API num caminho, chave do IndexedDB no outro) e as formas trocavam de lugar ao cair a conexão — e o operador clica por posição. Por ID, o que a loja usa desde sempre fica no topo.

## Ponto de extensão: CRUD de Cupom

O cupom é montado por `lib/build-sale-receipt.ts` — função **pura**, que recebe a venda gravada (`SavedSale`) e o carrinho, e devolve o `ReceiptData` que vai para a impressora. Ela é chamada de um ponto único e explicitamente marcado em `use-sale-checkout.ts`, depois de a venda já existir.

É esse `ReceiptData` que o CRUD de Cupom precisa persistir e reler. Nada depois da montagem depende de **como** o cupom foi obtido: trocar a chamada local por uma ida ao serviço de cupom não mexe na gravação da venda nem na impressão.

## Testes

Hooks e funções puras têm teste em `hooks/__tests__/` e `lib/__tests__/`. O que está coberto, e por quê: idempotência da venda e da baixa, guard de inicialização do checkout, conferência de estoque local, reconstrução do preço de tabela na reedição, cálculo de taxa por parcela, fallback de formas de pagamento para a base local, e o debounce/leitura de código de barras da busca.
