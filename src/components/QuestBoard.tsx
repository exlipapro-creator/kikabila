import { Check, Sparkles, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/lib/gamification";
import { useT } from "@/lib/i18n";

export function QuestBoard({ quests }: { quests: Quest[] }) {
  const { t } = useT();
  const allDone = quests.length > 0 && quests.every((q) => q.progress >= q.target);
  const doneCount = quests.filter((q) => q.progress >= q.target).length;

  return (
    <Card className={`overflow-hidden p-0 transition-colors duration-500 ${allDone ? "quest-board-done" : ""}`}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
        <Sparkles size={15} className={`shrink-0 ${allDone ? "text-primary" : "text-accent"}`} />
        <div className="flex-1">
          <h2 className="font-display text-lg leading-tight">{t("quest.title")}</h2>
          <p className="text-[0.65rem] text-muted-foreground">{t("quest.body")}</p>
        </div>
        {/* Progress pill */}
        <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
          allDone
            ? "bg-accent/20 text-accent"
            : "bg-secondary text-muted-foreground"
        }`}>
          {doneCount}/{quests.length}
        </div>
      </div>

      {/* ── Quest rows ── */}
      <ul className="divide-y divide-border/30">
        {quests.map((q) => {
          const done = q.progress >= q.target;
          const pct = Math.min(100, (q.progress / q.target) * 100);

          return (
            <li
              key={q.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors duration-300 ${
                done ? "bg-accent/5" : ""
              }`}
            >
              {/* Tick */}
              <span
                className={`quest-tick shrink-0 ${done ? "quest-tick-done" : ""}`}
                aria-label={done ? t("quest.done") : ""}
              >
                {done && <Check size={11} />}
              </span>

              {/* Label + bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm leading-snug ${
                      done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {q.label}
                  </span>
                  <span className={`shrink-0 tabular-nums text-xs ${
                    done ? "text-accent font-medium" : "text-muted-foreground"
                  }`}>
                    {done ? t("quest.done") : `${Math.min(q.progress, q.target)}/${q.target}`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      done
                        ? "bg-accent"
                        : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* XP reward badge */}
              <span
                className={`quest-xp-badge shrink-0 ${done ? "quest-xp-badge-done" : ""}`}
              >
                <Zap size={9} className="shrink-0" />
                +{q.reward}
              </span>
            </li>
          );
        })}
      </ul>

    </Card>
  );
}
