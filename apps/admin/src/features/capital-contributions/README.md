# Aportes (`features/capital-contributions`)

O dinheiro que os sócios põem na loja (rota `/financeiro/aportes`, desde 23/11/2026). No molde canônico de `features/fixed-costs`. Contrato em `PLANO-FINANCEIRO.md` (seções 5.1, 6.1 e 7.2).

## Estrutura de Arquivos

- `hooks/useCapitalContributions.ts`: hook controlador — filtro de mês (o corrente por padrão, sem passar dele), os aportes do mês com o total, o acumulado por sócio, a modal de lançamento e edição, a exclusão e o toast com o efeito na faixa.
- `components/CapitalContributionsTable.tsx`: data, sócio, valor, observação e quem lançou, com o total do mês; a confirmação da exclusão mora aqui.
- `components/CapitalContributionEditorModal.tsx`: data (hoje), sócio (os ativos), valor e para quê.
- `components/PartnerTotalsCard.tsx`: o acumulado de cada sócio desde a abertura.
- `band-effect.ts`: a frase do toast ("Novembro passou de amarelo para verde").
- `capital-contributions-route.ts`: o caminho e o atalho `?novo=1` do Painel.

## Regras de Negócio

### 1. O aporte entra como saldo disponível

- Saldo disponível = saldo inicial + aportes do mês (decisão 8). O aporte sobe as duas linhas da faixa de compras e pode levar o mês de amarelo ou vermelho para verde.
- **Toda mutação invalida os aportes E a faixa** (`["CapitalContributions"]` e `["PurchaseBudget"]`): sem a segunda, o Painel e a listagem de Compras ficariam com a faixa velha.
- **O toast diz o efeito**: "Novembro passou de amarelo para verde." ou "Novembro continua verde.". A faixa do mês do aporte é lida direto do servidor antes e depois da gravação — o cache dela pode nem existir quando a pessoa chega por aqui. Se uma das duas leituras falhar, o toast fica só com o título: a gravação nunca depende da faixa.

### 2. Aporte não é dívida

- Sem saldo devedor, devolução ou juros (decisão 9). O acumulado por sócio é informativo.

### 3. Regras de entrada

- Data (hoje por padrão, nunca no futuro — aporte é dinheiro que já entrou), sócio **ativo**, valor **maior que zero**, observação até 300 caracteres. A data viaja como `"yyyy-MM-dd"` (`toDateKey`, componentes locais).
- O select de sócio segue a regra dos selects (ordem alfabética). Na edição, o sócio do aporte aparece mesmo se tiver sido desativado depois — sem ele o select ficaria vazio; o servidor é quem decide se aceita.
- As recusas de regra (sócio inativo, mês fechado, valor) são do servidor e chegam no toast com a mensagem dele.

### 4. Mês fechado trava

- **Mês fechado não aceita aporte** — criar, editar nem excluir. Os botões da linha ficam travados e o motivo fica **escrito acima da tabela**: dica que só existe no hover não existe no celular.
- A exclusão é lógica, com Log de alerta no backend, e confirma citando data, sócio e valor.

### 5. Atalho do Painel

- "Lançar aporte" do Painel Financeiro chega com `?novo=1` e a modal já abre. Fechar a modal tira o parâmetro da URL (`replaceState`): sem isso, um F5 reabriria a modal vazia.
