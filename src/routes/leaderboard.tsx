import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Flame, Loader2, LogIn, Trophy, Medal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { usePlayerStats } from "@/lib/gamification";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Kikabila" },
      { name: "description", content: "Top Kikabila contributors ranked by XP, streaks and trust score." },
      { property: "og:title", content: "Leaderboard — Kikabila" },
    ],
  }),
  component: Leaderboard,
});

type LeaderboardRow = {
  id: string;
  display_name: string | null;
  xp: number;
  trust_score: number | null;
  streak_current: number | null;
};

type RpcLeaderboard = Database["public"]["Functions"]["leaderboard"]["Returns"][number];
type RpcWeekly = Database["public"]["Functions"]["weekly_league"]["Returns"][number];

// ── Tier thresholds (week XP) ─────────────────────────────────
const TIERS = [
  { key: "board.tierBronze", min: 0,   max: 199,  color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/40" },
  { key: "board.tierSilver", min: 200,  max: 499,  color: "text-slate-300",   bg: "bg-slate-300/10",   border: "border-slate-300/40" },
  { key: "board.tierGold",   min: 500,  max: 999,  color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/40" },
  { key: "board.tierLegend", min: 1000, max: Infinity, color: "text-accent", bg: "bg-accent/10",  border: "border-accent/40" },
] as const;

function getTier(xp: number) {
  return TIERS.find((t) => xp >= t.min && xp <= t.max) ?? TIERS[0];
}

// ── Week reset countdown ──────────────────────────────────────
function useWeekResets() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      // Next Monday 00:00 UTC
      const day = now.getUTCDay(); // 0=Sun
      const daysUntilMon = day === 0 ? 1 : 8 - day;
      const next = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMon
      ));
      const diff = next.getTime() - now.getTime();
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);
  return label;
}

// ── Tier card ────────────────────────────────────────────────
function TierCard({ weekXp }: { weekXp: number }) {
  const { t } = useT();
  const weekResets = useWeekResets();
  const tier = getTier(weekXp);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const pct = nextTier
    ? Math.min(100, Math.round(((weekXp - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;

  return (
    <Card className={`mt-6 overflow-hidden border ${tier.border}`}>
      <div className={`${tier.bg} px-4 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("board.tier")}</p>
            <p className={`font-display text-2xl font-semibold ${tier.color}`}>
              {t(tier.key)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("board.thisWeek")}</p>
            <p className={`font-display text-2xl tabular-nums ${tier.color}`}>{weekXp} XP</p>
          </div>
        </div>

        {/* XP to promote bar */}
        {nextTier && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("board.xpToPromote")}: {nextTier.min - weekXp} XP</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all duration-700 ${tier.color.replace("text-", "bg-")}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Reset countdown */}
      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
        <span>{t("board.weekResets")}</span>
        <span className="tabular-nums font-medium text-foreground">{weekResets}</span>
      </div>
    </Card>
  );
}

// ── Podium (top 3) ───────────────────────────────────────────
function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useT();
  const top = rows.slice(0, 3);
  if (top.length < 2) return null;

  const order = top.length === 3 ? [1, 0, 2] : [0, 1]; // 2nd, 1st, 3rd
  const heights = ["h-16", "h-24", "h-12"];
  const podiumColors = [
    "border-yellow-400/60 bg-yellow-400/10 text-yellow-400",
    "border-slate-300/60 bg-slate-300/10 text-slate-300",
    "border-orange-400/60 bg-orange-400/10 text-orange-400",
  ];
  const icons = [
    <Trophy key={0} size={16} className="text-yellow-400" />,
    <Medal key={1} size={16} className="text-slate-300" />,
    <Medal key={2} size={16} className="text-orange-400" />,
  ];

  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-xs uppercase tracking-widest text-muted-foreground">
        {t("board.podiumTitle")}
      </p>
      <div className="flex items-end justify-center gap-2">
        {order.map((rank) => {
          const p = top[rank];
          if (!p) return null;
          return (
            <div key={p.id} className="flex flex-col items-center gap-1" style={{ flex: 1, maxWidth: "33%" }}>
              <p className="w-full truncate text-center text-xs font-medium">
                {p.display_name ?? t("board.anon")}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{p.xp} XP</p>
              <div
                className={`flex w-full items-center justify-center rounded-t-lg border ${podiumColors[rank]} ${heights[rank]}`}
              >
                {icons[rank]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Leaderboard() {
  const { user } = useSession();
  const { t } = useT();
  const [tab, setTab] = useState<"week" | "all">("week");
  const stats = usePlayerStats(user?.id);
  const weekXp = stats.data?.week_xp ?? 0;

  const board = useQuery({
    queryKey: ["leaderboard", tab],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      if (tab === "all") {
        const { data, error } = await supabase.rpc("leaderboard");
        if (error) throw error;
        return (data as RpcLeaderboard[] ?? []).map((p) => ({
          id: p.user_id,
          display_name: p.display_name,
          xp: p.xp ?? 0,
          trust_score: p.trust_score,
          streak_current: p.streak_current,
        }));
      }
      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return (data as RpcWeekly[] ?? []).map((p) => ({
        id: p.user_id,
        display_name: p.display_name,
        xp: (p as any).week_xp ?? 0,
        trust_score: p.trust_score,
        streak_current: p.streak_current,
      }));
    },
  });

  const podium = ["podium-gold", "podium-silver", "podium-bronze"];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl text-primary">{t("board.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("board.body")}</p>

      {/* Anon prompt */}
      {!user ? (
        <Card className="mt-8 flex flex-col items-center gap-4 p-8 text-center">
          <LogIn size={28} className="text-accent" />
          <div>
            <p className="font-medium">{t("board.signInTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("board.signInBody")}</p>
          </div>
          <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
            {t("nav.signIn")}
          </Link>
        </Card>
      ) : (
        <>
          {/* Tier card — only on weekly tab */}
          {tab === "week" && <TierCard weekXp={weekXp} />}

          {/* Podium — only on weekly tab with data */}
          {tab === "week" && (board.data?.length ?? 0) >= 2 && (
            <Podium rows={board.data!} />
          )}

          {/* Tab switcher */}
          <div className="league-tabs mt-6">
            {(["week", "all"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`league-tab ${tab === k ? "league-tab-active" : ""}`}
              >
                {k === "week" ? t("board.thisWeek") : t("board.allTime")}
              </button>
            ))}
          </div>

          {board.isLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : !board.data?.length ? (
            <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
              {tab === "week" ? t("board.weekEmpty") : t("board.empty")}
            </Card>
          ) : (
            <ol className="mt-4 space-y-2">
              {board.data.map((p, i) => (
                <li key={p.id}>
                  <Card
                    className={`flex min-w-0 items-center gap-3 p-3 transition-transform hover:-translate-y-0.5 ${
                      p.id === user?.id ? "border-primary shadow-md" : ""
                    } ${i < 3 ? podium[i] : ""}`}
                  >
                    <span className="w-6 shrink-0 text-center font-display text-lg text-muted-foreground">
                      {i === 0 ? <Trophy size={16} className="mx-auto text-yellow-400" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.display_name ?? t("board.anon")}
                        {p.id === user?.id && (
                          <span className="ml-2 text-xs text-primary">({t("board.you")})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("board.trust")} {Number(p.trust_score ?? 0).toFixed(2)}
                      </p>
                    </div>
                    {(p.streak_current ?? 0) > 0 && (
                      <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                        <Flame size={12} className="text-primary" />
                        {p.streak_current}
                      </div>
                    )}
                    <span className="shrink-0 font-display text-base">{p.xp} XP</span>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
