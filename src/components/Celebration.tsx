import { useEffect, useMemo, useState } from "react";

type Burst = { id: number; label: string; sub?: string; tone: "xp" | "level" | "badge" | "goal" };

let seq = 0;
const listeners = new Set<(b: Burst) => void>();

/** Fire a celebration from anywhere: celebrate("+35 XP", "streak x4", "xp") */
export function celebrate(label: string, sub?: string, tone: Burst["tone"] = "xp") {
  const burst: Burst = { id: ++seq, label, sub, tone };
  listeners.forEach((l) => l(burst));
}

const PIECES = Array.from({ length: 28 }, (_, i) => i);

export function CelebrationLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onBurst = (b: Burst) => {
      setBursts((prev) => [...prev, b]);
      const ttl = b.tone === "xp" ? 1400 : 2600;
      setTimeout(() => setBursts((prev) => prev.filter((p) => p.id !== b.id)), ttl);
    };
    listeners.add(onBurst);
    return () => {
      listeners.delete(onBurst);
    };
  }, []);

  const confetti = useMemo(
    () =>
      PIECES.map((i) => ({
        i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 7) * 60}ms`,
        hue: i % 4,
      })),
    [],
  );

  if (!bursts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-live="polite">
      {bursts.map((b) => (
        <div key={b.id}>
          {b.tone !== "xp" && (
            <div className="absolute inset-0">
              {confetti.map((c) => (
                <span
                  key={c.i}
                  className={`confetti-piece confetti-hue-${c.hue}`}
                  style={{ left: c.left, animationDelay: c.delay }}
                />
              ))}
            </div>
          )}
          <div
            className={
              b.tone === "xp"
                ? "absolute left-1/2 top-1/3 -translate-x-1/2 animate-xp-float font-display text-4xl text-primary drop-shadow"
                : "absolute left-1/2 top-1/4 w-[min(22rem,90vw)] -translate-x-1/2 animate-trophy-pop rounded-3xl border border-primary/40 bg-card/95 px-6 py-5 text-center shadow-2xl backdrop-blur"
            }
          >
            <p className={b.tone === "xp" ? "" : "font-display text-3xl text-primary"}>{b.label}</p>
            {b.sub && (
              <p className="mt-1 text-sm text-muted-foreground">{b.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
