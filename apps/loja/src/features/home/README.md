# Home (vitrine institucional)

Seções da página inicial, portadas do site original (`Front-Loja`) com as
regras abaixo.

## Regras de negócio e decisões

- **Fidelidade textual.** Os textos do hero e da grade de destaques são
  copiados verbatim do site que estava no ar — eles carregam a voz da marca
  ("Se encontrar um produto caro, reclame ;D"). Mudança de copy é decisão do
  dono, não refactor.
- **A faixa escura não é mais a inauguração.** O site original fazia contagem
  regressiva para 07/03/2026 e o componente devolvia `null` depois da data —
  desde março a seção renderizava um cartão de evento passado. `VisitBanner`
  mantém o visual (cartão laranja sobre faixa escura) com conteúdo perene:
  endereço e a promessa do preço máximo. **Pendência:** horário de
  funcionamento, que não existe em nenhum sistema; quando definido, entra no
  cartão de infos.
- **Carrossel pausa no hover e aceita swipe** — melhorias sobre o original,
  que só tinha autoplay de 5 s. A justificativa está no JSDoc de
  `hooks/useCarousel.ts`; o timer reinicia após interação manual para o
  autoplay não "roubar" o slide recém-escolhido.
- **Nenhuma imagem remota.** A textura da faixa escura era uma foto hotlinkada
  do Pixabay; aqui todas as imagens (7 fotos da loja + logo) saem do bundle.

## Fora do escopo desta feature

Dados de produto — a home não consulta a API. A única seção dinâmica em vista
(destaques do catálogo na home) entraria consumindo o hook da feature
`catalog`, nunca com query própria.
