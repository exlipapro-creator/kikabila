import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { UiLangProvider } from "@/lib/i18n";
import { router, queryClient } from "./router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UiLangProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </UiLangProvider>
    </QueryClientProvider>
  );
}
