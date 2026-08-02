import { Check, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/lib/gamification";
import { useT } from "@/lib/i18n";

export function QuestBoard({ quests }: { quests: Quest[] }) {
  const { t } = useT();
  const allDone = quests.length > 0 && quests.every((q) => q.progress >= q.target);
  return (
    <Card className={`p-4 transition-colors duration-500 ${allDone ? "quest-board-done" : ""}`}>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className={allDone ? "text-primary" : "text-accent"} />
        <h2 className="font-display text-xl">{t("quest.title")}</h2>
        {allDone && <span className="ml-auto text-xs font-medium text-accent">✓ {t("quest.allDone")}</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("quest.body")}</p>
      <ul className="mt-4 space-y-3">
        {quests.map((q) => {
          const done = q.progress >= q.target;
          return (
            <li key={q.id} className={`quest-row ${done ? "quest-row-done" : ""}`}>
              <span className={`quest-tick ${done ? "quest-tick-done" : ""}`}>
                {done ? <Check size={12} /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={done ? "line-through opacity-70" : ""}>{q.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {done ? t("quest.done") : `${Math.min(q.progress, q.target)}/${q.target}`}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (q.progress / q.target) * 100)}
                  className="mt-1.5 h-1"
                />
              </div>
              <span className="shrink-0 text-xs font-medium text-primary">+{q.reward}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
