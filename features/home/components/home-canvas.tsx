"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
};

const DARK_COLORS = [
  "rgba(129,140,248,.6)",
  "rgba(196,132,252,.5)",
  "rgba(52,211,153,.4)",
  "rgba(251,191,36,.4)",
  "rgba(244,114,182,.5)",
];

const LIGHT_COLORS = [
  "rgba(0,87,255,.35)",
  "rgba(26,111,255,.3)",
  "rgba(61,139,255,.3)",
  "rgba(0,72,221,.25)",
  "rgba(0,87,255,.2)",
];

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function HomeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const particles: Particle[] = Array.from({ length: 55 }, () => {
      const palette = isDarkTheme() ? DARK_COLORS : LIGHT_COLORS;
      return {
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        r: 1 + Math.random() * 1.8,
        c: palette[Math.floor(Math.random() * palette.length)]!,
      };
    });

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      mouseX = width / 2;
      mouseY = height / 2;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };

    const draw = () => {
      const dark = isDarkTheme();
      const palette = dark ? DARK_COLORS : LIGHT_COLORS;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]!;
        const ax = particle.x * width;
        const ay = particle.y * height;

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j]!;
          const bx = other.x * width;
          const by = other.y * height;
          const distance = Math.hypot(ax - bx, ay - by);

          if (distance < 120) {
            ctx.strokeStyle = dark
              ? `rgba(255,255,255,${0.04 * (1 - distance / 120)})`
              : `rgba(0,87,255,${0.08 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }

        const mdx = mouseX - ax;
        const mdy = mouseY - ay;
        const md = Math.hypot(mdx, mdy);
        if (md < 150) {
          particle.vx += (mdx / md) * 0.00008;
          particle.vy += (mdy / md) * 0.00008;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
        if (particle.y < 0 || particle.y > 1) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(ax, ay, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = particle.c || palette[i % palette.length]!;
        ctx.fill();
      }

      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="platform-v6-hs-canvas"
      aria-hidden
    />
  );
}
