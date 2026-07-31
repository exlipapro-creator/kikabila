import { Flame, Gem, ShieldCheck, Snowflake, Target, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { levelFromXp, rankTitle } from "@/lib/gamification";
import { useT } from "@/lib/i18n";

type Profile = {
  display_name: string | null;
  xp: number | null;
  trust_score: number | null;
  streak_current: number | null;
  daily_goal: number | null;
  freeze_tokens: number | null;
  gems: number | null;
};

export function LevelRing({ pct, level }: { pct: number; level: number }) {
  return (
    <div
      className="level-ring"
      style={{ ["--ring-pct" as string]: `${Math.max(2, Math.min(100, pct))}%` }}
    >
      <div className="level-ring-core">
        <span className="font-display text-2xl leading-none text-primary">{level}</span>
      </div>
    </div>
  );
}

export function PlayerHud({
  profile,
  todayCount,
  rank,
  onUseFreeze,
  freezeBusy,
}: {
  profile?: Profile | null;
  todayCount: number;
  rank?: number;
  onUseFreeze?: () => void;
  freezeBusy?: boolean;
}) {
  const { t } = useT();
  const xp = profile?.xp ?? 0;
  const lvl = levelFromXp(xp);
  const goal = profile?.daily_goal ?? 10;
  const goalPct = Math.min(100, (todayCount / goal) * 100);
  const goalDone = todayCount >= goal;

  return (
    <Card className="hud-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <LevelRing pct={lvl.pct} level={lvl.level} />

        <div className="min-w-[10rem] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl">
              {profile?.display_name ?? t("play.player")}
            </span>
            <span className="rank-chip">{rankTitle(lvl.level)}</span>
          </div>
          <Progress value={lvl.pct} className="mt-2 h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {xp} XP · {lvl.remaining} {t("play.xpToLevel")} {lvl.level + 1}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Stat icon={<Flame size={16} />} value={profile?.streak_current ?? 0} label={t("play.streak")} tone="primary" />
          <Stat icon={<Gem size={16} />} value={profile?.gems ?? 0} label={t("hud.gems")} tone="accent" />
          <Stat
            icon={<ShieldCheck size={16} />}
            value={Math.round(Number(profile?.trust_score ?? 50))}
            label={t("play.trust")}
            tone="accent"
          />
          {typeof rank === "number" && (
            <Stat icon={<Trophy size={16} />} value={`#${rank}`} label={t("hud.rank")} tone="primary" />
          )}
        </div>
      </div>

      <div className={`daily-strip ${goalDone ? "daily-strip-done" : ""}`}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <Target size={14} /> {t("play.dailyGoal")}
          </span>
          <span className="text-muted-foreground">
            {Math.min(todayCount, goal)}/{goal} {t("play.words")}
            {goalDone ? t("play.streakSafe") : ""}
          </span>
        </div>
        <Progress value={goalPct} className="mt-2 h-1.5" />
        {onUseFreeze && (profile?.freeze_tokens ?? 0) > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Snowflake size={14} className="text-accent" />
              {profile?.freeze_tokens} {t("hud.freeze")}
            </span>
            <Button size="sm" variant="secondary" disabled={freezeBusy} onClick={onUseFreeze}>
              {t("hud.useFreeze")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone: "primary" | "accent";
}) {
  return (
    <div className="text-center">
      <div
        className={`flex items-center gap-1 ${tone === "primary" ? "text-primary" : "text-accent"}`}
      >
        {icon}
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
