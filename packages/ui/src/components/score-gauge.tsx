import * as React from "react";

/**
 * O medidor de uma nota de 0 a 100.
 *
 * Mora no `packages/ui` porque duas telas o usam — o desempenho do produto e o
 * da promoção relâmpago — e feature não importa de feature (CLAUDE.md §6). Ele
 * é visual puro: não conhece regra de domínio nenhuma, e é por isso que a
 * palavra da faixa entra por prop em vez de sair de um corte escrito aqui.
 *
 * <b>A geometria e o estilo vêm do velocímetro do Prisma</b>
 * (`app/src/componentes/graficos/Velocimetro.tsx`), a pedido do dono: trilha em
 * degradê apagado, trecho aceso com brilho, marcas das faixas e um marcador que
 * corre POR CIMA do arco.
 *
 * O marcador correndo sobre a escala, e não uma agulha presa no centro, é a
 * decisão que mais importa e ela é do Prisma: a agulha clássica risca o número
 * — em 58 ela passa exatamente por cima dos dois dígitos, e encurtá-la só
 * empurra o problema para as pontas, onde bate na palavra. O marcador aponta com
 * a mesma precisão e deixa o miolo inteiro para a leitura.
 *
 * <b>SVG puro, sem Recharts</b>: um arco e um marcador não justificam a
 * biblioteca de gráficos, e este componente abre junto com a aba.
 *
 * A escala de cor é a do Prisma — vermelho no zero, âmbar no meio, verde no cem,
 * interpolada. Ela não tenta dizer a FAIXA do produto; quem diz é a palavra
 * dentro do arco, que vem dos cortes do backend (40 e 70). Fosse a cor a afirmar
 * a faixa, ela teria que saltar nos cortes, e o medidor perderia o degradê que o
 * torna legível de relance.
 */

const CX = 100;
const CY = 100;
const RAIO = 78;
const ESPESSURA = 13;

/** Ângulo do zero, em graus de círculo trigonométrico (0° à direita, cresce à esquerda). */
const INICIO = 210;

/** Quanto o mostrador varre daí para a direita, no sentido horário. */
const VARRIDA = 240;

const COMPRIMENTO = RAIO * VARRIDA * (Math.PI / 180);

function ponto(raio: number, angulo: number): [number, number] {
  const rad = (angulo * Math.PI) / 180;
  // O y é invertido: em tela ele cresce para baixo, no círculo trigonométrico não.
  return [CX + raio * Math.cos(rad), CY - raio * Math.sin(rad)];
}

function arco(raio: number, de: number, ate: number): string {
  const [x1, y1] = ponto(raio, de);
  const [x2, y2] = ponto(raio, ate);
  const grande = Math.abs(ate - de) > 180 ? 1 : 0;
  // Varredura 1 = horário na tela, que é o sentido em que o ângulo diminui.
  return `M ${x1} ${y1} A ${raio} ${raio} 0 ${grande} 1 ${x2} ${y2}`;
}

/**
 * Vermelho no zero, âmbar no meio, verde no cem — interpolado, para o marcador
 * mudar de cor junto com o número em vez de saltar de faixa em faixa.
 *
 * A cor é contínua e não tenta dizer a FAIXA: quem diz é a palavra dentro do
 * arco ("Parado", "Regular", "Destaque"), que sai dos cortes do backend. Fosse a
 * cor a afirmar a faixa, ela teria que saltar nos cortes, e o medidor perderia
 * exatamente o que o torna legível de relance.
 */
const PARADAS: { em: number; cor: [number, number, number] }[] = [
  { em: 0, cor: [248, 113, 113] },
  { em: 50, cor: [251, 191, 36] },
  { em: 100, cor: [52, 211, 153] },
];

function corDaNota(nota: number): string {
  const paradas = PARADAS;
  const p = Math.min(100, Math.max(0, nota));
  const fim = paradas.find((parada) => p <= parada.em) ?? paradas[paradas.length - 1];
  const i = paradas.indexOf(fim);
  if (i <= 0) return `rgb(${fim.cor.join(" ")})`;

  const inicio = paradas[i - 1];
  const t = fim.em === inicio.em ? 0 : (p - inicio.em) / (fim.em - inicio.em);
  const canal = (n: 0 | 1 | 2) => Math.round(inicio.cor[n] + (fim.cor[n] - inicio.cor[n]) * t);

  return `rgb(${canal(0)} ${canal(1)} ${canal(2)})`;
}

