import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Snowflake, LogIn, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/streak")({
  head: () => ({
    meta: [
      { title: "Your streak — Kikabila" },
      { name: "description", content: "Track your Kikabila daily streak, freezes and 30-day activity calendar." },
    ],
  }),
  component: StreakPage,
});

function StreakPage() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: profile } = useProfile(user?.id);

  // Load last 30 days of submissions to build calendar
  const activity = useQuery({
    queryKey: ["streak-activity", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 29);
      since.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("submissions")
        .select("created_at")
        .eq("user_id", user!.id)
        .gte("created_at", since.toISOString());
      if (error) throw error;
      // Build a Set of UTC date strings "YYYY-MM-DD"
      const played = new Set(
        (data ?? []).map((r) => r.created_at.slice(0, 10))
      );
      return played;
    },
  });

  if (!ready || (user && !profile)) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Flame size={28} className="animate-pulse text-primary" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <Flame size={40} className="mx-auto text-primary" />
        <h1 className="mt-4 font-display text-3xl text-primary">{t("streak.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("streak.signIn")}</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
          {t("nav.signIn")}
        </Link>
      </main>
    );
  }

  const streak = profile?.streak_current ?? 0;
  const longest = profile?.streak_longest ?? 0;
  const freezes = profile?.freeze_tokens ?? 0;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-display text-3xl text-primary">{t("streak.title")}</h1>

      {/* ── Hero flame ── */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col items-center gap-1 bg-gradient-to-b from-primary/10 to-transparent px-6 py-8">
          <Flame size={52} className="text-primary drop-shadow-lg" />
          <span className="font-display text-7xl leading-none text-primary tabular-nums">
            {streak}
          </span>
          <span className="text-sm uppercase tracking-widest text-muted-foreground">
            {t("streak.current")}
          </span>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
          <div className="flex flex-col items-center gap-0.5 px-4 py-4">
            <span className="font-display text-3xl text-primary tabular-nums">{longest}</span>
            <span className="text-center text-xs text-muted-foreground">{t("streak.longest")}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4 py-4">
            <div className="flex items-center gap-1.5">
              <Snowflake size={18} className="text-accent" />
              <span className="font-display text-3xl text-accent tabular-nums">{freezes}</span>
            </div>
            <span className="text-center text-xs text-muted-foreground">{t("streak.freezes")}</span>
          </div>
        </div>

        {/* ── Freeze hint ── */}
        {freezes > 0 && (
          <div className="border-t border-border/60 bg-accent/5 px-4 py-3">
            <p className="text-center text-xs text-muted-foreground">
              <Snowflake size={11} className="mr-1 inline text-accent" />
              {t("streak.freezeHint")}
            </p>
          </div>
        )}
      </Card>

      {/* ── 30-day calendar ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays size={16} className="text-accent" />
          <h2 className="font-display text-xl">{t("streak.calendar")}</h2>
        </div>

        <CalendarGrid played={activity.data ?? new Set()} loading={activity.isLoading} />

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary opacity-90" />
            {t("streak.played")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-muted" />
            {t("streak.missed")}
          </span>
        </div>
      </section>

      {/* ── Milestone tips ── */}
      <MilestoneTips streak={streak} />
    </main>
  );
}

// ── 30-day dot grid ──────────────────────────────────────────
function CalendarGrid({ played, loading }: { played: Set<string>; loading: boolean }) {
  // Build array of last 30 days in UTC
  const days: { date: string; label: string; dayOfWeek: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    days.push({ date: iso, label, dayOfWeek: d.getUTCDay() });
  }

  if (loading) {
    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map((_, i) => (
          <div key={i} className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const didPlay = played.has(d.date);
        const isToday = d.date === today;
        return (
          <div
            key={d.date}
            title={`${d.label}${didPlay ? " ✓" : ""}`}
            className={`aspect-square w-full rounded-lg transition-all ${
              isToday
                ? didPlay
                  ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "bg-muted/40 ring-2 ring-border ring-offset-2 ring-offset-background"
                : didPlay
                  ? "bg-primary opacity-90"
                  : "bg-muted/40"
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Milestone next-step hints ────────────────────────────────
const MILESTONES = [3, 7, 14, 30, 60, 100];

function MilestoneTips({ streak }: { streak: number }) {
  const next = MILESTONES.find((m) => m > streak);
  if (!next) return null;
  const pct = Math.round((streak / next) * 100);

  return (
    <Card className="mt-6 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Flame size={15} className="shrink-0 text-primary" />
          <span className="font-medium">{streak} → {next} {streak === 1 ? "day" : "days"}</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {next - streak} more {next - streak === 1 ? "day" : "days"} to reach a {next}-day streak
      </p>
    </Card>
  );
}
