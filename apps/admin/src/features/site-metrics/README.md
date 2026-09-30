# Site (`/bi/site`)

As métricas de acesso da loja online (uaus.com.br): quem está no site agora,
como foi hoje, quantos vieram no período, de quantos IPs, por quanto tempo, o
que viram e quantos chegaram ao botão de reservar pelo WhatsApp.

Só Admin (`SO_ADMIN`): a tela lista IPs de visitantes.

As decisões que atravessam site, API e admin estão em
`Uaus.Docs/dominio/metricas-do-site.md`. Aqui, o que esta tela decide.

## De onde vêm os números

- O **site** conta as próprias visitas (`apps/loja/src/lib/metrics/`) e manda
  em lote para `POST /Storefront/events`. A API grava cru em `site_events`.
- A **rotina diária** da API consolida cada dia fechado em `site_daily_stats`,
  zera o IP dos eventos com mais de 90 dias e apaga os com mais de 13 meses.
- Esta tela lê `GET /SiteMetrics/overview?startDate&endDate`. **Hoje e os
  últimos 30 minutos são sempre ao vivo**, calculados nos eventos crus; os dias
  fechados vêm da consolidação (`isLive` diz qual é qual, e o gráfico pinta o
  dia de hoje mais claro).

## O vocabulário da tela

| Palavra          | O que é                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Visitante        | Um navegador: id anônimo em `localStorage`. Não é pessoa nem IP.                                                            |
| Visita           | Uma sessão: termina após 30 min com o site fechado ou em segundo plano. Quem volta depois é visita nova.                    |
| IPs distintos    | O que o dono pediu. Fica ao lado de "visitantes" de propósito: a diferença é o quanto o IP engana.                          |
| Tempo por visita | **Mediana** da soma do tempo visível das páginas da sessão. Mediana, não média: uma aba de 30 min esquecida não puxa o dia. |
| Funil            | Visitas → abriram um produto → clicaram em reservar. Conta sessões, não cliques.                                            |
| De onde vieram   | UTM da divulgação quando há; senão o domínio de origem; **"direto"** é link digitado, favorito ou WhatsApp sem UTM.         |

## Regras que não são óbvias

- **Período é sempre "os últimos N dias contando hoje"** (7, 30, 90, 365). A
  pergunta é "como está e como estava", não um recorte arbitrário; e é o que
  deixa "hoje" sempre presente.
- **Acima de 30 dias** a API não carrega os eventos crus: os totais são a
  soma das linhas diárias (visitante que voltou em dois dias conta duas vezes);
  páginas, produtos e origens vêm das quebras diárias consolidadas (é assim que
  a divulgação de setembro continua legível em dezembro); IPs e buscas não são
  listados. A tela avisa.
- **A tela se atualiza sozinha a cada minuto** (`refetchInterval`). É a única
  do admin assim, porque é a única em que "agora" é a pergunta.
- **Divulgação no WhatsApp aparece como "direto"** — o app não passa
  referenciador. Para medir, o link divulgado precisa de UTM
  (`?utm_source=whatsapp&utm_campaign=...`).
- **A equipe não deve contar.** `?semmetricas` na URL do site desliga o
  coletor naquele navegador; `?commetricas` religa.

## Acessos à API sem login (fase 3)

Robô e scanner não executam o JavaScript do site, então nunca aparecem nas
visitas. A API conta, por IP e dia, toda chamada SEM token
(`GET /SiteMetrics/api-access`, tabela `api_access_by_ip`, gravada a cada
minuto a partir de um acumulador em memória). A leitura é por **assinatura**,
não por volume:

| Coluna | O que denuncia                                                 |
| ------ | -------------------------------------------------------------- |
| Site   | chamadas ao `/Storefront` — o que um visitante de verdade gera |
| 404    | rota inexistente: scanner procurando WordPress, `.env`, etc.   |
| 401    | tentou rota interna sem token                                  |
| 429    | estourou o limite por IP do coletor                            |

O ícone de escudo marca IP com qualquer 404/401/429; o de robô, user agent
que se declara robô. Health check e Swagger não contam.

## O que a tela NÃO faz

- Não bloqueia IP: só mostra. Bloqueio, se vier, é decisão do dono.
- Não cruza com cupons: melhoria futura, fora do escopo combinado.
