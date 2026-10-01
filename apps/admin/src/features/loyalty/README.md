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

### 5. "Para agir": retrato de hoje, não do período

Seis números (prêmios esperando troca, a 1 carimbo de um prêmio, cartões que vencem em 30 dias, em folga, sem comprar há 45 dias, aniversariantes do mês), cada um abrindo a lista dos clientes que ele conta — nome, telefone, carimbos e a data que importa naquela lista. Não seguem o filtro de período: "quem está a 1 carimbo" só faz sentido hoje. A lista só é pedida quando aberta. **Sem botão de WhatsApp** (decisão do dono): a lista serve para o balcão lembrar o cliente quando ele aparecer.

O número e a lista saem da **mesma consulta** no servidor (`GET /Loyalty/actions` conta as listas de `GET /Loyalty/actions/{lista}`): o número que diz 3 abre uma lista de 3.

### 6. Os gráficos (entrega 5, 01/10/2026)

Seguem o período, exceto os cartões abertos (hoje):

- **Carimbos por semana**: as 12 semanas (de segunda a domingo) que terminam no fim do período — mostra se o programa pegou.
- **Onde estão os cartões abertos**: quantos cartões com cada número de carimbos; em destaque, os que estão a 1 de um prêmio.
- **Do cadastro ao cartão completo**, **como conheceram a loja**, **perfil de quem carimbou** (sexo e faixa de idade, recalculada pelo nascimento) e a **tabela por operador**: vendas, vendas com cliente, % e cadastros — é ali que se vê quem pergunta pelo cliente no caixa.

Listas curtas de categorias são barras horizontais com o número escrito ao lado, legíveis no celular sem passar o mouse. Salvar, ligar e desligar invalidam o prefixo `getLoyaltyDashboardQueryKey` junto com o resumo.

O ajuste manual de carimbos fica na tela de clientes (`features/customers`, regra 4).
