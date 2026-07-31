import { RouterProvider } from "@tanstack/react-router";
import { CelebrationLayer } from "@/components/Celebration";
import { getRouter } from "./router";

export default function App() {
  try {
    const router = getRouter();
    return (
      <>
        <RouterProvider router={router} />
        <CelebrationLayer />
      </>
    );
  } catch (error) {
    console.error("Router initialization error:", error);
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <h1>Router Error</h1>
        <p>Failed to initialize router: {error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }
}