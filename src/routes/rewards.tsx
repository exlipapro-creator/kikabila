import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Gift, Lock, CheckCircle2, Loader2, LogIn,
  Sparkles, Copy, Check
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { usePlayerStats } from "@/lib/gamification";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Kikabila" },
      { name: "description", content: "Earn real airtime vouchers by contributing verified translations." },
    ],
  }),
  component: RewardsPage,
});

type Milestone = {
  milestone_id: number;
  verified_words: number;
  label_sw: string;
  label_en: string;
  sort_order: number;
  claimed: boolean;
  voucher_network: string | null;
  claimed_at: string | null;
};

type ClaimedVoucher = {
  network: string;
  code: string;
  face_value: number;
};

// ── Network brand colours ─────────────────────────────────────
const NET_STYLE: Record<string, { bg: string; text: string; border: string; logo: string }> = {
  Tigo:    { bg: "from-blue-600/20 to-blue-900/30",    text: "text-blue-300",    border: "border-blue-500/50",    logo: "T" },
  Airtel:  { bg: "from-red-600/20 to-red-900/30",      text: "text-red-300",     border: "border-red-500/50",     logo: "A" },
  Vodacom: { bg: "from-red-500/20 to-red-800/30",      text: "text-red-200",     border: "border-red-400/50",     logo: "V" },
  Halotel: { bg: "from-orange-500/20 to-orange-900/30",text: "text-orange-300",  border: "border-orange-500/50",  logo: "H" },
};

function networkStyle(n: string) {
  return NET_STYLE[n] ?? { bg: "from-muted/20 to-muted/30", text: "text-foreground", border: "border-border", logo: "?" };
}

