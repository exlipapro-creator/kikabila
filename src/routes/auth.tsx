import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLanguages } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Kikabila" },
      { name: "description", content: "Sign in or create an account to play Kikabila." },
    ],
  }),
  component: Auth,
});

// ── Step indicator ─────────────────────────────────────────────
function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? "w-6 bg-accent" : i === current ? "w-6 bg-primary" : "w-3 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function Auth() {
  const navigate = useNavigate();
  const { t } = useT();

  // Which screen we're on
  type Screen = "form" | "languages" | "confirm" | "reset";
  const [screen, setScreen] = useState<Screen>("form");
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Language selection (step 2 of signup)
  const { languages } = useLanguages();
  const [selectedLangs, setSelectedLangs] = useState<number[]>([]);
  const [savingLangs, setSavingLangs] = useState(false);

  // Newly created user id (needed to save preferred languages)
  const [newUserId, setNewUserId] = useState<string | null>(null);

  function toggleLang(id: number) {
    setSelectedLangs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (data.user && data.user.identities?.length === 0) {
          toast.error(t("auth.alreadyExists"));
          return;
        }

        if (!data.session) {
          // Email confirmation required — skip language step, go to confirm screen
          setScreen("confirm");
          return;
        }

        // Session returned immediately — go to language selection step
        setNewUserId(data.user!.id);
        setScreen("languages");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error(t("auth.notConfirmed"));
          }
          throw error;
        }
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function saveLanguagesAndContinue() {
    setSavingLangs(true);
    if (selectedLangs.length > 0 && newUserId) {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_language_ids: selectedLangs })
        .eq("id", newUserId);
      if (error) {
        // Non-fatal — just skip and continue
        console.warn("Could not save preferred languages:", error.message);
      }
    }
    setSavingLangs(false);
    navigate({ to: "/" });
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success(t("auth.resetSent"));
      setScreen("form");
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.generic"));
    } finally {
      setBusy(false);
    }
  }

  // ── Confirm email screen ─────────────────────────────────────
  if (screen === "confirm") {
    return (
      <main className="mx-auto flex max-w-md flex-col px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <Mail size={32} className="text-accent" />
        </div>
        <h1 className="mt-4 font-display text-3xl text-primary">{t("auth.checkInbox")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("auth.confirmSent")} <strong>{email}</strong>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.confirmBody")}</p>
        <button
          className="mt-8 text-sm text-muted-foreground underline hover:text-foreground"
          onClick={() => { setScreen("form"); setMode("signin"); }}
        >
          {t("auth.alreadyConfirmed")}
        </button>
      </main>
    );
  }

  // ── Password reset screen ────────────────────────────────────
  if (screen === "reset") {
    return (
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-center font-display text-3xl text-primary">{t("auth.resetTitle")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth.resetBody")}</p>
        <Card className="mt-8 p-6">
          <form className="space-y-4" onSubmit={sendReset}>
            <div>
              <Label htmlFor="reset-email">{t("auth.email")}</Label>
              <Input
                id="reset-email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : t("auth.resetSend")}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setScreen("form")}
          >
            ← {t("auth.backToSignIn")}
          </button>
        </Card>
      </main>
    );
  }

  // ── Language selection screen (signup step 2) ────────────────
  if (screen === "languages") {
    return (
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <Steps current={1} total={2} />
        <h1 className="mt-6 text-center font-display text-3xl text-primary">{t("auth.langTitle")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth.langBody")}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {languages.isLoading ? (
            [80, 96, 72, 88, 80, 76].map((w, i) => (
              <div key={i} className="animate-pulse rounded-full border border-border bg-muted" style={{ width: `${w}px`, height: "40px" }} />
            ))
          ) : (
            (languages.data ?? []).map((l) => {
              const selected = selectedLangs.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLang(l.id)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-150 active:scale-95 ${
                    selected
                      ? "border-accent bg-accent/20 text-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {selected && <CheckCircle2 size={14} className="text-accent" />}
                  {l.name}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-10 space-y-3">
          <Button
            className="w-full" size="lg"
            disabled={savingLangs}
            onClick={saveLanguagesAndContinue}
          >
            {savingLangs
              ? <Loader2 className="animate-spin" />
              : selectedLangs.length > 0
                ? t("auth.langSave")
                : t("auth.langSkip")}
          </Button>
          {selectedLangs.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {selectedLangs.length} {t("auth.langSelected")}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── Sign-in / Sign-up form (step 1) ──────────────────────────
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      {mode === "signup" && <Steps current={0} total={2} />}
      <h1 className={`text-center font-display text-4xl text-primary ${mode === "signup" ? "mt-6" : ""}`}>
        {mode === "signup" ? t("auth.joinTitle") : t("auth.welcome")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth.sub")}</p>

      <Card className="mt-8 p-6">
        <form className="space-y-4" onSubmit={submitCredentials}>
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">{t("auth.displayName")}</Label>
              <Input
                id="name" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha M."
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email" type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password" type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? <Loader2 className="animate-spin" />
              : mode === "signup" ? t("auth.create") : t("auth.signIn")}
          </Button>
        </form>

        {mode === "signin" && (
          <button
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setScreen("reset")}
          >
            {t("auth.forgot")}
          </button>
        )}

        <div className="mt-1 border-t border-border/60 pt-4">
          <button
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? t("auth.haveAccount") : t("auth.newHere")}
          </button>
        </div>
      </Card>
    </main>
  );
}
