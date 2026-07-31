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

export function useLanguages() {
  const languages = useQuery({
    queryKey: ["languages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("languages").select("*").order("name");
      if (error) throw error;
      return data as Language[];
    },
  });

  const [languageId, setLanguageId] = useState<number | null>(null);

  useEffect(() => {
    if (!languageId && languages.data?.length) setLanguageId(languages.data[0].id);
  }, [languages.data, languageId]);

  return { languages, languageId, setLanguageId };
}

export function LanguagePicker({
  languages,
  value,
  onChange,
}: {
  languages: Language[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {languages.map((l) => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === l.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
