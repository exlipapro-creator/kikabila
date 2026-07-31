-- profiles: authenticated only
DROP POLICY IF EXISTS "profiles readable by all" ON public.profiles;
CREATE POLICY "profiles readable by members" ON public.profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- user_badges: authenticated only
DROP POLICY IF EXISTS "user badges public read" ON public.user_badges;
CREATE POLICY "user badges member read" ON public.user_badges FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.user_badges FROM anon;

-- translation_history: reviewers/admins only
DROP POLICY IF EXISTS "history public read" ON public.translation_history;
CREATE POLICY "history reviewer read" ON public.translation_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));
REVOKE SELECT ON public.translation_history FROM anon;

-- candidates: hide reviewer identity/notes from non-reviewers
DROP POLICY IF EXISTS "candidates public read" ON public.candidates;
CREATE POLICY "candidates reviewer read" ON public.candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));
REVOKE SELECT ON public.candidates FROM anon;

CREATE OR REPLACE VIEW public.candidates_public
WITH (security_invoker = off) AS
  SELECT id, base_word_id, language_id, normalized_text, display_text, region,
         submission_count, weighted_score, agreement_ratio, confidence, status,
         created_at, updated_at
  FROM public.candidates;

GRANT SELECT ON public.candidates_public TO authenticated;
GRANT ALL ON public.candidates_public TO service_role;
