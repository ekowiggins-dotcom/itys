"use client";

import { useEffect } from "react";
import { haptic } from "../NativeBridge";

const COLORS = ["#d7f25a", "#ff8a5b", "#7cc0ff", "#b9a2ff", "#5fdda6", "#ffc94d", "#ff8ec2"];

/** A short burst of confetti from the top of the screen, drawn on a throwaway canvas. */
function confetti() {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.6,
    y: -20 - Math.random() * 120,
    vx: (Math.random() - 0.5) * 7,
    vy: 2 + Math.random() * 5,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 1400) / 600);
    for (const p of pieces) {
      p.vy += 0.12;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < 2000) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/**
 * Celebrates a call you got right, once per call on this device, when its card scrolls into view: the stamp
 * thumps in, confetti falls, and the app gives a success haptic. "Seen" is remembered in localStorage (a
 * per-device convenience; without it nothing celebrates). With reduced motion there's no animation or confetti.
 */
export function Celebrate({ id }: { id: string }) {
  useEffect(() => {
    const key = `wholl.celebrated.${id}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return; // no storage: skip rather than celebrate on every visit
    }
    const card = document.getElementById(`call-${id}`);
    if (!card) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        try {
          localStorage.setItem(key, "1");
        } catch {
          // ignore
        }
        void haptic("success");
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        card.classList.add("celebrate");
        confetti();
      },
      { threshold: 0.6 },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [id]);
  return null;
}