type ScoreGaugeProps = {
  /** A nota, de 0 a 100. */
  score: number;
  /**
   * A palavra que traduz o número — vai abaixo dele, dentro do arco.
   *
   * É ela, e não a cor, que afirma a FAIXA do produto: ela vem dos cortes do
   * backend (40 e 70), enquanto o degradê é contínuo. Sem a palavra, o medidor
   * mostra uma cor bonita e nenhum juízo.
   */
  rotulo?: string;
  tamanho?: number;
  /**
   * Casas decimais do número no miolo.
   *
   * Uma por padrão, que é o do produto: ela existe para desempatar dois rankings
   * de 888 itens. A promoção passa zero — algumas dezenas por ano não são
   * ordenadas por nota, e a decimal só sugeriria uma precisão que a medida não
   * tem.
   */
  casasDecimais?: 0 | 1;
};

export function ScoreGauge({ score, rotulo, tamanho = 260, casasDecimais = 1 }: ScoreGaugeProps) {
  const id = React.useId();
  const alvo = Math.min(100, Math.max(0, score));

  /**
   * O marcador sai do zero e caminha até a nota.
   *
   * <b>O disparo é `setTimeout`, e não `requestAnimationFrame`</b> como no
   * Prisma: o navegador embutido do app não roda `rAF` nem com a aba visível, e
   * ali o medidor ficaria parado em zero para sempre — não apenas sem animação,
   * mas mostrando o número errado. O `setTimeout` sempre dispara, então o valor
   * final está certo em qualquer navegador; onde as transições funcionam, ele
   * chega andando.
   */
  const [animado, setAnimado] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimado(alvo), 0);
    return () => clearTimeout(t);
  }, [alvo]);

  const cor = corDaNota(alvo);
  const transicao = "cubic-bezier(0.22, 1, 0.36, 1)";

  const nota = alvo.toLocaleString("pt-BR", {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  });

  return (
    <svg
      viewBox="0 0 200 150"
      width={tamanho}
      height={tamanho * 0.75}
      role="img"
      aria-label={`Nota ${nota} de 100${rotulo ? ` — ${rotulo}` : ""}`}
      className="max-w-full"
    >
      <defs>
        {/* Vermelho no zero, âmbar no meio, verde no cem — o degradê do Prisma. */}
        <linearGradient id={`${id}-escala`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        <filter id={`${id}-brilho`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="borrado" />
          <feMerge>
            <feMergeNode in="borrado" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Trilha: a escala inteira, apagada, para o valor ter contra o que se medir. */}
      <path
        d={arco(RAIO, INICIO, INICIO - VARRIDA)}
        fill="none"
        stroke={`url(#${id}-escala)`}
        strokeWidth={ESPESSURA}
        strokeLinecap="round"
        opacity={0.16}
      />

      {/* O trecho percorrido, aceso e com brilho. */}
      <path
        d={arco(RAIO, INICIO, INICIO - VARRIDA)}
        fill="none"
        stroke={`url(#${id}-escala)`}
        strokeWidth={ESPESSURA}
        strokeLinecap="round"
        filter={`url(#${id}-brilho)`}
        strokeDasharray={COMPRIMENTO}
        strokeDashoffset={COMPRIMENTO * (1 - animado / 100)}
        style={{ transition: `stroke-dashoffset 1100ms ${transicao}` }}
      />

      {/* As cinco divisões da escala, por dentro da trilha — como no Prisma. */}
      {[20, 40, 60, 80].map((marca) => {
        const angulo = INICIO - VARRIDA * (marca / 100);
        const [x1, y1] = ponto(RAIO - ESPESSURA / 2 - 4, angulo);
        const [x2, y2] = ponto(RAIO - ESPESSURA / 2 - 10, angulo);
        return (
          <line
            key={marca}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#2c3d63"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}

      {/* O marcador corre por cima da escala — ver o comentário do topo. */}
      <g
        style={{
          transform: `rotate(${(VARRIDA * animado) / 100}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: `transform 1100ms ${transicao}`,
        }}
      >
        <circle
          cx={ponto(RAIO, INICIO)[0]}
          cy={ponto(RAIO, INICIO)[1]}
          r={ESPESSURA / 2 + 1.5}
          fill="hsl(var(--background))"
          stroke={cor}
          strokeWidth={3.5}
          style={{ transition: `stroke 1100ms ${transicao}` }}
        />
      </g>

      {/* Uma casa decimal custa dois caracteres: "100,0" não cabe no corpo 46 do
          Prisma, que nasceu para "100". O tamanho cede, o número continua exato. */}
      <text
        x={CX}
        y={CY - 2}
        textAnchor="middle"
        fill={cor}
        style={{
          fontSize: alvo >= 100 && casasDecimais > 0 ? 38 : 46,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {nota}
      </text>

      <text
        x={CX}
        y={CY + 17}
        textAnchor="middle"
        fill="#64748b"
        style={{ fontSize: 11, letterSpacing: "0.14em" }}
      >
        DE 100
      </text>

      {rotulo && (
        <text
          x={CX}
          y={CY + 42}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          style={{ fontSize: 17, fontWeight: 600 }}
        >
          {rotulo}
        </text>
      )}
    </svg>
  );
}
