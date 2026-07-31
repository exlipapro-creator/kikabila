import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, History, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Reviewer queue — Kikabila" },
      {
        name: "description",
        content:
          "Reviewers compare submission evidence, community agreement and corpus history before promoting a candidate translation.",
      },
      { property: "og:title", content: "Reviewer queue — Kikabila" },
      {
        property: "og:description",
        content: "Compare evidence and promote candidates into the immutable verified corpus.",
      },
    ],
  }),
  component: Review,
});

function Review() {
  const { t } = useT();
  const { user, ready } = useSession();
  const { data: roles } = useRoles(user?.id);
  const { languages, languageId, setLanguageId } = useLanguages();
  const qc = useQueryClient();
  const isReviewer = !!roles?.some((r) => r === "reviewer" || r === "admin");

  const adminExists = useQuery({
    queryKey: ["admin-exists"],
    enabled: !!user && !isReviewer,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) throw error;
      return data as boolean;
    },
  });

  const queue = useQuery({
    queryKey: ["queue", languageId],
    enabled: isReviewer && !!languageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, base_words(swahili_word, english_word, category)")
        .eq("language_id", languageId!)
        .in("status", ["queued", "pending"])
        .order("confidence", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (!ready) return <Centered><Loader2 className="animate-spin" /></Centered>;

  if (!user) {
    return (
      <Centered>
        <p className="text-muted-foreground">{t("review.signIn")}</p>
      </Centered>
    );
  }

  if (!isReviewer) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldCheck className="mx-auto text-accent" size={32} />
        <h1 className="mt-4 font-display text-3xl">{t("review.needAccess")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("review.needAccessBody")}</p>
        {adminExists.data === false && (
          <Button
            className="mt-6"
            onClick={async () => {
              const { data, error } = await supabase.rpc("claim_first_admin");
              if (error) return toast.error(error.message);
              if (!data) return toast.error(t("review.adminExists"));
              toast.success(t("review.claimed"));
              qc.invalidateQueries({ queryKey: ["roles", user.id] });
            }}
          >
            {t("review.claim")}
          </Button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl text-primary">{t("review.title")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("review.body")}</p>
      <div className="mt-6">
        <LanguagePicker languages={languages.data ?? []} value={languageId} onChange={setLanguageId} />
      </div>

      {queue.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !queue.data?.length ? (
        <Card className="mt-8 p-8 text-center text-sm text-muted-foreground">
          {t("review.emptyQueue")}
        </Card>
      ) : (
        <div className="mt-8 space-y-4">
          {queue.data.map((c) => (
            <CandidateReview
              key={c.id}
              candidate={c}
              onDone={() => {
                queue.refetch();
                qc.invalidateQueries({ queryKey: ["candidates"] });
                qc.invalidateQueries({ queryKey: ["corpus"] });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CandidateReview({ candidate, onDone }: { candidate: any; onDone: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const evidence = useQuery({
    queryKey: ["evidence", candidate.id],
    enabled: open,
    queryFn: async () => {
      const [subs, siblings, history] = await Promise.all([
        supabase
          .from("submissions")
          .select("id, translated_text, cultural_note, region, weight_at_submit, created_at, agreed_with_consensus")
          .eq("base_word_id", candidate.base_word_id)
          .eq("language_id", candidate.language_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("candidates")
          .select("id, display_text, submission_count, confidence, agreement_ratio, status")
          .eq("base_word_id", candidate.base_word_id)
          .eq("language_id", candidate.language_id)
          .order("weighted_score", { ascending: false }),
        supabase
          .from("translations")
          .select("id, translated_text, version, status, created_at, confidence")
          .eq("base_word_id", candidate.base_word_id)
          .eq("language_id", candidate.language_id)
          .order("version", { ascending: false }),
      ]);
      return {
        submissions: subs.data ?? [],
        siblings: siblings.data ?? [],
        history: history.data ?? [],
      };
    },
  });

  async function act(kind: "promote" | "reject") {
    setBusy(true);
    const { error } =
      kind === "promote"
        ? await supabase.rpc("promote_candidate", { _candidate_id: candidate.id, _note: note || undefined })
        : await supabase.rpc("reject_candidate", { _candidate_id: candidate.id, _note: note || undefined });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "promote" ? t("review.promoted") : t("review.rejected"));
    onDone();
  }

  return (
    <Card className="overflow-hidden">
      <button className="w-full p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-display text-2xl">{candidate.display_text}</span>
            <span className="ml-2 text-sm text-muted-foreground">
              {t("consensus.for")} “{candidate.base_words?.swahili_word}” (
              {candidate.base_words?.english_word})
            </span>
          </div>
          <Badge variant="outline">{candidate.status}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={Number(candidate.confidence) * 100} className="h-2 flex-1" />
          <span className="w-44 text-right text-xs text-muted-foreground">
            {Math.round(Number(candidate.confidence) * 100)}% {t("play.confidence")} ·{" "}
            {candidate.submission_count} {t("play.obs")}
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-border/60 bg-secondary/25 p-4">
          {evidence.isLoading ? (
            <Loader2 className="mx-auto animate-spin text-muted-foreground" />
          ) : (
            <>
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Users size={14} className="text-accent" /> {t("review.competing")}
                </h3>
                <ul className="space-y-1 text-sm">
                  {evidence.data?.siblings.map((s) => (
                    <li key={s.id} className="flex justify-between rounded-md bg-background/60 px-3 py-2">
                      <span className={s.id === candidate.id ? "font-semibold text-primary" : ""}>
                        {s.display_text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.submission_count} {t("play.obs")} ·{" "}
                        {Math.round(Number(s.agreement_ratio) * 100)}% {t("consensus.agree")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">{t("review.evidence")}</h3>
                <ul className="space-y-1 text-sm">
                  {evidence.data?.submissions.map((s) => (
                    <li key={s.id} className="rounded-md bg-background/60 px-3 py-2">
                      <div className="flex justify-between gap-3">
                        <span>{s.translated_text}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("review.weight")} {Number(s.weight_at_submit).toFixed(2)} ·{" "}
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {s.cultural_note && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{s.cultural_note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <History size={14} className="text-accent" /> {t("review.history")}
                </h3>
                {evidence.data?.history.length ? (
                  <ul className="space-y-1 text-sm">
                    {evidence.data.history.map((h) => (
                      <li key={h.id} className="flex justify-between rounded-md bg-background/60 px-3 py-2">
                        <span>
                          v{h.version} · {h.translated_text}
                        </span>
                        <Badge variant="outline">{h.status}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("review.noHistory")}</p>
                )}
              </section>

              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={t("review.notePlaceholder")}
              />
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => act("promote")}>
                  {t("review.promote")}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => act("reject")}>
                  {t("review.reject")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-[60vh] items-center justify-center">{children}</main>;
}
