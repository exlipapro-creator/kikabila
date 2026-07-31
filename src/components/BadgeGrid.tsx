import {
  BookOpen,
  Crown,
  Feather,
  Flame,
  Globe,
  Landmark,
  Languages,
  Library,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { TIER_CLASS, type Badge, type BadgeTier } from "@/lib/gamification";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Feather,
  BookOpen,
  Library,
  Landmark,
  Flame,
  Target,
  ScrollText,
  Languages,
  Globe,
  Users,
  ShieldCheck,
  Crown,
};

export function BadgeGrid({
  badges,
  earned,
  lockedLabel,
}: {
  badges: Badge[];
  earned: Set<string>;
  lockedLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {badges.map((b) => {
        const Icon = ICONS[b.icon] ?? Sparkles;
        const has = earned.has(b.code);
        return (
          <div
            key={b.code}
            className={`badge-tile ${has ? TIER_CLASS[b.tier as BadgeTier] : "badge-tile-locked"}`}
            title={b.description}
          >
            <span className="badge-medal">
              {has ? <Icon size={20} /> : <Lock size={16} />}
            </span>
            <p className="mt-2 text-sm font-medium leading-tight">{b.name}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {has ? b.description : lockedLabel}
            </p>
            <span className="mt-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {b.tier} · +{b.xp_reward} XP
            </span>
          </div>
        );
      })}
    </div>
  );
}
