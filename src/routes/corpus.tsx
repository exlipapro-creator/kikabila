import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/corpus")({
  head: () => ({
    meta: [
      { title: "Verified corpus — Kikabila" },
      {
        name: "description",
        content:
          "Browse the immutable, versioned corpus of verified Swahili-to-tribal-language translations and per-language coverage.",
      },
      { property: "og:title", content: "Verified corpus — Kikabila" },
      {
        property: "og:description",
        content: "Immutable, versioned verified translations with full coverage reporting.",
      },
    ],
  }),
  component: Corpus,
});

function Corpus() {
  const { languages, languageId, setLanguageId } = useLanguages();
  const { t } = useT();
  const language = languages.data?.find((l) => l.id === languageId);

  const corpus = useQuery({
    queryKey: ["corpus", languageId],
    enabled: !!languageId,
    queryFn: async () => {
      const [verified, words] = await Promise.all([
        supabase
          .from("translations")
          .select("*, base_words(swahili_word, english_word, category)")
          .eq("language_id", languageId!)
          .eq("status", "verified")
          .order("created_at", { ascending: false }),
        supabase.from("base_words").select("id", { count: "exact", head: true }),
      ]);
      if (verified.error) throw verified.error;
      return { rows: verified.data ?? [], baseWordCount: words.count ?? 0 };
    },
  });

  const verifiedCount = corpus.data?.rows.length ?? 0;
  const target = language?.target_word_count ?? 500;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl text-primary">{t("corpus.title")}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("corpus.body")}</p>

      <div className="mt-6">
        <LanguagePicker languages={languages.data ?? []} value={languageId} onChange={setLanguageId} />
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl">{language?.name ?? "—"}</span>
          <span className="text-sm text-muted-foreground">
            {verifiedCount} {t("corpus.verifiedOf")} {target}
          </span>
        </div>
        <Progress value={Math.min(100, (verifiedCount / target) * 100)} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("corpus.coverage")} {verifiedCount} {t("corpus.ofBaseWords")}{" "}
          {corpus.data?.baseWordCount ?? 0}
        </p>
      </Card>

      {corpus.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !corpus.data?.rows.length ? (
        <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
          {t("corpus.empty")}
        </Card>
      ) : (
        <ul className="mt-6 space-y-2">
          {corpus.data.rows.map((tr) => (
            <Card key={tr.id} className="flex flex-wrap items-center gap-3 p-4">
              <Lock size={14} className="text-accent" />
              <span className="font-display text-xl">{tr.translated_text}</span>
              <span className="text-sm text-muted-foreground">
                {tr.base_words?.swahili_word} · {tr.base_words?.english_word}
              </span>
              <Badge variant="outline" className="ml-auto">
                v{tr.version}
              </Badge>
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
