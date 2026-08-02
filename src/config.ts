// Supabase credentials — read from environment variables.
// In development, create a .env file based on .env.example.
// In production, set these in your hosting provider's environment config.
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
};
