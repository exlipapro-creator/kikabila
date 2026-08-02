import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { PlayerHud } from "@/components/PlayerHud";
import { QuestBoard } from "@/components/QuestBoard";
import { celebrate } from "@/components/Celebration";
import {
  buildQuests,
  levelFromXp,
  rankTitle,
  usePlayerStats,
  useToday,
} from "@/lib/gamification";
import { useT } from "@/lib/i18n";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kikabila — play the Tanzanian language challenge" },
      {
        name: "description",
        content:
          "Answer daily Swahili-to-tribal-language challenges, lock your answer, then see how the community agrees. Earn XP, streaks and trust.",
      },
      { property: "og:title", content: "Kikabila — play the language challenge" },
      {
        property: "og:description",
        content:
          "Daily translation challenges that build a verified Tanzanian language corpus, one answer at a time.",
      },
    ],
  }),
  component: Play,
});

type Challenge = {
  base_word_id: number;
  swahili_word: string;
  english_word: string;
  category: string;
  reason: string;
};

function Play() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { languages, languageId, setLanguageId } = useLanguages();
  const qc = useQueryClient();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);


  async function loadChallenge(langId: number) {
    setLoadingChallenge(true);
    setLocked(false);
    setAnswer("");
    setNote("");
    const { data, error } = await supabase.rpc("next_challenge", { _language_id: langId });
    setLoadingChallenge(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setChallenge((data as Challenge[])?.[0] ?? null);
  }

  useEffect(() => {
    if (user && languageId) loadChallenge(languageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, languageId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_badges")
      .select("badge_code", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setBadgeCount(count ?? 0));
  }, [user]);



  const consensus = useQuery({
    queryKey: ["consensus", challenge?.base_word_id, languageId],
    enabled: locked && !!challenge && !!languageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consensus_candidates", {
        _language_id: languageId!,
        _base_word_id: challenge!.base_word_id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = usePlayerStats(user?.id);
  const today = useToday(user?.id);
  const dailyGoal = profile?.daily_goal ?? 10;

  const quests = useMemo(
    () =>
      buildQuests(today.data ?? { count: 0, notes: 0, languages: 0 }, dailyGoal, {
        words: t("quest.words"),
        spark: t("quest.spark"),
        notes: t("quest.notes"),
        languages: t("quest.langs"),
      }),
    [today.data, dailyGoal, t],
  );

  async function useFreeze() {
    setFreezeBusy(true);
    const { data, error } = await supabase.rpc("use_streak_freeze");
    setFreezeBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      toast.success(t("hud.freezeUsed"));
      qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    } else {
      toast.message(t("hud.freezeFailed"));
    }
  }

  async function submit() {
    if (!challenge || !languageId || !answer.trim()) return;
    setBusy(true);
    const beforeXp = profile?.xp ?? 0;
    const beforeLevel = levelFromXp(beforeXp).level;
    const beforeToday = today.data?.count ?? 0;

    const { error } = await supabase.from("submissions").insert({
      user_id: user!.id,
      base_word_id: challenge.base_word_id,
      language_id: languageId,
      translated_text: answer.trim(),
      normalized_text: answer.trim().toLowerCase().replace(/[^a-z0-9 ]/g, ""),
      cultural_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      // Unique constraint = already answered this word; treat as already locked
      if (error.code === "23505") {
        setLocked(true);
        toast.success(t("play.locked"));
        return;
      }
      toast.error(`${error.message}${error.details ? ` — ${error.details}` : ""}${error.hint ? ` (${error.hint})` : ""}`);
      console.error("Submission error:", error);
      return;
    }
    setLocked(true);

    const [{ data: fresh }, { data: freshBadges }] = await Promise.all([
      supabase.from("profiles").select("xp").eq("id", user!.id).maybeSingle(),
      supabase.from("user_badges").select("badge_code").eq("user_id", user!.id),
    ]);

    const afterXp = fresh?.xp ?? beforeXp;
    const gained = Math.max(0, afterXp - beforeXp);
    const afterLevel = levelFromXp(afterXp).level;

    celebrate(`+${gained || 10} XP`, undefined, "xp");
    if (beforeToday + 1 === dailyGoal) {
      setTimeout(() => celebrate(t("celebrate.goal"), t("celebrate.goalSub"), "goal"), 700);
    }
    if (afterLevel > beforeLevel) {
      setTimeout(
        () =>
          celebrate(
            t("celebrate.levelUp"),
            `${t("celebrate.levelUpSub")} ${rankTitle(afterLevel)}`,
            "level",
          ),
        900,
      );
    }
    if ((freshBadges?.length ?? 0) > badgeCount) {
      const newest = freshBadges?.[freshBadges.length - 1]?.badge_code;
      setTimeout(() => celebrate(t("celebrate.badge"), newest, "badge"), 1200);
    }
    setBadgeCount(freshBadges?.length ?? badgeCount);

    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    qc.invalidateQueries({ queryKey: ["today", user!.id] });
    qc.invalidateQueries({ queryKey: ["player-stats", user!.id] });
    qc.invalidateQueries({ queryKey: ["user-badges", user!.id] });
    toast.success(t("play.locked"));
  }


  if (!ready) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) return <Landing />;

  const myNormalized = answer.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const candidates = consensus.data ?? [];
  const leader = candidates[0];
  const iAgree = leader && leader.normalized_text === myNormalized;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <PlayerHud
        profile={profile}
        todayCount={today.data?.count ?? 0}
        rank={stats.data?.rank}
        freezeBusy={freezeBusy}
        onUseFreeze={useFreeze}
      />

      <div className="mt-4">
        <QuestBoard quests={quests} />
      </div>

      <div className="mt-6" />


      <LanguagePicker
        languages={languages.data ?? []}
        value={languageId}
        onChange={setLanguageId}
      />

      {loadingChallenge ? (
        <Card className="mt-6 flex h-56 items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </Card>
      ) : !challenge ? (
        <Card className="mt-6 p-8 text-center">
          <p className="font-display text-2xl">{t("play.emptyTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("play.emptyBody")}</p>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border/60 bg-secondary/40 px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground sm:px-6">
            {challenge.category} · {challenge.reason}
          </div>
          <div className="px-4 py-6 text-center sm:px-6 sm:py-8">
            <p className="text-sm text-muted-foreground">{t("play.howDoYouSay")}</p>
            <h1 className="mt-1 font-display text-4xl text-primary sm:text-5xl">{challenge.swahili_word}</h1>
            <p className="mt-1 text-sm italic text-muted-foreground">"{challenge.english_word}"</p>
          </div>

          <div className="space-y-3 px-4 pb-6 sm:px-6">
            <Input
              value={answer}
              disabled={locked}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t("play.answerPlaceholder")}
              className="h-12 text-center text-lg"
              onKeyDown={(e) => e.key === "Enter" && !locked && submit()}
            />
            {!locked && (
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("play.notePlaceholder")}
                rows={2}
              />
            )}
            {!locked ? (
              <Button
                className="w-full"
                size="lg"
                disabled={busy || !answer.trim()}
                onClick={submit}
              >
                {busy ? <Loader2 className="animate-spin" /> : t("play.lockIn")}
              </Button>
            ) : (
              <Button
                className="w-full"
                variant="secondary"
                size="lg"
                onClick={() => loadChallenge(languageId!)}
              >
                {t("play.next")}
              </Button>
            )}
          </div>

          {locked && (
            <div className="border-t border-border/60 bg-secondary/30 px-4 py-5 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <Users size={16} className="text-accent" />
                <span className="font-medium">{t("play.consensusTitle")}</span>
                {leader &&
                  (iAgree ? (
                    <Badge className="ml-auto bg-accent text-accent-foreground">
                      <Sparkles size={12} className="mr-1" /> {t("play.youMatch")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-auto">
                      {t("play.youDiffer")}
                    </Badge>
                  ))}
              </div>
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.id} className="rounded-lg bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={
                          c.normalized_text === myNormalized ? "font-semibold text-primary" : ""
                        }
                      >
                        {c.display_text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.submission_count} {t("play.obs")} ·{" "}
                        {Math.round(Number(c.confidence) * 100)}% {t("play.confidence")}
                      </span>
                    </div>
                    <Progress
                      value={Number(c.agreement_ratio) * 100}
                      className="mt-2 h-1.5"
                    />
                  </li>
                ))}
              </ul>
              {candidates.length <= 1 && (
                <p className="mt-3 text-xs text-muted-foreground">{t("play.firstHere")}</p>
              )}
            </div>
          )}
        </Card>
      )}
    </main>
  );
}

function Landing() {
  const { t } = useT();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">{t("landing.kicker")}</p>
      <h1 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-6xl">{t("landing.title")}</h1>
      <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground sm:text-base">{t("landing.body")}</p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href="/auth"
          className="w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground sm:w-auto"
        >
          {t("landing.start")}
        </a>
        <a href="/corpus" className="w-full rounded-full border border-border px-6 py-3 sm:w-auto">
          {t("landing.browse")}
        </a>
      </div>
      <div className="mt-12 grid gap-4 text-left sm:mt-16 sm:grid-cols-3">
        {([
          ["landing.f1t", "landing.f1d"],
          ["landing.f2t", "landing.f2d"],
          ["landing.f3t", "landing.f3d"],
        ] as const).map(([tk, dk]) => (
          <Card key={tk} className="p-5">
            <h2 className="font-display text-xl sm:text-2xl">{t(tk)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(dk)}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
