import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UiLangProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";
import App from "./App";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <UiLangProvider>
      <App />
      <Toaster position="top-center" />
    </UiLangProvider>
  </QueryClientProvider>
);