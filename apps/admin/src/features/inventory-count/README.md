# Contagem de estoque

Tela de conferência do estoque físico por planilha: `/estoque/contagem`.

Regras e contrato do backend em
[`Uaus.Backend.Api/docs/contagem-de-estoque.md`](../../../../../Uaus.Backend.Api/docs/contagem-de-estoque.md).
Leia lá antes de mexer aqui — nenhuma regra de negócio mora nesta feature.

## Fluxo

```
1. Baixar planilha  →  GET /InventoryCounts/export   (xlsx com a coluna "contagem" vazia)
2. Preencher no Excel
3. Escolher arquivo →  POST /InventoryCounts/preview (mostra o impacto, não grava nada)
4. Aplicar          →  POST /InventoryCounts/apply   (falta vira baixa, sobra vira entrada)
```

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `hooks/useInventoryCount.ts` | orquestra o ciclo; todo o estado da tela |
| `components/InventoryCountSteps.tsx` | os dois passos (baixar / importar) |
| `components/InventoryCountResult.tsx` | faltas, sobras e linhas ignoradas |
| `../../services/inventory-count.service.ts` | download, validação do arquivo, chamadas |
| `../../pages/inventory-count.tsx` | monta a página; sem regra |

## Decisões

**A prévia é obrigatória.** Escolher o arquivo já dispara a prévia, e o botão de
aplicar só aparece depois dela. A aplicação altera muitos produtos de uma vez e
não tem desfazer em lote — o dono precisa ver o impacto antes.

**Escolher e conferir num passo só.** Separar em dois cliques faria o operador
achar que já importou ao escolher o arquivo.

**O input de arquivo é zerado depois de cada escolha.** Sem isso, corrigir a
planilha e escolher o *mesmo* arquivo de novo não dispararia o evento `change`, e
a tela ficaria mostrando a prévia velha.

**"Na exportação" e "agora" aparecem lado a lado** nas tabelas de diferença. A
diferença entre as duas colunas é venda ocorrida depois da exportação, não erro
de contagem, e sem as duas o dono não tem como saber disso.

**Validação do arquivo por extensão, não por MIME type.** O Windows reporta o
tipo de `.xlsx` de formas diferentes dependendo de haver Excel instalado; recusar
por MIME barraria arquivos válidos.

**Prévia e resultado usam o mesmo componente.** O dono confere a prévia e precisa
reconhecer exatamente aquilo depois de aplicar; layouts diferentes convidariam os
dois a divergir.

## Testes

`@/services/__tests__/inventory-count.service.test.ts` cobre a validação do
arquivo, a regra de quando dá para aplicar (bloqueio e ausência de diferença) e o
download com liberação do object URL.
