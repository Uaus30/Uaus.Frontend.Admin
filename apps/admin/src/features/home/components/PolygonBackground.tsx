import { useEffect, useRef } from "react";
import { polygonColorAt } from "../polygon-palette";

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/** Quanto o ponto anda, no máximo, em cada eixo a cada quadro de 60 Hz (px). */
const MAX_SPEED = 0.28;

/** A duração de um quadro de 60 Hz (ms) — a unidade da velocidade e o teto de quadros. */
const FRAME_MS = 1000 / 60;

/**
 * Malha de polígonos em movimento atrás dos botões da tela inicial (pedido do
 * dono, 24/10/2026) — a mesma ideia da tela de entrada do Prisma: pontos que
 * vagam devagar, ligados por linhas quando se aproximam, e o triângulo de cada
 * ponto com os dois vizinhos mais próximos preenchido de leve.
 *
 * É enfeite, e enfeite não pode custar o que a tela existe para dar — o primeiro
 * toque rápido no celular:
 *
 * - **Pausa com a aba oculta**, e **vira imagem parada** se o aparelho pede menos
 *   movimento (`prefers-reduced-motion`), como a contagem dos cards da
 *   Fidelidade.
 * - **Densidade pela área, com teto** (26 a 70 pontos): a conta é de pares, e
 *   num monitor grande sem teto ela cresceria ao quadrado.
 * - **Movimento pelo relógio, no máximo 60 quadros por segundo.** O original do
 *   Prisma anda "um passo por quadro": numa tela de 120 Hz (medido no painel do
 *   app, 24/10/2026) a malha corria no dobro da velocidade e desenhava o dobro
 *   de vezes, para um enfeite que a 60 já é liso.
 * - **Não derruba a tela.** Sem canvas 2D (`getContext` nulo) ou sem
 *   `ResizeObserver` (navegador antigo), desenha o que der e para; a tela
 *   inicial é o destino do "Início" da tela de erro, e ali não pode haver o que
 *   cair de novo.
 */
export function PolygonBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let frame = 0;
    let visible = !document.hidden;

    const linkDistance = () => Math.min(190, Math.max(120, width * 0.16));

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;

      // Medido antes do layout, o canvas ainda é 0x0: não há onde espalhar os
      // pontos. O ResizeObserver chama de novo quando o elemento ganha tamanho.
      if (width === 0 || height === 0) {
        points = [];
        return;
      }

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(70, Math.max(26, (width * height) / 22000)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * MAX_SPEED,
        vy: (Math.random() - 0.5) * MAX_SPEED,
        radius: 1 + Math.random() * 1.6,
      }));
    }

    function draw() {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      const limit = linkDistance();

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const neighbors: number[] = [];

        for (let j = i + 1; j < points.length; j++) {
          const q = points[j];
          const distance = Math.hypot(p.x - q.x, p.y - q.y);
          if (distance > limit) continue;

          neighbors.push(j);
          const strength = 1 - distance / limit;
          const [r, g, b] = polygonColorAt((p.x + q.x) / 2 / width);
          ctx.strokeStyle = `rgba(${r},${g},${b},${strength * 0.36})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }

        const [r, g, b] = polygonColorAt(p.x / width);

        // O "polígono": o triângulo do ponto com os dois primeiros vizinhos ligados.
        if (neighbors.length >= 2) {
          const a = points[neighbors[0]];
          const c = points[neighbors[1]];
          ctx.fillStyle = `rgba(${r},${g},${b},0.06)`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function move(steps: number) {
      for (const p of points) {
        p.x += p.vx * steps;
        p.y += p.vy * steps;
        // Quem sai por uma borda volta pela oposta, 20px fora da vista, para
        // não "brotar" no meio da tela.
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
    }

    let lastTime: number | null = null;

    function step(now: number) {
      if (!visible) {
        lastTime = null;
      } else if (lastTime === null) {
        lastTime = now;
      } else if (now - lastTime >= FRAME_MS - 1) {
        // A folga de 1 ms absorve o tremor do relógio: sem ela, um quadro de
        // 60 Hz medido em 16,6 ms seria pulado. Depois de uma pausa (aparelho
        // que travou), anda no máximo três passos em vez de saltar a malha.
        move(Math.min((now - lastTime) / FRAME_MS, 3));
        lastTime = now;
        draw();
      }
      // Pede o próximo quadro só no fim: se o desenho quebrar, a animação para
      // em vez de repetir o erro sessenta vezes por segundo no console.
      frame = window.requestAnimationFrame(step);
    }

    function onVisibilityChange() {
      visible = !document.hidden;
    }

    function redraw() {
      resize();
      draw();
    }

    redraw();

    const animate = !reducedMotion && typeof window.requestAnimationFrame === "function";
    if (animate) {
      frame = window.requestAnimationFrame(step);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(redraw);
    observer?.observe(canvas);

    return () => {
      if (animate) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="polygon-background"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
