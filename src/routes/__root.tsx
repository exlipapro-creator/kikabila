import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Menu, X } from "lucide-react";

import { CelebrationLayer } from "@/components/Celebration";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-auth";
import { UiLangToggle, useT } from "@/lib/i18n";

function NotFoundComponent() {
  const { t } = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.notFoundBody")}</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("error.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </button>
          <Link to="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const NAV = [
  { to: "/", key: "nav.play" },
  { to: "/streak", key: "nav.streak" },
  { to: "/consensus", key: "nav.consensus" },
  { to: "/review", key: "nav.review" },
  { to: "/corpus", key: "nav.corpus" },
  { to: "/leaderboard", key: "nav.leaders" },
  { to: "/profile", key: "nav.profile" },
] as const;

function Nav() {
  const { user } = useSession();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    close();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <Link to="/" onClick={close} className="mr-3 font-display text-2xl tracking-tight text-primary">
          Kikabila
        </Link>

        {/* Desktop links */}
        <div className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to} to={n.to}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              activeOptions={{ exact: n.to === "/" }}
            >
              {t(n.key)}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UiLangToggle />
          {user ? (
            <button onClick={handleSignOut} className="hidden rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground md:inline-flex">
              {t("nav.signOut")}
            </button>
          ) : (
            <Link to="/auth" className="hidden rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground md:inline-flex">
              {t("nav.signIn")}
            </Link>
          )}
          <button
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-border/60 bg-background/95 px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {NAV.map((n) => (
              <Link
                key={n.to} to={n.to} onClick={close}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:font-medium [&.active]:text-foreground"
                activeOptions={{ exact: n.to === "/" }}
              >
                {t(n.key)}
              </Link>
            ))}
            <div className="mt-2 border-t border-border/60 pt-2">
              {user ? (
                <button onClick={handleSignOut} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
                  {t("nav.signOut")}
                </button>
              ) : (
                <Link to="/auth" onClick={close} className="block rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground">
                  {t("nav.signIn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function RootComponent() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen">
      <Nav />
      <Outlet />
      <CelebrationLayer />
    </div>
  );
}
