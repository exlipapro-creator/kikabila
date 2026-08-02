import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Language = {
  id: number;
  code: string;
  name: string;
  family: string;
  target_word_count: number;
};

export function useLanguages(preferredIds: number[] = []) {
  const languages = useQuery({
    queryKey: ["languages"],
    staleTime: 60 * 60 * 1000, // 1 hour — language list rarely changes
    queryFn: async () => {
      const { data, error } = await supabase.from("languages").select("*").order("name");
      if (error) throw error;
      return data as Language[];
    },
  });

  const [languageId, setLanguageId] = useState<number | null>(null);

  useEffect(() => {
    if (languageId || !languages.data?.length) return;
    // Prefer first preferred language, fall back to alphabetical first
    const firstPreferred = preferredIds.find((id) =>
      languages.data.some((l) => l.id === id)
    );
    setLanguageId(firstPreferred ?? languages.data[0].id);
  }, [languages.data, languageId, preferredIds]);

  return { languages, languageId, setLanguageId };
}

export function LanguagePicker({
  languages,
  value,
  onChange,
  preferredIds = [],
  loading = false,
}: {
  languages: Language[];
  value: number | null;
  onChange: (id: number) => void;
  preferredIds?: number[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[80, 96, 72, 88, 80].map((w, i) => (
          <div
            key={i}
            className="animate-pulse rounded-full border border-border bg-muted"
            style={{ width: `${w}px`, height: "34px" }}
          />
        ))}
      </div>
    );
  }

  const preferred = preferredIds.length
    ? languages.filter((l) => preferredIds.includes(l.id))
    : [];
  const others = languages.filter((l) => !preferredIds.includes(l.id));
  const showDivider = preferred.length > 0 && others.length > 0;

  const chipClass = (id: number) =>
    `rounded-full border px-3 py-1.5 text-sm transition-all duration-150 active:scale-95 ${
      value === id
        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {preferred.map((l) => (
        <button key={l.id} onClick={() => onChange(l.id)} className={chipClass(l.id)}>
          {l.name}
        </button>
      ))}
      {showDivider && (
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      )}
      {others.map((l) => (
        <button key={l.id} onClick={() => onChange(l.id)} className={chipClass(l.id)}>
          {l.name}
        </button>
      ))}
    </div>
  );
}
