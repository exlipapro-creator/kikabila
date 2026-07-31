-- 1. profiles: column-limited self update
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, daily_goal) ON public.profiles TO authenticated;

-- 2. profiles: own row read only
DROP POLICY IF EXISTS "profiles readable by members" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3. user_badges: own rows only
DROP POLICY IF EXISTS "user badges member read" ON public.user_badges;
CREATE POLICY "own badges read" ON public.user_badges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. leaderboard function exposes user id for client keying
DROP FUNCTION IF EXISTS public.leaderboard();
CREATE FUNCTION public.leaderboard()
RETURNS TABLE(user_id uuid, display_name text, xp integer, trust_score numeric, streak_current integer, submissions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.display_name, p.xp, p.trust_score, p.streak_current,
         (SELECT count(*) FROM public.submissions s WHERE s.user_id = p.id)
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.xp DESC LIMIT 50
$$;

-- 5. lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- internal-only helpers / trigger functions stay revoked.
-- app-facing RPCs, signed-in users only:
GRANT EXECUTE ON FUNCTION public.player_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_challenge(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consensus_candidates(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze() TO authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_league() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_candidate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_candidate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_text(text) TO authenticated;