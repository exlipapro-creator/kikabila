
REVOKE EXECUTE ON FUNCTION public.recompute_candidates(bigint,bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.after_submission() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_submission_defaults() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.promote_candidate(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_candidate(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_challenge(bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.promote_candidate(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_candidate(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_challenge(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO anon, authenticated;
