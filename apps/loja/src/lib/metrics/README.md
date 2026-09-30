# Métricas de acesso do site (`lib/metrics`)

O coletor próprio de visitas da loja online. As decisões que ele implementa e o
porquê de cada uma estão em `Uaus.Docs/dominio/metricas-do-site.md`; aqui fica
o que quem mexe neste código precisa saber.

## O que sai daqui

Eventos em lote para `POST /Storefront/events` (anônimo), na mesma origem via
`/api`. Um lote é de UMA sessão; visitante e sessão vão no cabeçalho do lote.

| Evento          | Quando                                                | Campos além da rota                          |
| --------------- | ----------------------------------------------------- | -------------------------------------------- |
| `page_view`     | a cada troca de rota (`SiteMetrics`)                  | referenciador e UTM só no primeiro da sessão |
| `product_view`  | junto do `page_view` de `/produtos/:id`               | `productGroupId`                             |
| `search`        | termo que chegou à URL, já com debounce               | `detail` = termo                             |
| `reserve_click` | botão "Reservar pelo WhatsApp" do detalhe             | `productGroupId`, `detail` = variação        |
| `contact_click` | WhatsApp do cabeçalho, rodapé, telefones e formulário | `detail` = onde                              |
| `page_leave`    | ao sair da página (rota nova, aba oculta, `pagehide`) | `durationMs` = tempo VISÍVEL                 |

A rota vai normalizada (`/produtos/:id`, nunca `/produtos/905`) e sem query
string — `routes.ts`. Sem isso cada produto viraria uma "página" no ranking.

## As regras que não são óbvias

- **Tempo por página é tempo visível e ativo**, não relógio de parede. O
  cronômetro só anda enquanto a página está visível (`visibilitychange`) e
  houve toque, rolagem ou tecla nos últimos 2 minutos. Teto de 30 min. O
  servidor aplica o mesmo teto. Sem isso, uma aba esquecida em segundo plano
  por três dias contaria como uma visita de 72 horas.
- **Sessão nova depois de 30 min oculta.** Ao voltar, a página em que a pessoa
  estava reabre como `page_view` da sessão nova. Recarregar a página mantém a
  sessão (`sessionStorage`).
- **Os sinais que valem no celular são `visibilitychange` e `pagehide`.**
  `beforeunload` não dispara de forma confiável e não é usado. Ao ficar oculta
  a página FECHA (`page_leave` com o tempo lido) e o lote sai; se o sistema
  matar a aba depois, nada se perdeu. Ao voltar, a página reabre em silêncio e
  o tempo seguinte vira outro `page_leave` da mesma rota — o servidor soma as
  durações por página. O lote também sai com 10 eventos ou depois de 15 s.
- **Falha é descartada.** `sendBeacon` (com `Blob` de `application/json`, senão
  vai como `text/plain` e a API recusa), fallback `fetch keepalive`, sem retry,
  sem fila crescendo. Métrica nunca atrapalha a visita.
- **`?semmetricas` desliga o coletor neste navegador** (marca em
  `localStorage`); `?commetricas` religa. É como a equipe não suja os números
  testando o site.

## Como testar

`collector.ts` não toca o navegador: tudo entra por `CollectorDeps` (relógio,
armazenamento, envio, visibilidade). `__tests__/collector.test.ts` roda com
relógio falso e cobre visibilidade, inatividade, renovação de sessão, lote e
desligamento. Quem liga ao DOM é `index.ts` e `components/layout/SiteMetrics.tsx`.

## O que NÃO fazer

- Não mandar nada identificável: nome, telefone, e-mail, texto de formulário.
  O termo de busca e o nome da variação são o máximo de texto livre aceito, e
  o servidor corta em 200 caracteres.
- Não chamar a API por outro caminho: o endpoint de eventos é a única escrita
  anônima da API e tem limite por IP; um segundo cliente disputaria a cota.
