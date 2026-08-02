import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/use-auth";
import { levelFromXp, rankTitle, useBadges, usePlayerStats, useUserBadges } from "@/lib/gamification";
import { BadgeGrid } from "@/components/BadgeGrid";
import { LevelRing } from "@/components/PlayerHud";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your trophy shelf — Kikabila" },
      { name: "description", content: "Track your Kikabila level, streak, badges and lifetime contributions." },
      { property: "og:title", content: "Your trophy shelf — Kikabila" },
      { property: "og:type", content: "profile" },
    ],
  }),
  component: ProfilePage,
});

// ── Inline editable field ─────────────────────────────────────
function EditableField({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (draft.trim() === value) { setEditing(false); return; }
    setBusy(true);
    await onSave(draft.trim());
    setBusy(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        className="group flex items-center gap-2"
        onClick={() => { setDraft(value); setEditing(true); }}
        aria-label="Edit"
      >
        <span className="font-display text-2xl text-primary sm:text-3xl">{value}</span>
        <Pencil size={14} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={draft}
        placeholder={placeholder}
        className="h-9 w-48 font-display text-xl"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        maxLength={40}
      />
      <button onClick={save} disabled={busy} className="text-accent hover:text-foreground">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      </button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  );
}

// ── Daily goal selector ───────────────────────────────────────
const GOAL_OPTIONS = [5, 10, 15, 20, 30];

function DailyGoalPicker({
  current,
  onSave,
}: {
  current: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useT();

  async function pick(v: number) {
    if (v === current) return;
    setBusy(true);
    await onSave(v);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wide mr-1">{t("profile.dailyGoal")}:</span>
      {GOAL_OPTIONS.map((v) => (
        <button
          key={v}
          disabled={busy}
          onClick={() => pick(v)}
          className={`rounded-full border px-3 py-1 text-sm transition-all active:scale-95 ${
            v === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function ProfilePage() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: profile } = useProfile(user?.id);
  const stats = usePlayerStats(user?.id);
  const badges = useBadges();
  const mine = useUserBadges(user?.id);
  const qc = useQueryClient();
  const preferredIds = (profile?.preferred_language_ids ?? []) as number[];
  const { languages } = useLanguages(preferredIds);
  const [savingLangs, setSavingLangs] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState<number[] | null>(null);

  // Use profile preferred_language_ids as initial state once loaded
  const effectiveLangs = selectedLangs ?? preferredIds;

  const xpFeed = useQuery({
    queryKey: ["xp-feed", user?.id],
    enabled: !!user,
    staleTime: 60_000,
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

  async function saveField(field: "display_name" | "daily_goal", value: string | number) {
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user!.id);
    if (error) { toast.error(error.message); throw error; }
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    toast.success(t("profile.saved"));
  }

  async function saveLanguages(ids: number[]) {
    setSavingLangs(true);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_language_ids: ids })
      .eq("id", user!.id);
    setSavingLangs(false);
    if (error) { toast.error(error.message); return; }
    setSelectedLangs(ids);
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    toast.success(t("profile.saved"));
  }

  function toggleLang(id: number) {
    const next = effectiveLangs.includes(id)
      ? effectiveLangs.filter((x) => x !== id)
      : [...effectiveLangs, id];
    setSelectedLangs(next);
  }

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
        <Link to="/auth" className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
          {t("nav.signIn")}
        </Link>
      </main>
    );
  }

  const lvl = levelFromXp(profile?.xp ?? 0);
  const earned = new Set((mine.data ?? []).map((b) => b.badge_code));
  const s = stats.data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">

      {/* ── Header card ── */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <LevelRing pct={lvl.pct} level={lvl.level} />
        <div className="min-w-0 flex-1 space-y-1">
          <EditableField
            value={profile?.display_name ?? t("play.player")}
            placeholder={t("play.player")}
            onSave={(v) => saveField("display_name", v)}
          />
          <p className="text-sm text-muted-foreground">
            {rankTitle(lvl.level)} · {profile?.xp ?? 0} XP · {t("hud.rank")} #{s?.rank ?? "—"}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-4 text-center sm:w-auto">
          <Metric value={profile?.streak_current ?? 0} label={t("play.streak")} />
          <Metric value={profile?.streak_longest ?? 0} label={t("profile.longest")} />
          <Metric value={earned.size} label={t("profile.badges")} />
        </div>
      </Card>

      {/* ── Settings ── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl">{t("profile.settings")}</h2>
        <Card className="mt-3 space-y-5 p-5">
          <DailyGoalPicker
            current={profile?.daily_goal ?? 10}
            onSave={(v) => saveField("daily_goal", v)}
          />
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t("profile.myLanguages")}</p>
            <div className="flex flex-wrap gap-2">
              {languages.isLoading ? (
                [80, 96, 72].map((w, i) => (
                  <div key={i} className="animate-pulse rounded-full border border-border bg-muted" style={{ width: `${w}px`, height: "34px" }} />
                ))
              ) : (
                (languages.data ?? []).map((l) => {
                  const sel = effectiveLangs.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLang(l.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-all active:scale-95 ${
                        sel
                          ? "border-accent bg-accent/20 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {l.name}
                    </button>
                  );
                })
              )}
            </div>
            {selectedLangs !== null && (
              <Button
                size="sm"
                className="mt-3"
                disabled={savingLangs}
                onClick={() => saveLanguages(effectiveLangs)}
              >
                {savingLangs ? <Loader2 size={14} className="animate-spin" /> : t("profile.saveLangs")}
              </Button>
            )}
          </div>
        </Card>
      </section>

      {/* ── Stats ── */}
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

      {/* ── Badges ── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("profile.badges")}</h2>
        <div className="mt-3">
          {badges.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
            <BadgeGrid badges={badges.data ?? []} earned={earned} lockedLabel={t("profile.locked")} />
          )}
        </div>
      </section>

      {/* ── Recent XP ── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl">{t("profile.recent")}</h2>
        <ul className="mt-3 space-y-2">
          {(xpFeed.data ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm">
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
