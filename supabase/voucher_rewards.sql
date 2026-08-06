-- =================================================================
-- Kikabila Voucher Rewards System
-- Run in Supabase SQL Editor
-- =================================================================

-- ── 1. Voucher pool ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network      text NOT NULL CHECK (network IN ('Tigo','Airtel','Vodacom','Halotel')),
  code         text NOT NULL,
  face_value   integer NOT NULL DEFAULT 500,
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available','claimed','expired')),
  claimed_by   uuid REFERENCES auth.users(id),
  claimed_at   timestamptz,
  uploaded_by  uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);

GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL    ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Admins see everything; claimers see only their own claimed vouchers
DROP POLICY IF EXISTS "admin full access" ON public.vouchers;
CREATE POLICY "admin full access" ON public.vouchers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "claimer sees own" ON public.vouchers;
CREATE POLICY "claimer sees own" ON public.vouchers
  FOR SELECT TO authenticated
  USING (claimed_by = auth.uid());

-- ── 2. Reward milestones ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_milestones (
  id             serial PRIMARY KEY,
  verified_words integer NOT NULL UNIQUE,
  label_sw       text NOT NULL,
  label_en       text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.reward_milestones TO authenticated, anon;
GRANT ALL    ON public.reward_milestones TO service_role;
ALTER TABLE public.reward_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON public.reward_milestones;
CREATE POLICY "public read" ON public.reward_milestones FOR SELECT USING (true);

-- Seed milestones (50 vouchers across a meaningful journey)
INSERT INTO public.reward_milestones (verified_words, label_sw, label_en, sort_order) VALUES
  (50,   'Maneno 50 yaliyothibitishwa',   '50 verified words',   1),
  (150,  'Maneno 150 yaliyothibitishwa',  '150 verified words',  2),
  (300,  'Maneno 300 yaliyothibitishwa',  '300 verified words',  3),
  (500,  'Maneno 500 yaliyothibitishwa',  '500 verified words',  4),
  (750,  'Maneno 750 yaliyothibitishwa',  '750 verified words',  5),
  (1000, 'Maneno 1000 yaliyothibitishwa', '1,000 verified words',6)
ON CONFLICT (verified_words) DO NOTHING;

-- ── 3. User milestone claims ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_milestone_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id integer NOT NULL REFERENCES public.reward_milestones(id),
  voucher_id   uuid REFERENCES public.vouchers(id),
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_milestone_claims_user ON public.user_milestone_claims(user_id);

GRANT SELECT, INSERT ON public.user_milestone_claims TO authenticated;
GRANT ALL             ON public.user_milestone_claims TO service_role;
ALTER TABLE public.user_milestone_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own claims" ON public.user_milestone_claims;
CREATE POLICY "own claims" ON public.user_milestone_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin claims read" ON public.user_milestone_claims;
CREATE POLICY "admin claims read" ON public.user_milestone_claims
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ── 4. Atomic claim RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_milestone_reward(_milestone_id integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id       uuid;
  v_network  text;
  v_code     text;
  v_value    integer;
  v_verified integer;
  m_threshold integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  -- Get milestone threshold
  SELECT verified_words INTO m_threshold
  FROM public.reward_milestones WHERE id = _milestone_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_milestone';
  END IF;

  -- Check user has enough verified words
  SELECT count(*)::int INTO v_verified
  FROM public.submissions s
  JOIN public.translations t
    ON t.base_word_id = s.base_word_id
   AND t.language_id  = s.language_id
   AND public.normalize_text(t.translated_text) = s.normalized_text
  WHERE s.user_id = auth.uid();

  IF v_verified < m_threshold THEN
    RAISE EXCEPTION 'not_enough_verified_words';
  END IF;

  -- Check not already claimed
  IF EXISTS (
    SELECT 1 FROM public.user_milestone_claims
    WHERE user_id = auth.uid() AND milestone_id = _milestone_id
  ) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  -- Atomically grab one available voucher
  SELECT id, network, code, face_value INTO v_id, v_network, v_code, v_value
  FROM public.vouchers
  WHERE status = 'available'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no_vouchers_available';
  END IF;

  -- Mark voucher claimed
  UPDATE public.vouchers
  SET status     = 'claimed',
      claimed_by = auth.uid(),
      claimed_at = now()
  WHERE id = v_id;

  -- Record claim
  INSERT INTO public.user_milestone_claims (user_id, milestone_id, voucher_id)
  VALUES (auth.uid(), _milestone_id, v_id);

  RETURN json_build_object(
    'network',     v_network,
    'code',        v_code,
    'face_value',  v_value
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_milestone_reward(integer) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.claim_milestone_reward(integer) TO authenticated;

-- ── 5. Helper: get user's milestone progress ──────────────────
CREATE OR REPLACE FUNCTION public.my_milestone_progress()
RETURNS TABLE(
  milestone_id    integer,
  verified_words  integer,
  label_sw        text,
  label_en        text,
  sort_order      integer,
  claimed         boolean,
  voucher_network text,
  claimed_at      timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id,
    m.verified_words,
    m.label_sw,
    m.label_en,
    m.sort_order,
    (c.id IS NOT NULL)                       AS claimed,
    v.network                                AS voucher_network,
    c.claimed_at
  FROM public.reward_milestones m
  LEFT JOIN public.user_milestone_claims c
    ON c.milestone_id = m.id AND c.user_id = auth.uid()
  LEFT JOIN public.vouchers v ON v.id = c.voucher_id
  ORDER BY m.sort_order;
$$;

REVOKE EXECUTE ON FUNCTION public.my_milestone_progress() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.my_milestone_progress() TO authenticated;

-- ── 6. Admin stats view ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.voucher_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'total',     count(*),
    'available', count(*) FILTER (WHERE status = 'available'),
    'claimed',   count(*) FILTER (WHERE status = 'claimed'),
    'expired',   count(*) FILTER (WHERE status = 'expired')
  )
  FROM public.vouchers;
$$;

REVOKE EXECUTE ON FUNCTION public.voucher_stats() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.voucher_stats() TO authenticated;

-- =================================================================
-- Done. Run voucher_rewards.sql once, then upload vouchers via
-- the admin panel at /admin/vouchers
-- =================================================================
