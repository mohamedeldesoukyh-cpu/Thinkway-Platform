"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function CommercialReveal({children, className = ''}: {children: ReactNode; className?: string}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      el.animate([{opacity: 0, transform: 'translateY(14px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 350, easing: 'cubic-bezier(.2,.7,.3,1)'});
      el.querySelectorAll('.cm-track > span').forEach(bar => bar.animate([{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)'}));
      observer.disconnect();
    }, {threshold: .12});
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
export function CommercialCount({value, format}: {value: number; format?: (value: number) => string}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [animated, setAnimated] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 900);
        setAnimated(p === 1 ? null : value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, {threshold: .12});
    observer.observe(el);
    return () => {observer.disconnect(); cancelAnimationFrame(frame);};
  }, [value]);
  const label = (n: number) => format ? format(n) : String(Math.round(n));
  return <span ref={ref} aria-label={label(value)}><span aria-hidden="true">{label(animated ?? value)}</span></span>;
}
export function CommercialViewIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
}
