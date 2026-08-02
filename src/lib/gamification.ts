import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** XP curve: level N starts at 50*(N-1)^2 XP. */
export function levelFromXp(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
  const floor = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return {
    level,
    into: xp - floor,
    span: next - floor,
    remaining: next - xp,
    pct: Math.round(((xp - floor) / (next - floor)) * 100),
  };
}

const RANKS = [
  "Msikilizaji",    // listener
  "Mwanafunzi",     // learner
  "Mkusanyaji",     // collector
  "Mtafsiri",       // translator
  "Mlinzi wa Maneno", // word keeper
  "Mwandishi",      // scribe
  "Mzee wa Lugha",  // language elder
  "Mhifadhi",       // archivist
] as const;

export function rankTitle(level: number) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))];
}

export type BadgeTier = "bronze" | "silver" | "gold" | "legend";

export const TIER_CLASS: Record<BadgeTier, string> = {
  bronze: "badge-tier-bronze",
  silver: "badge-tier-silver",
  gold:   "badge-tier-gold",
  legend: "badge-tier-legend",
};

export type Badge = {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  xp_reward: number;
  sort_order: number;
};

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    staleTime: 60 * 60_000, // 1 hour — badge definitions never change at runtime
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Badge[];
    },
  });
}

export function useUserBadges(userId?: string) {
  return useQuery({
    queryKey: ["user-badges", userId],
    enabled: !!userId,
    staleTime: 30_000, // 30s — badges unlock after submissions
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("badge_code, earned_at")
        .eq("user_id", userId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type PlayerStats = {
  today_count: number;
  total_words: number;
  notes: number;
  languages: number;
  agreed: number;
  verified: number;
  week_xp: number;
  rank: number;
  badges: number;
};

export function usePlayerStats(userId?: string) {
  return useQuery({
    queryKey: ["player-stats", userId],
    enabled: !!userId,
    staleTime: 30_000, // 30s — updates after each submission
    queryFn: async () => {
      const { data, error } = await supabase.rpc("player_stats");
      if (error) throw error;
      return ((data as PlayerStats[]) ?? [])[0] ?? null;
    },
  });
}

/** Today's raw submissions — powers the daily quest board. */
export function useToday(userId?: string) {
  return useQuery({
    queryKey: ["today", userId],
    enabled: !!userId,
    staleTime: 10_000, // 10s — needs to be fresh during active gameplay
    queryFn: async () => {
      // Use UTC midnight to align with the DB trigger's CURRENT_DATE
      const now = new Date();
      const utcMidnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ));
      const { data, error } = await supabase
        .from("submissions")
        .select("id, cultural_note, language_id, agreed_with_consensus")
        .eq("user_id", userId!)
        .gte("created_at", utcMidnight.toISOString());
      if (error) throw error;
      const rows = data ?? [];
      return {
        count: rows.length,
        notes: rows.filter((r) => (r.cultural_note ?? "").trim().length > 0).length,
        languages: new Set(rows.map((r) => r.language_id)).size,
      };
    },
  });
}

export type Quest = {
  id: string;
  label: string;
  progress: number;
  target: number;
  reward: number;
};

export function buildQuests(
  today: { count: number; notes: number; languages: number },
  dailyGoal: number,
  labels: { words: string; notes: string; languages: string; spark: string },
): Quest[] {
  return [
    { id: "words",  label: labels.words,     progress: today.count,    target: dailyGoal, reward: 50 },
    { id: "spark",  label: labels.spark,     progress: Math.min(today.count, 1), target: 1, reward: 15 },
    { id: "notes",  label: labels.notes,     progress: today.notes,    target: 2,         reward: 10 },
    { id: "langs",  label: labels.languages, progress: today.languages, target: 2,        reward: 20 },
  ];
}
