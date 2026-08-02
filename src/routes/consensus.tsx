import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/consensus")({
  head: () => ({
    meta: [
      { title: "Consensus candidates — Kikabila" },
      { name: "description", content: "Live view of candidate translations scored by trust-weighted community agreement." },
      { property: "og:title", content: "Consensus candidates — Kikabila" },
    ],
  }),
  component: Consensus,
});

function Consensus() {
  const { user } = useSession();
  const { languages, languageId, setLanguageId } = useLanguages();
  const { t } = useT();

  const candidates = useQuery({
    queryKey: ["candidates", languageId],
    enabled: !!languageId && !!user, // only fetch when logged in
    staleTime: 2 * 60_000, // 2 min
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consensus_candidates", {
        _language_id: languageId!,
      });
      if (error) throw error;
      return [...(data ?? [])].sort((a, b) => Number(b.confidence) - Number(a.confidence));
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl text-primary">{t("consensus.title")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("consensus.body")}</p>

      <div className="mt-6">
        <LanguagePicker
          languages={languages.data ?? []}
          value={languageId}
          onChange={setLanguageId}
          loading={languages.isLoading}
        />
      </div>

      {/* Anon prompt */}
      {!user ? (
        <Card className="mt-8 flex flex-col items-center gap-4 p-8 text-center">
          <LogIn size={28} className="text-accent" />
          <div>
            <p className="font-medium">{t("consensus.signInTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("consensus.signInBody")}</p>
          </div>
          <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
            {t("nav.signIn")}
          </Link>
        </Card>
      ) : candidates.isLoading ? (
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !candidates.data?.length ? (
        <Card className="mt-8 p-8 text-center text-sm text-muted-foreground">
          {t("consensus.empty")}
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {candidates.data.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-display text-2xl">{c.display_text}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {t("consensus.for")} "{c.swahili_word}" ({c.english_word})
                    </span>
                  </div>
                  <Badge variant={c.status === "promoted" ? "default" : "outline"}>{c.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={Number(c.confidence) * 100} className="h-2 flex-1" />
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {Math.round(Number(c.confidence) * 100)}% {t("play.confidence")} ·{" "}
                    {c.submission_count} {t("play.obs")} ·{" "}
                    {Math.round(Number(c.agreement_ratio) * 100)}% {t("consensus.agree")}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
