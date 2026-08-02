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
      className="level-ring shrink-0"
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
    <Card className="hud-card hud-aurora overflow-visible p-0">
      <div className="flex items-start gap-3 p-4">
        {/* Level ring */}
        <LevelRing pct={lvl.pct} level={lvl.level} />

        {/* Name + XP bar */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-xl sm:text-2xl leading-tight">
              {profile?.display_name ?? t("play.player")}
            </span>
            <span className="rank-chip shrink-0">{rankTitle(lvl.level)}</span>
          </div>
          <Progress value={lvl.pct} className="mt-2 h-2" />
          {/* XP on one line — no wrapping */}
          <p className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
            {xp} XP · {lvl.remaining} {t("play.xpToLevel")} {lvl.level + 1}
          </p>
        </div>

        {/* Stats — 2×2 on mobile, row on sm+ */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:items-center sm:gap-3">
          <Stat icon={<Flame size={15} />} value={profile?.streak_current ?? 0} label={t("play.streak")} tone="primary" />
          <Stat icon={<Gem size={15} />} value={profile?.gems ?? 0} label={t("hud.gems")} tone="accent" />
          <Stat
            icon={<ShieldCheck size={15} />}
            value={Math.round(Number(profile?.trust_score ?? 50))}
            label={t("play.trust")}
            tone="accent"
          />
          {typeof rank === "number" && (
            <Stat icon={<Trophy size={15} />} value={`#${rank}`} label={t("hud.rank")} tone="primary" />
          )}
        </div>
      </div>

      <div className={`daily-strip ${goalDone ? "daily-strip-done" : ""}`}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <Target size={13} /> {t("play.dailyGoal")}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {Math.min(todayCount, goal)}/{goal} {t("play.words")}
            {goalDone ? t("play.streakSafe") : ""}
          </span>
        </div>
        <Progress value={goalPct} className="mt-2 h-1.5" />
        {onUseFreeze && (profile?.freeze_tokens ?? 0) > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Snowflake size={13} className="text-accent" />
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
      <div className={`flex items-center justify-center gap-1 ${tone === "primary" ? "text-primary" : "text-accent"}`}>
        {icon}
        <span className="font-semibold tabular-nums text-sm">{value}</span>
      </div>
      <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground leading-none">{label}</span>
    </div>
  );
}
