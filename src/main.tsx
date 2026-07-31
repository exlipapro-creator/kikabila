import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CelebrationLayer } from "@/components/Celebration";
import { UiLangProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { getRouter } from "./router";

const queryClient = new QueryClient();
const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <UiLangProvider>
      <RouterProvider router={router} />
      <CelebrationLayer />
      <Toaster position="top-center" />
    </UiLangProvider>
  </QueryClientProvider>
);