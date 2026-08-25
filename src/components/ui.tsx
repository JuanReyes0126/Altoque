import type { ReactNode } from "react";
import { Reveal } from "../lib/anim";

export const TONES: Record<string, { text: string; border: string; bg: string; dot: string; solid: string }> = {
  azul: { text: "text-azul", border: "border-azul/40", bg: "bg-azul/10", dot: "bg-azul", solid: "bg-azul text-ink" },
  jade: { text: "text-jade", border: "border-jade/40", bg: "bg-jade/10", dot: "bg-jade", solid: "bg-jade text-ink" },
  amber: { text: "text-amber", border: "border-amber/40", bg: "bg-amber/10", dot: "bg-amber", solid: "bg-amber text-ink" },
  flama: { text: "text-flama", border: "border-flama/40", bg: "bg-flama/10", dot: "bg-flama", solid: "bg-flama text-ink" },
  dim: { text: "text-dim", border: "border-line", bg: "bg-panel/60", dot: "bg-faint", solid: "bg-faint text-ink" },
};

export function Section({
  id, num, kicker, title, intro, children, wide = false,
}: {
  id: string; num: string; kicker: string; title: ReactNode; intro?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  return (
    <section id={id} className={`relative scroll-mt-24 ${wide ? "" : ""}`}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-20 sm:pt-28 pb-4">
        <Reveal>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-xs sm:text-sm tracking-[0.3em] text-flama">{num}</span>
            <span className="h-px flex-1 bg-line" />
            <span className="chip">{kicker}</span>
          </div>
          <h2 className="mt-5 font-display font-extrabold tracking-tight text-[clamp(1.9rem,4.6vw,3.4rem)] leading-[1.02] max-w-3xl">
            {title}
          </h2>
          {intro && <p className="mt-5 max-w-2xl text-dim text-base sm:text-lg leading-relaxed">{intro}</p>}
        </Reveal>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

export function Stars({ n = 5, size = "w-3.5 h-3.5", className = "" }: { n?: number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={`${size} ${i <= n ? "text-amber" : "text-faint/40"}`} fill="currentColor">
          <path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8L12 3.2Z" />
        </svg>
      ))}
    </span>
  );
}

export function Dot({ className = "bg-jade", pulse = false }: { className?: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2">
      {pulse && <span className={`absolute inset-0 rounded-full ${className} animate-pulse-dot`} />}
      <span className={`relative rounded-full w-2 h-2 ${className}`} />
    </span>
  );
}

export function Avatar({ initials, tone = "bg-panel2 text-azul", className = "w-10 h-10 text-xs" }: { initials: string; tone?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg font-mono font-bold tracking-wider ${tone} ${className}`}>
      {initials}
    </span>
  );
}
