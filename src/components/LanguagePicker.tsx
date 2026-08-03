import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

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
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("languages").select("*").order("name");
      if (error) throw error;
      return data as Language[];
    },
  });

  const [languageId, setLanguageId] = useState<number | null>(null);

  useEffect(() => {
    if (languageId || !languages.data?.length) return;
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
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = languages.find((l) => l.id === value);

  // Sort: preferred first, then alphabetical
  const preferred = languages.filter((l) => preferredIds.includes(l.id));
  const others = languages.filter((l) => !preferredIds.includes(l.id));
  const sorted = [...preferred, ...others];

  if (loading) {
    return (
      <div className="h-11 w-56 animate-pulse rounded-xl bg-muted" />
    );
  }

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all active:scale-[0.98] ${
          open
            ? "border-primary bg-secondary shadow-sm"
            : "border-border bg-secondary/60 hover:border-foreground/20"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">{t("common.language")}</span>
          <span className="font-medium text-foreground">
            {selected?.name ?? "—"}
          </span>
          {preferredIds.includes(value ?? -1) && (
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-accent">
              {t("lang.mine")}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/30">
          {/* Preferred section */}
          {preferred.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{t("lang.myLanguages")}</span>
              </div>
              {preferred.map((l) => (
                <DropdownItem
                  key={l.id}
                  language={l}
                  selected={l.id === value}
                  onSelect={() => { onChange(l.id); setOpen(false); }}
                />
              ))}
            </>
          )}

          {/* Divider */}
          {preferred.length > 0 && others.length > 0 && (
            <div className="my-1 border-t border-border/60" />
          )}

          {/* Other languages */}
          {preferred.length > 0 && others.length > 0 && (
            <div className="px-3 pt-1 pb-1">
              <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{t("lang.allLanguages")}</span>
            </div>
          )}
          {others.map((l) => (
            <DropdownItem
              key={l.id}
              language={l}
              selected={l.id === value}
              onSelect={() => { onChange(l.id); setOpen(false); }}
            />
          ))}

          {/* No preferred — show all flat */}
          {preferred.length === 0 && sorted.map((l) => (
            <DropdownItem
              key={l.id}
              language={l}
              selected={l.id === value}
              onSelect={() => { onChange(l.id); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  language,
  selected,
  onSelect,
}: {
  language: Language;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors active:scale-[0.98] ${
        selected
          ? "bg-primary/15 text-primary"
          : "text-foreground hover:bg-secondary"
      }`}
    >
      <span>{language.name}</span>
      {selected && <Check size={14} className="text-primary" />}
    </button>
  );
}
