import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Loader2, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Kikabila" },
      {
        name: "description",
        content:
          "Top Kikabila contributors ranked by XP, with streaks, levels and the trust score that weights their submissions.",
      },
      { property: "og:title", content: "Leaderboard — Kikabila" },
      { property: "og:description", content: "Top contributors by XP, streaks and trust score." },
    ],
  }),
  component: Leaderboard,
});

type Row = {
  id: string;
  display_name: string | null;
  xp: number;
  trust_score: number | null;
  streak_current: number | null;
};

function Leaderboard() {
  const { user } = useSession();
  const { t } = useT();
  const [tab, setTab] = useState<"week" | "all">("week");

  const board = useQuery({
    queryKey: ["leaderboard", tab],
    queryFn: async (): Promise<Row[]> => {
      if (tab === "all") {
        const { data, error } = await supabase.rpc("leaderboard");
        if (error) throw error;
        return ((data as any[]) ?? []).map((p) => ({
          id: p.user_id,
          display_name: p.display_name,
          xp: p.xp ?? 0,
          trust_score: p.trust_score,
          streak_current: p.streak_current,
        }));
      }

      const { data, error } = await supabase.rpc("weekly_league");
      if (error) throw error;
      return ((data as any[]) ?? []).map((p) => ({
        id: p.user_id,
        display_name: p.display_name,
        xp: p.week_xp ?? 0,
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
        <div className="mt-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !board.data?.length ? (
        <Card className="mt-8 p-8 text-center text-sm text-muted-foreground">
          {tab === "week" ? t("board.weekEmpty") : t("board.empty")}
        </Card>
      ) : (
        <ol className="mt-6 space-y-2">
          {board.data.map((p, i) => (
            <Card
              key={p.id}
              className={`flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5 ${
                p.id === user?.id ? "border-primary shadow-md" : ""
              } ${i < 3 ? podium[i] : ""}`}
            >
              <span className="w-6 text-center font-display text-xl text-muted-foreground">
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
                <Badge variant="outline" className="gap-1">
                  <Flame size={12} className="text-accent" />
                  {p.streak_current}
                </Badge>
              )}
              <span className="w-20 text-right font-display text-lg">{p.xp} XP</span>
            </Card>
          ))}
        </ol>
      )}
    </main>
  );
}

