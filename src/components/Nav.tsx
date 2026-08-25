import { useEffect, useState } from "react";
import { NAV } from "../data/blueprint";
import { useActiveSection } from "../lib/anim";
import { Icon } from "./icons";

const IDS = NAV.map((n) => n.id);

export default function Nav({ approved }: { approved: boolean }) {
  const active = useActiveSection(IDS);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0);
      setScrolled(h.scrollTop > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-500 ${scrolled ? "bg-ink/90 backdrop-blur-md border-b border-line" : "bg-transparent"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex items-center justify-between h-14">
          <a href="#top" className="flex items-center gap-2.5 group" aria-label="AlToque blueprint — inicio">
            <span className="w-7 h-7 rounded-md bg-flama text-ink grid place-items-center transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
              <Icon name="bolt" className="w-4 h-4" strokeWidth={2.2} />
            </span>
            <span className="font-display font-extrabold tracking-tight text-sm leading-none">
              ALTOQUE<span className="text-flama">·</span>RD
              <span className="block font-mono font-medium text-[0.55rem] tracking-[0.28em] text-dim mt-0.5">BLUEPRINT V1</span>
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-0.5">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`px-2.5 py-1.5 font-mono text-[0.62rem] tracking-wider transition-all duration-300 border-b-2 ${
                  active === n.id ? "text-paper border-flama" : "text-dim border-transparent hover:text-paper hover:border-line"
                }`}
              >
                <span className={active === n.id ? "text-flama" : "text-faint"}>{n.num}</span> {n.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className={`chip hidden sm:inline-flex items-center gap-1.5 transition-colors ${approved ? "!text-jade !border-jade/50" : ""}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${approved ? "bg-jade" : "bg-amber animate-pulse-dot"}`} />
              {approved ? "Aprobado" : "Para aprobación"}
            </span>
            <span className="chip hidden md:inline">19.45°N · 70.69°O</span>
          </div>
        </div>
      </div>

      {/* mobile section rail */}
      <div className="lg:hidden overflow-x-auto no-scrollbar border-t border-linesoft bg-ink/80 backdrop-blur">
        <div className="flex gap-1 px-3 py-1.5 w-max">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={`px-2.5 py-1 rounded font-mono text-[0.6rem] tracking-wider whitespace-nowrap transition-colors ${
                active === n.id ? "bg-flama text-ink font-bold" : "text-dim border border-linesoft"
              }`}
            >
              {n.num}·{n.label}
            </a>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] bg-flama transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </header>
  );
}
