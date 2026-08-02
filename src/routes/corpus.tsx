import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguagePicker, useLanguages } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/corpus")({
  head: () => ({
    meta: [
      { title: "Verified corpus — Kikabila" },
      { name: "description", content: "Browse the immutable, versioned corpus of verified Swahili-to-tribal-language translations." },
      { property: "og:title", content: "Verified corpus — Kikabila" },
    ],
  }),
  component: Corpus,
});

function Corpus() {
  const { user } = useSession();
  const { languages, languageId, setLanguageId } = useLanguages();
  const { t } = useT();
  const language = languages.data?.find((l) => l.id === languageId);

  const corpus = useQuery({
    queryKey: ["corpus", languageId],
    enabled: !!languageId,
    staleTime: 10 * 60_000, // 10 min — corpus rarely changes
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
        <LanguagePicker
          languages={languages.data ?? []}
          value={languageId}
          onChange={setLanguageId}
          loading={languages.isLoading}
        />
      </div>

      {/* Coverage card — visible to all */}
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

      {/* Anon prompt — show instead of empty state for logged-out users */}
      {!user && (
        <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
          <LogIn size={28} className="text-accent" />
          <div>
            <p className="font-medium">{t("corpus.signInTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("corpus.signInBody")}</p>
          </div>
          <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
            {t("nav.signIn")}
          </Link>
        </Card>
      )}

      {/* Corpus list — only for signed-in users */}
      {user && (
        corpus.isLoading ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !corpus.data?.rows.length ? (
          <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
            {t("corpus.empty")}
          </Card>
        ) : (
          <ul className="mt-6 space-y-2">
            {corpus.data.rows.map((tr) => (
              <li key={tr.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <Lock size={14} className="shrink-0 text-accent" />
                  <span className="font-display text-xl">{tr.translated_text}</span>
                  <span className="text-sm text-muted-foreground">
                    {tr.base_words?.swahili_word} · {tr.base_words?.english_word}
                  </span>
                  <Badge variant="outline" className="ml-auto shrink-0">
                    v{tr.version}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
