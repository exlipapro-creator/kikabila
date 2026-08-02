import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Loader2, LogIn, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
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

// Typed RPC return rows
type RpcLeaderboard = Database["public"]["Functions"]["leaderboard"]["Returns"][number];
type RpcWeekly = Database["public"]["Functions"]["weekly_league"]["Returns"][number];

function Leaderboard() {
  const { user } = useSession();
  const { t } = useT();
  const [tab, setTab] = useState<"week" | "all">("week");

  const board = useQuery({
    queryKey: ["leaderboard", tab],
    enabled: !!user, // requires auth per DB function
    staleTime: 5 * 60_000, // 5 min
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl text-primary">{t("board.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("board.body")}</p>

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
            <div className="mt-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : !board.data?.length ? (
            <Card className="mt-8 p-8 text-center text-sm text-muted-foreground">
              {tab === "week" ? t("board.weekEmpty") : t("board.empty")}
            </Card>
          ) : (
            <ol className="mt-6 space-y-2">
              {board.data.map((p, i) => (
                <li key={p.id}>
                  <Card
                    className={`flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5 sm:gap-4 sm:p-4 ${
                      p.id === user?.id ? "border-primary shadow-md" : ""
                    } ${i < 3 ? podium[i] : ""}`}
                  >
                    <span className="w-6 shrink-0 text-center font-display text-xl text-muted-foreground">
                      {i === 0 ? <Trophy size={18} className="mx-auto text-accent" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
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
                      <Badge variant="outline" className="hidden gap-1 sm:flex">
                        <Flame size={12} className="text-accent" />
                        {p.streak_current}
                      </Badge>
                    )}
                    <span className="shrink-0 font-display text-base sm:text-lg">{p.xp} XP</span>
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