// ── Scratch card component ────────────────────────────────────
function ScratchCard({
  voucher,
  onCopy,
}: {
  voucher: ClaimedVoucher;
  onCopy: () => void;
}) {
  const [scratched, setScratched] = useState(false);
  const [copied, setCopied] = useState(false);
  const ns = networkStyle(voucher.network);

  async function copy() {
    await navigator.clipboard.writeText(voucher.code);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border ${ns.border} bg-gradient-to-br ${ns.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${ns.border} ${ns.text} font-display text-xl font-bold`}>
          {ns.logo}
        </div>
        <div>
          <p className={`font-semibold ${ns.text}`}>{voucher.network}</p>
          <p className="text-xs text-muted-foreground">TZS {voucher.face_value.toLocaleString()} Airtime</p>
        </div>
        <CheckCircle2 size={20} className="ml-auto text-accent" />
      </div>

      {/* Scratch reveal area */}
      {!scratched ? (
        <button
          onClick={() => setScratched(true)}
          className="group w-full border-t border-border/40 bg-secondary/40 px-5 py-6 text-center transition-colors hover:bg-secondary/70 active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles size={28} className="text-primary animate-pulse" />
            </div>
            <p className="font-display text-lg text-foreground">Gusa kufunua kodi</p>
            <p className="text-xs text-muted-foreground">Tap to reveal your voucher code</p>
          </div>
        </button>
      ) : (
        <div className="border-t border-border/40 px-5 py-5 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Voucher Code</p>
          <p className={`font-mono text-3xl font-bold tracking-widest ${ns.text} scratch-reveal`}>
            {voucher.code}
          </p>
          <button
            onClick={copy}
            className={`mt-3 flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-all mx-auto ${ns.border} ${ns.text} hover:bg-white/5 active:scale-95`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy code"}
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Piga simu <span className={`font-medium ${ns.text}`}>*150*{voucher.code}#</span> au nenda kwenye duka la {voucher.network}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dial <span className={`font-medium ${ns.text}`}>*150*{voucher.code}#</span> or visit a {voucher.network} shop
          </p>
        </div>
      )}
    </div>
  );
}

// ── Single milestone card ─────────────────────────────────────
function MilestoneCard({
  milestone,
  verifiedCount,
  onClaim,
}: {
  milestone: Milestone;
  verifiedCount: number;
  onClaim: (id: number) => Promise<ClaimedVoucher | null>;
}) {
  const { t } = useT();
  const [claiming, setClaiming] = useState(false);
  const [voucher, setVoucher] = useState<ClaimedVoucher | null>(null);

  const reached = verifiedCount >= milestone.verified_words;
  const pct = Math.min(100, Math.round((verifiedCount / milestone.verified_words) * 100));
  const remaining = Math.max(0, milestone.verified_words - verifiedCount);

  async function claim() {
    setClaiming(true);
    const result = await onClaim(milestone.milestone_id);
    setClaiming(false);
    if (result) setVoucher(result);
  }

  return (
    <Card className={`overflow-hidden transition-all ${milestone.claimed ? "opacity-80" : ""}`}>
      {/* Milestone header */}
      <div className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          milestone.claimed
            ? "bg-accent/20 text-accent"
            : reached
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
        }`}>
          {milestone.claimed
            ? <CheckCircle2 size={20} />
            : reached
              ? <Gift size={20} />
              : <Lock size={18} />
          }
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">
            {t("common.language") === "Lugha" ? milestone.label_sw : milestone.label_en}
          </p>
          {milestone.claimed ? (
            <p className="text-xs text-accent">
              {milestone.voucher_network} · {t("rewards.claimed")} {new Date(milestone.claimed_at!).toLocaleDateString()}
            </p>
          ) : reached ? (
            <p className="text-xs text-primary">{t("rewards.readyToClaim")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {remaining.toLocaleString()} {t("rewards.wordsLeft")}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-primary">TZS 500</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{t("rewards.airtime")}</p>
        </div>
      </div>

      {/* Progress bar */}
      {!milestone.claimed && (
        <div className="px-4 pb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{verifiedCount.toLocaleString()} / {milestone.verified_words.toLocaleString()}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-700 ${reached ? "bg-primary" : "bg-muted-foreground/40"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Claim button — only when reached and not claimed */}
      {reached && !milestone.claimed && !voucher && (
        <div className="border-t border-border/60 px-4 py-3">
          <Button
            className="w-full"
            disabled={claiming}
            onClick={claim}
          >
            {claiming
              ? <><Loader2 size={16} className="mr-2 animate-spin" /> {t("rewards.claiming")}</>
              : <><Gift size={16} className="mr-2" /> {t("rewards.claimReward")}</>
            }
          </Button>
        </div>
      )}

      {/* Scratch card after claim */}
      {voucher && (
        <div className="border-t border-border/60 px-4 pb-4">
          <ScratchCard voucher={voucher} onCopy={() => toast.success(t("rewards.codeCopied"))} />
        </div>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────
function RewardsPage() {
  const { t } = useT();
  const { user, ready } = useSession();
  const stats = usePlayerStats(user?.id);
  const qc = useQueryClient();

  const milestones = useQuery({
    queryKey: ["my-milestones", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_milestone_progress" as any);
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const verifiedCount = stats.data?.verified ?? 0;

  async function handleClaim(milestoneId: number): Promise<ClaimedVoucher | null> {
    const { data, error } = await supabase.rpc(
      "claim_milestone_reward" as any,
      { _milestone_id: milestoneId }
    );
    if (error) {
      if (error.message.includes("already_claimed")) {
        toast.error(t("rewards.alreadyClaimed"));
      } else if (error.message.includes("no_vouchers_available")) {
        toast.error(t("rewards.noVouchers"));
      } else if (error.message.includes("not_enough_verified_words")) {
        toast.error(t("rewards.notEnough"));
      } else {
        toast.error(error.message);
      }
      return null;
    }
    qc.invalidateQueries({ queryKey: ["my-milestones", user!.id] });
    qc.invalidateQueries({ queryKey: ["voucher-stats"] });
    toast.success(t("rewards.success"));
    return data as ClaimedVoucher;
  }

  if (!ready) {
    return <main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <Gift size={40} className="mx-auto text-accent" />
        <h1 className="mt-4 font-display text-3xl text-primary">{t("rewards.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("rewards.signIn")}</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
          {t("nav.signIn")}
        </Link>
      </main>
    );
  }

  const nextMilestone = milestones.data?.find((m) => !m.claimed);
  const claimedCount = milestones.data?.filter((m) => m.claimed).length ?? 0;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Gift size={32} className="text-primary" />
        </div>
        <h1 className="mt-3 font-display text-3xl text-primary">{t("rewards.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("rewards.body")}</p>
      </div>

      {/* Progress summary */}
      <Card className="mt-6 p-4">
        <div className="grid grid-cols-3 divide-x divide-border/60 text-center">
          <div className="px-2">
            <p className="font-display text-2xl text-primary tabular-nums">{verifiedCount}</p>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{t("rewards.verified")}</p>
          </div>
          <div className="px-2">
            <p className="font-display text-2xl text-accent tabular-nums">{claimedCount}</p>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{t("rewards.claimed")}</p>
          </div>
          <div className="px-2">
            <p className="font-display text-2xl text-foreground tabular-nums">
              {nextMilestone ? nextMilestone.verified_words - verifiedCount : 0}
            </p>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{t("rewards.toNext")}</p>
          </div>
        </div>
      </Card>

      {/* Milestone list */}
      <section className="mt-6 space-y-3">
        {milestones.isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)
        ) : (
          milestones.data?.map((m) => (
            <MilestoneCard
              key={m.milestone_id}
              milestone={m}
              verifiedCount={verifiedCount}
              onClaim={handleClaim}
            />
          ))
        )}
      </section>

      {/* All claimed */}
      {!milestones.isLoading && milestones.data?.every((m) => m.claimed) && (
        <Card className="mt-4 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto text-accent" />
          <p className="mt-3 font-display text-xl">{t("rewards.allClaimed")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("rewards.allClaimedBody")}</p>
        </Card>
      )}
    </main>
  );
}
