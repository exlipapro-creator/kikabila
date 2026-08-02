-- Phase 0 DB fixes
-- Run in Supabase SQL Editor

-- 1. Cultural note length constraint
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_cultural_note_length
  CHECK (cultural_note IS NULL OR length(cultural_note) <= 400);

-- 2. Fix claim_first_admin TOCTOU race
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  -- Use INSERT ... ON CONFLICT to be atomic — no race condition
  INSERT INTO public.user_roles (user_id, role)
  SELECT auth.uid(), r FROM (VALUES ('admin'::public.app_role), ('reviewer'::public.app_role)) AS t(r)
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  -- Return true only if we actually inserted (i.e. we became the admin)
  RETURN inserted > 0;
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
