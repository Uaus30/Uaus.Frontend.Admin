# Programa de fidelidade (`features/loyalty`)

A tela **Marketing › Fidelidade** (01/10/2026). Uma tela só: o estado do programa (ligado desde quando, ou desligado), a regra numa linha, a configuração num modal e os números do período. A regra de negócio inteira está em `Uaus.Docs/dominio/cupons-e-fidelidade.md`; aqui fica o que a tela decide.

## Regras de negócio da tela

### 1. Ligar só com a configuração completa

O botão **Ligar** fica desabilitado enquanto o servidor devolver `turnOnBlockers` (cada frase é um problema: cupom não associado, cupom com data de fim, com limite de usos, com compra mínima própria, de tipo ou valor diferente do prêmio). A lista aparece logo abaixo do cabeçalho, em amarelo — o administrador lê o que falta em vez de clicar e receber um erro.

Com o programa **ligado**, salvar uma configuração que quebraria o programa (trocar para um cupom que não serve) é recusado pelo servidor; a frase dele vai para o toast.

### 2. Desligar pede confirmação, com o efeito escrito

"As vendas deixarão de ganhar carimbos automáticos e o prêmio deixará de entrar sozinho no carrinho. Cartões e prêmios já conquistados ficam guardados e podem ser trocados até vencer." É o texto que o dono pediu.

### 3. O modal de configuração

Três blocos — cartão, prêmios, prazos —, com o preenchido em verde (`filledFieldClass`). Os valores em reais saem do servidor com vírgula (`formatAmountInput`): o parse pt-BR lê o ponto como milhar, e abrir e salvar sem mexer transformaria R$ 9,90 em R$ 99,00 (o defeito que a entrega 1 corrigiu nos cupons). A conferência do modal (`formToPayload`) repete as recusas do servidor para o erro aparecer antes do clique ir à rede.

Os cupons do select só são pedidos com o modal aberto. Salvar, ligar e desligar invalidam também a listagem de cupons: é ela que mostra o selo "Gerenciado pelo programa de fidelidade".

### 4. Os números do período

Por padrão, **todo o período** (pedido do dono). Os atalhos (este mês, mês passado, 90 dias) viram datas no relógio da loja (`toDateKey`, nunca `toISOString`). Os seis cards contam até o valor quando aparecem (`useCountUp`), sem animação para quem desligou animações no aparelho. O valor médio compara com junho a setembro de 2026, antes do programa.

Gráficos, listas para agir e ajuste manual de carimbos são a entrega 5.
