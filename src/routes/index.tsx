import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Users, Sparkles } from "lucide-react";

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
        content: "Daily translation challenges that build a verified Tanzanian language corpus, one answer at a time.",
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
  tier?: number;
  challenge_type?: string;
};

// Animate a number from start to end over ~600ms using rAF
function useCountUp(target: number, trigger: boolean) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (!trigger) { prev.current = target; setDisplay(target); return; }
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();
    function step(now: number) {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * ease));
      if (p < 1) requestAnimationFrame(step);
      else prev.current = target;
    }
    requestAnimationFrame(step);
  }, [target, trigger]);
  return display;
}

// Tiny circular countdown ring
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - seconds / total);
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <svg width="26" height="26" className="-rotate-90">
        <circle cx="13" cy="13" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <circle
          cx="13" cy="13" r={r} fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear" }}
        />
      </svg>
      <span className="tabular-nums font-medium">{seconds}</span>
    </div>
  );
}

function Play() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: profile } = useProfile(user?.id);
  const preferredIds = (profile?.preferred_language_ids ?? []) as number[];
  const { languages, languageId, setLanguageId } = useLanguages(preferredIds);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  // phase: idle | submitting | success | transitioning | loading
  const [phase, setPhase] = useState<"idle" | "submitting" | "success" | "transitioning" | "loading">("idle");
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cardAnim, setCardAnim] = useState<"" | "slide-out" | "slide-in">("");

  // For consensus display after success
  const [lockedAnswer, setLockedAnswer] = useState("");

  // XP animated counter in HUD
  const [xpTarget, setXpTarget] = useState(profile?.xp ?? 0);
  const [xpAnimating, setXpAnimating] = useState(false);
  const displayXp = useCountUp(xpTarget, xpAnimating);

  useEffect(() => {
    if (profile?.xp !== undefined) setXpTarget(profile.xp);
  }, [profile?.xp]);

  const stats = usePlayerStats(user?.id);
  const today = useToday(user?.id);
  const dailyGoal = profile?.daily_goal ?? 10;

  const quests = useMemo(
    () => buildQuests(today.data ?? { count: 0, notes: 0, languages: 0 }, dailyGoal, {
      words: t("quest.words"), spark: t("quest.spark"),
      notes: t("quest.notes"), languages: t("quest.langs"),
    }),
    [today.data, dailyGoal, t],
  );

  const consensus = useQuery({
    queryKey: ["consensus", challenge?.base_word_id, languageId],
    enabled: phase === "success" && !!challenge && !!languageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consensus_candidates", {
        _language_id: languageId!,
        _base_word_id: challenge!.base_word_id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loadChallenge = useCallback(async (langId: number) => {
    setPhase("loading");
    setAnswer("");
    setNote("");
    setLockedAnswer("");
    setCardAnim("");
    const { data, error } = await supabase.rpc("next_challenge", { _language_id: langId });
    if (error) { toast.error(error.message); setPhase("idle"); return; }
    setChallenge((data as Challenge[])?.[0] ?? null);
    setPhase("idle");
    // Focus after brief paint delay
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    if (user && languageId) loadChallenge(languageId);
  }, [user, languageId, loadChallenge]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_badges").select("badge_code", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setBadgeCount(count ?? 0));
  }, [user]);

  async function useFreeze() {
    setFreezeBusy(true);
    const { data, error } = await supabase.rpc("use_streak_freeze");
    setFreezeBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      toast.success(t("hud.freezeUsed"));
      qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    } else {
      toast.message(t("hud.freezeFailed"));
    }
  }

  // Transition to next word: slide out → swap data → slide in → focus
  const advanceToNext = useCallback(async (langId: number) => {
    setPhase("transitioning");
    setCardAnim("slide-out");
    await new Promise(r => setTimeout(r, 320));
    setPhase("loading");
    setAnswer("");
    setNote("");
    setLockedAnswer("");
    setCardAnim("");
    const { data, error } = await supabase.rpc("next_challenge", { _language_id: langId });
    if (error) { toast.error(error.message); setPhase("idle"); return; }
    setChallenge((data as Challenge[])?.[0] ?? null);
    setCardAnim("slide-in");
    setPhase("idle");
    setTimeout(() => {
      setCardAnim("");
      inputRef.current?.focus();
    }, 320);
  }, []);

  async function submit() {
    if (!challenge || !languageId || !answer.trim() || phase !== "idle") return;
    setPhase("submitting");
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

    if (error) {
      if (error.code === "23505") {
        // Already answered — silently advance
        advanceToNext(languageId);
        return;
      }
      toast.error(`${error.message}${error.details ? ` — ${error.details}` : ""}`);
      console.error("Submission error:", error);
      setPhase("idle");
      return;
    }

    setLockedAnswer(answer.trim());
    setPhase("success");

    // Fetch fresh data
    const [{ data: fresh }, { data: freshBadges }] = await Promise.all([
      supabase.from("profiles").select("xp").eq("id", user!.id).maybeSingle(),
      supabase.from("user_badges").select("badge_code").eq("user_id", user!.id),
    ]);

    const afterXp = fresh?.xp ?? beforeXp;
    const gained = Math.max(0, afterXp - beforeXp);

    // Animate XP counter in HUD
    setXpTarget(afterXp);
    setXpAnimating(true);
    setTimeout(() => setXpAnimating(false), 700);

    // Toast with XP
    toast.success(`+${gained || 10} XP — ${t("play.lockedSub")}`, { duration: 2500 });

    // Celebrate events
    celebrate(`+${gained || 10} XP`, undefined, "xp");
    if (beforeToday + 1 === dailyGoal) {
      setTimeout(() => celebrate(t("celebrate.goal"), t("celebrate.goalSub"), "goal"), 700);
    }
    if (levelFromXp(afterXp).level > beforeLevel) {
      setTimeout(() => celebrate(t("celebrate.levelUp"), `${t("celebrate.levelUpSub")} ${rankTitle(levelFromXp(afterXp).level)}`, "level"), 900);
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

    // Countdown 3 → 2 → 1 → advance
    const total = 3;
    setCountdown(total);
    let remaining = total;
    const iv = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(iv);
        advanceToNext(languageId);
      }
    }, 1000);
  }

  if (!ready) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) return <Landing />;

  const myNormalized = lockedAnswer.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const candidates = consensus.data ?? [];
  const leader = candidates[0];
  const iAgree = leader && leader.normalized_text === myNormalized;
  const isLocked = phase === "success";
  const isBusy = phase === "submitting";
  const isTransitioning = phase === "transitioning" || phase === "loading";

  // Animated profile for HUD (swap xp with animated display value)
  const animatedProfile = profile ? { ...profile, xp: displayXp } : profile;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <PlayerHud
        profile={animatedProfile}
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
        preferredIds={preferredIds}
        loading={languages.isLoading}
      />

      {phase === "loading" && !challenge ? (
        <Card className="mt-6 flex h-56 items-center justify-center">
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto animate-spin text-muted-foreground" />
            <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-muted" />
            <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-muted" />
          </div>
        </Card>
      ) : !challenge ? (
        <Card className="mt-6 p-8 text-center">
          <p className="font-display text-2xl">{t("play.emptyTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("play.emptyBody")}</p>
        </Card>
      ) : (
        <div
          ref={cardRef}
          className={`mt-6 challenge-card ${cardAnim}`}
        >
          {/* Rotating glow — active while user can type, removed after submit */}
          <div className={phase === "idle" || phase === "submitting" ? "challenge-glow" : ""}>
          <Card className="overflow-hidden">
            {/* Category bar */}
            <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {challenge.category}
                </span>
                {challenge.challenge_type && challenge.challenge_type !== "word" && (
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wide font-medium ${
                    challenge.challenge_type === "phrase"   ? "bg-accent/20 text-accent" :
                    challenge.challenge_type === "sentence" ? "bg-primary/20 text-primary" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {challenge.challenge_type}
                  </span>
                )}
              </div>
              {isLocked && countdown > 0 && (
                <CountdownRing seconds={countdown} total={3} />
              )}
            </div>

            {/* Word display */}
            <div className="px-4 py-6 text-center sm:px-6 sm:py-8">
              {isLocked ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} className="text-accent animate-check-pop" />
                  <p className="text-sm text-muted-foreground">{t("play.yourAnswer")}</p>
                  <p className="font-display text-3xl text-primary">{lockedAnswer}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {challenge.challenge_type === "phrase"   ? t("play.howDoYouSayPhrase") :
                     challenge.challenge_type === "sentence" ? t("play.translateSentence") :
                     challenge.challenge_type === "proverb"  ? t("play.translateProverb") :
                     t("play.howDoYouSay")}
                  </p>
                  <h1 className={`mt-2 font-display text-primary ${
                    challenge.challenge_type === "word" || !challenge.challenge_type
                      ? "text-4xl sm:text-5xl"
                      : "text-2xl sm:text-3xl leading-snug"
                  }`}>{challenge.swahili_word}</h1>
                  <p className="mt-1 text-sm italic text-muted-foreground">"{challenge.english_word}"</p>
                </>
              )}
            </div>

            {/* Input area */}
            <div className="space-y-3 px-4 pb-6 sm:px-6">
              <Input
                ref={inputRef}
                value={answer}
                disabled={isLocked || isBusy || isTransitioning}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t("play.answerPlaceholder")}
                className="h-12 text-center text-lg"
                onKeyDown={(e) => e.key === "Enter" && !isLocked && !isBusy && submit()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              {!isLocked && (
                <Textarea
                  value={note}
                  disabled={isBusy || isTransitioning}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("play.notePlaceholder")}
                  rows={challenge.challenge_type === "sentence" || challenge.challenge_type === "proverb" ? 3 : 2}
                />
              )}
              <Button
                className="w-full"
                size="lg"
                disabled={isBusy || isLocked || isTransitioning || !answer.trim()}
                onClick={submit}
              >
                {isBusy ? <Loader2 className="animate-spin" /> : t("play.lockIn")}
              </Button>
            </div>

            {/* Consensus panel — shown after success */}
            {isLocked && (
              <div className="border-t border-border/60 bg-secondary/30 px-4 py-5 sm:px-6">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <Users size={16} className="text-accent" />
                  <span className="font-medium">{t("play.consensusTitle")}</span>
                  {leader && (
                    iAgree ? (
                      <Badge className="ml-auto bg-accent text-accent-foreground">
                        <Sparkles size={12} className="mr-1" /> {t("play.youMatch")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto">{t("play.youDiffer")}</Badge>
                    )
                  )}
                </div>
                {consensus.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("play.firstHere")}</p>
                ) : (
                  <ul className="space-y-2">
                    {candidates.map((c) => {
                      const conf = Math.round(Number(c.confidence) * 100);
                      const confLabel = conf < 30 ? t("play.confLow") : conf < 60 ? t("play.confMed") : t("play.confHigh");
                      return (
                        <li key={c.id} className="rounded-lg bg-background/60 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={c.normalized_text === myNormalized ? "font-semibold text-primary" : ""}>
                              {c.display_text}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {c.submission_count} {t("play.obs")} · {conf}% · {confLabel}
                            </span>
                          </div>
                          <Progress value={Number(c.agreement_ratio) * 100} className="mt-2 h-1.5" />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {candidates.length <= 1 && !consensus.isLoading && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("play.firstHere")}</p>
                )}
              </div>
            )}
          </Card>
          </div> {/* /challenge-glow */}
        </div>
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
        <Link to="/auth" className="w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground sm:w-auto">
          {t("landing.start")}
        </Link>
        <Link to="/corpus" className="w-full rounded-full border border-border px-6 py-3 sm:w-auto">
          {t("landing.browse")}
        </Link>
      </div>
      <div className="mt-12 grid gap-4 text-left sm:mt-16 sm:grid-cols-3">
        {([["landing.f1t","landing.f1d"],["landing.f2t","landing.f2d"],["landing.f3t","landing.f3d"]] as const).map(([tk,dk]) => (
          <Card key={tk} className="p-5">
            <h2 className="font-display text-xl sm:text-2xl">{t(tk)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(dk)}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
