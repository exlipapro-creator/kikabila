export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          description: string
          icon: string
          name: string
          sort_order: number
          tier: string
          xp_reward: number
        }
        Insert: {
          code: string
          description: string
          icon: string
          name: string
          sort_order?: number
          tier?: string
          xp_reward?: number
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          name?: string
          sort_order?: number
          tier?: string
          xp_reward?: number
        }
        Relationships: []
      }
      base_words: {
        Row: {
          category: string
          english_word: string
          id: number
          swahili_word: string
        }
        Insert: {
          category: string
          english_word: string
          id?: never
          swahili_word: string
        }
        Update: {
          category?: string
          english_word?: string
          id?: never
          swahili_word?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          agreement_ratio: number
          base_word_id: number
          confidence: number
          created_at: string
          display_text: string
          id: string
          language_id: number
          normalized_text: string
          region: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          submission_count: number
          updated_at: string
          weighted_score: number
        }
        Insert: {
          agreement_ratio?: number
          base_word_id: number
          confidence?: number
          created_at?: string
          display_text: string
          id?: string
          language_id: number
          normalized_text: string
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          submission_count?: number
          updated_at?: string
          weighted_score?: number
        }
        Update: {
          agreement_ratio?: number
          base_word_id?: number
          confidence?: number
          created_at?: string
          display_text?: string
          id?: string
          language_id?: number
          normalized_text?: string
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          submission_count?: number
          updated_at?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidates_base_word_id_fkey"
            columns: ["base_word_id"]
            isOneToOne: false
            referencedRelation: "base_words"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          answered_at: string | null
          base_word_id: number
          created_at: string
          id: string
          kind: string
          language_id: number
          reason: string
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          base_word_id: number
          created_at?: string
          id?: string
          kind?: string
          language_id: number
          reason?: string
          user_id: string
        }
        Update: {
          answered_at?: string | null
          base_word_id?: number
          created_at?: string
          id?: string
          kind?: string
          language_id?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_base_word_id_fkey"
            columns: ["base_word_id"]
            isOneToOne: false
            referencedRelation: "base_words"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          family: string
          id: number
          name: string
          target_word_count: number
        }
        Insert: {
          code: string
          family: string
          id?: never
          name: string
          target_word_count?: number
        }
        Update: {
          code?: string
          family?: string
          id?: never
          name?: string
          target_word_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          best_day_count: number
          created_at: string
          daily_goal: number
          days_goal_met: number
          display_name: string
          freeze_tokens: number
          gems: number
          id: string
          last_played_on: string | null
          streak_current: number
          streak_longest: number
          trust_score: number
          xp: number
        }
        Insert: {
          best_day_count?: number
          created_at?: string
          daily_goal?: number
          days_goal_met?: number
          display_name?: string
          freeze_tokens?: number
          gems?: number
          id: string
          last_played_on?: string | null
          streak_current?: number
          streak_longest?: number
          trust_score?: number
          xp?: number
        }
        Update: {
          best_day_count?: number
          created_at?: string
          daily_goal?: number
          days_goal_met?: number
          display_name?: string
          freeze_tokens?: number
          gems?: number
          id?: string
          last_played_on?: string | null
          streak_current?: number
          streak_longest?: number
          trust_score?: number
          xp?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          agreed_with_consensus: boolean | null
          base_word_id: number
          challenge_id: string | null
          created_at: string
          cultural_note: string | null
          id: string
          language_id: number
          normalized_text: string
          region: string | null
          translated_text: string
          user_id: string
          weight_at_submit: number
        }
        Insert: {
          agreed_with_consensus?: boolean | null
          base_word_id: number
          challenge_id?: string | null
          created_at?: string
          cultural_note?: string | null
          id?: string
          language_id: number
          normalized_text: string
          region?: string | null
          translated_text: string
          user_id: string
          weight_at_submit?: number
        }
        Update: {
          agreed_with_consensus?: boolean | null
          base_word_id?: number
          challenge_id?: string | null
          created_at?: string
          cultural_note?: string | null
          id?: string
          language_id?: number
          normalized_text?: string
          region?: string | null
          translated_text?: string
          user_id?: string
          weight_at_submit?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_base_word_id_fkey"
            columns: ["base_word_id"]
            isOneToOne: false
            referencedRelation: "base_words"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_history: {
        Row: {
          actor_id: string | null
          candidate_id: string | null
          comment: string | null
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          previous_status: string | null
          translation_id: string | null
        }
        Insert: {
          actor_id?: string | null
          candidate_id?: string | null
          comment?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          translation_id?: string | null
        }
        Update: {
          actor_id?: string | null
          candidate_id?: string | null
          comment?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          translation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_history_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          base_word_id: number
          confidence: number | null
          created_at: string
          cultural_note: string | null
          id: string
          language_id: number
          status: Database["public"]["Enums"]["translation_status"]
          supersedes_id: string | null
          translated_text: string
          verified_by: string | null
          version: number
        }
        Insert: {
          base_word_id: number
          confidence?: number | null
          created_at?: string
          cultural_note?: string | null
          id?: string
          language_id: number
          status?: Database["public"]["Enums"]["translation_status"]
          supersedes_id?: string | null
          translated_text: string
          verified_by?: string | null
          version?: number
        }
        Update: {
          base_word_id?: number
          confidence?: number | null
          created_at?: string
          cultural_note?: string | null
          id?: string
          language_id?: number
          status?: Database["public"]["Enums"]["translation_status"]
          supersedes_id?: string | null
          translated_text?: string
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "translations_base_word_id_fkey"
            columns: ["base_word_id"]
            isOneToOne: false
            referencedRelation: "base_words"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      consensus_candidates: {
        Args: { _base_word_id?: number; _language_id?: number }
        Returns: {
          agreement_ratio: number
          base_word_id: number
          category: string
          confidence: number
          created_at: string
          display_text: string
          english_word: string
          id: string
          language_id: number
          normalized_text: string
          region: string
          status: Database["public"]["Enums"]["candidate_status"]
          submission_count: number
          swahili_word: string
          updated_at: string
          weighted_score: number
        }[]
      }
      evaluate_badges: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leaderboard: {
        Args: never
        Returns: {
          display_name: string
          streak_current: number
          submissions: number
          trust_score: number
          user_id: string
          xp: number
        }[]
      }
      next_challenge: {
        Args: { _language_id: number }
        Returns: {
          base_word_id: number
          category: string
          english_word: string
          reason: string
          swahili_word: string
        }[]
      }
      normalize_text: { Args: { _t: string }; Returns: string }
      player_stats: {
        Args: never
        Returns: {
          agreed: number
          badges: number
          languages: number
          notes: number
          rank: number
          today_count: number
          total_words: number
          verified: number
          week_xp: number
        }[]
      }
      promote_candidate: {
        Args: { _candidate_id: string; _note?: string }
        Returns: string
      }
      recompute_candidates: {
        Args: { _base_word_id: number; _language_id: number }
        Returns: undefined
      }
      reject_candidate: {
        Args: { _candidate_id: string; _note?: string }
        Returns: undefined
      }
      use_streak_freeze: { Args: never; Returns: boolean }
      weekly_league: {
        Args: never
        Returns: {
          display_name: string
          streak_current: number
          trust_score: number
          user_id: string
          week_xp: number
        }[]
      }
    }
    Enums: {
      app_role: "contributor" | "reviewer" | "admin"
      candidate_status: "pending" | "queued" | "promoted" | "rejected"
      translation_status: "verified" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["contributor", "reviewer", "admin"],
      candidate_status: ["pending", "queued", "promoted", "rejected"],
      translation_status: ["verified", "archived"],
    },
  },
} as const
