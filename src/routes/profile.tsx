import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/use-auth";
import { levelFromXp, rankTitle, useBadges, usePlayerStats, useUserBadges } from "@/lib/gamification";
import { BadgeGrid } from "@/components/BadgeGrid";
import { LevelRing } from "@/components/PlayerHud";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your trophy shelf — Kikabila" },
      {
        name: "description",
        content:
          "Track your Kikabila level, streak, badges and lifetime contributions to the Tanzanian language corpus.",
      },
      { property: "og:title", content: "Your trophy shelf — Kikabila" },
      {
        property: "og:description",
        content: "Levels, badges, streaks and lifetime stats for your language contributions.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: profile } = useProfile(user?.id);
  const stats = usePlayerStats(user?.id);
  const badges = useBadges();
  const mine = useUserBadges(user?.id);

  const xpFeed = useQuery({
    queryKey: ["xp-feed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xp_events")
        .select("id, amount, reason, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!ready) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-primary">{t("profile.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("profile.signIn")}</p>
      </main>
    );
  }

  const lvl = levelFromXp(profile?.xp ?? 0);
  const earned = new Set((mine.data ?? []).map((b) => b.badge_code));
  const s = stats.data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <LevelRing pct={lvl.pct} level={lvl.level} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-primary sm:text-3xl">
            {profile?.display_name ?? t("play.player")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rankTitle(lvl.level)} · {profile?.xp ?? 0} XP · {t("hud.rank")} #{s?.rank ?? "—"}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-4 text-center sm:w-auto">
          <Metric value={profile?.streak_current ?? 0} label={t("play.streak")} />
          <Metric value={profile?.streak_longest ?? 0} label={t("profile.longest")} />
          <Metric value={earned.size} label={t("profile.badges")} />
        </div>
      </Card>

      <section className="mt-8">
        <h2 className="font-display text-2xl">{t("profile.stats")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard value={s?.total_words ?? 0} label={t("profile.words")} />
          <StatCard value={s?.notes ?? 0} label={t("profile.notesStat")} />
          <StatCard value={s?.languages ?? 0} label={t("profile.langsStat")} />
          <StatCard value={s?.agreed ?? 0} label={t("profile.agreed")} />
          <StatCard value={s?.verified ?? 0} label={t("profile.verifiedStat")} />
          <StatCard value={s?.week_xp ?? 0} label={t("profile.weekXp")} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("profile.badges")}</h2>
        <div className="mt-3">
          {badges.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <BadgeGrid
              badges={badges.data ?? []}
              earned={earned}
              lockedLabel={t("profile.locked")}
            />
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("profile.recent")}</h2>
        <ul className="mt-3 space-y-2">
          {(xpFeed.data ?? []).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate text-muted-foreground">{e.reason}</span>
              <span className="shrink-0 font-medium text-primary">+{e.amount} XP</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl text-primary tabular-nums">{value}</p>
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card className="p-4">
      <p className="font-display text-3xl text-primary tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
