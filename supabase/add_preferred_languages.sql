-- Phase 2: add preferred_language_ids to profiles
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language_ids bigint[] NOT NULL DEFAULT '{}';

-- Allow authenticated users to update this new column
GRANT UPDATE (preferred_language_ids, display_name, daily_goal) ON public.profiles TO authenticated;
