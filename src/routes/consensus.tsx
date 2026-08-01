import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/consensus")({
  head: () => ({
    meta: [
      { title: "Consensus candidates — Kikabila" },
      {
        name: "description",
        content:
          "Live view of candidate translations scored by trust-weighted community agreement, before they enter the verified corpus.",
      },
      { property: "og:title", content: "Consensus candidates — Kikabila" },
      {
        property: "og:description",
        content: "Candidate translations scored by trust-weighted agreement across contributors.",
      },
    ],
  }),
  component: Consensus,
});

function Consensus() {
  const { languages, languageId, setLanguageId } = useLanguages();
  const { t } = useT();

  const candidates = useQuery({
    queryKey: ["candidates", languageId],
    enabled: !!languageId,
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
        <LanguagePicker languages={languages.data ?? []} value={languageId} onChange={setLanguageId} />
      </div>

      {candidates.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !candidates.data?.length ? (
        <Card className="mt-8 p-8 text-center text-sm text-muted-foreground">
          {t("consensus.empty")}
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {candidates.data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-display text-2xl">{c.display_text}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {t("consensus.for")} “{c.swahili_word}” ({c.english_word})
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
          ))}
        </ul>
      )}
    </main>
  );
}
