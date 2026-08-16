# Módulo de Sócios (Admin)

Cadastro dos sócios da empresa e edição da distribuição de lucros — os percentuais que o fechamento financeiro aplica sobre o lucro líquido do período. Rota futura: `/financeiro/socios`.

## Estrutura de Arquivos

- `types.ts`: Tipos do formulário de sócio e re-export dos DTOs do api-client.
- `hooks/usePartners.ts`: Hook controlador único — listagem paginada com busca local (debounce 300ms), CRUD via mutations locais com as funções puras do api-client e a edição da distribuição de lucros (rascunho de percentuais, soma ao vivo e gravação).
- `components/PartnersTable.tsx`: Tabela de sócios com percentual, badge de status e ações de editar/excluir.
- `components/PartnerEditorModal.tsx`: Modal de cadastro/edição. Na edição permite alternar o status, com aviso de que desativar zera o percentual.
- `components/ProfitSharesCard.tsx`: Card da distribuição de lucros — um input de percentual por sócio ativo, indicador da soma e botão de salvar.
- `hooks/__tests__/usePartners.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).

## Regras de Negócio

- **A soma dos percentuais entre os sócios ATIVOS deve ser 100,00.** O botão de salvar da distribuição só libera com soma exata de 100% (e alguma mudança pendente) — a mesma validação que o backend aplica ao gravar e ao confirmar um fechamento.
- **A gravação envia exatamente o conjunto de sócios ativos.** Sócio faltando, percentual negativo ou soma diferente de 100 são recusados pelo backend com `ValidationException`.
- **Fechamentos congelam o rateio.** Nome, percentual e valor de cada sócio são gravados na confirmação do fechamento — mudar os percentuais (ou o nome do sócio) depois **não retroage** sobre fechamentos existentes.
- **Sócio novo nasce ativo, com percentual 0.** O ajuste acontece na distribuição de lucros, não no cadastro.
- **Desativar um sócio zera o percentual dele.** A soma deixa de fechar em 100 e precisa ser rebalanceada antes do próximo fechamento — a UI avisa ao desativar.
- **Excluir só é possível sem fechamentos registrados.** Se o sócio aparece no rateio de algum fechamento, o backend recusa (FK Restrict) e orienta a desativá-lo; a mensagem vai inteira para o toast. Por isso `handleDeletePartner` **relança** a rejeição: é ela que mantém o `ConfirmDialog` aberto para o operador ler o motivo e escolher desativar. Um diálogo que fechasse na falha faria a recusa passar batida atrás do toast.
- **A confirmação da remoção mora na `PartnersTable`**, não no hook, porque o aviso precisa citar o percentual da linha: remover um sócio com fatia derruba a soma abaixo de 100 e trava o próximo fechamento — exatamente o que não dava para adivinhar do `window.confirm` anterior, que só perguntava `Remover o sócio "X"?`.
- **A busca por nome é local.** O endpoint `GET /partners` não aceita busca; o filtro (com debounce de 300ms) age sobre a página carregada — suficiente para o volume esperado de sócios.
- **Invalidação de cache:** as mutações invalidam a listagem de sócios (`getGetPartnersQueryKey()`) e a distribuição (`PARTNER_PROFIT_SHARES_QUERY_KEY`), porque nome, status e percentual aparecem nas duas consultas. A factory devolve só o prefixo do recurso, então a invalidação alcança todas as páginas e buscas em cache.
