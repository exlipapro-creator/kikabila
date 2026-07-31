import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Kikabila" },
      { name: "description", content: "Sign in to play Kikabila translation challenges and contribute to the Tanzanian language corpus." },
      { property: "og:title", content: "Sign in — Kikabila" },
      { property: "og:description", content: "Join contributors building a verified Tanzanian language corpus." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const { t } = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(t("auth.created"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(t("auth.googleFailed"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-center font-display text-4xl text-primary">
        {mode === "signup" ? t("auth.joinTitle") : t("auth.welcome")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth.sub")}</p>
      <Card className="mt-8 p-6">
        <Button variant="secondary" className="w-full" onClick={google}>
          {t("auth.google")}
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> {t("auth.or")}{" "}
          <span className="h-px flex-1 bg-border" />
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">{t("auth.displayName")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha M." />
            </div>
          )}
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signup" ? t("auth.create") : t("auth.signIn")}
          </Button>
        </form>
        <button
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? t("auth.haveAccount") : t("auth.newHere")}
        </button>
      </Card>
    </main>
  );
}
