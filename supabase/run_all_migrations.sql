-- =================================================================
-- KIKABILA — Complete schema (correct dependency order)
-- Step 1: Run the DROP block in a separate query first (already done)
-- Step 2: Run THIS file
-- =================================================================

-- ── 1. Enums ──────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('contributor','reviewer','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.translation_status AS ENUM ('verified','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.candidate_status AS ENUM ('pending','queued','promoted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. has_role — must exist before any policy that calls it ──
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ── 3. Tables ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Anonymous',
  xp integer NOT NULL DEFAULT 0,
  trust_score numeric NOT NULL DEFAULT 50,
  streak_current integer NOT NULL DEFAULT 0,
  streak_longest integer NOT NULL DEFAULT 0,
  last_played_on date,
  daily_goal integer NOT NULL DEFAULT 10,
  freeze_tokens integer NOT NULL DEFAULT 1,
  best_day_count integer NOT NULL DEFAULT 0,
  days_goal_met integer NOT NULL DEFAULT 0,
  gems integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_goal integer NOT NULL DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS freeze_tokens integer NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_day_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS days_goal_met integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;
GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.languages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text UNIQUE NOT NULL, name text NOT NULL,
  family text NOT NULL DEFAULT '', target_word_count integer NOT NULL DEFAULT 500
);
GRANT SELECT ON public.languages TO anon, authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.base_words (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  swahili_word text NOT NULL, english_word text NOT NULL,
  category text NOT NULL DEFAULT 'general', UNIQUE (swahili_word)
);
GRANT SELECT ON public.base_words TO anon, authenticated;
GRANT ALL ON public.base_words TO service_role;
ALTER TABLE public.base_words ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  translated_text text NOT NULL, cultural_note text,
  status public.translation_status NOT NULL DEFAULT 'verified',
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.translations(id),
  confidence numeric, verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_translations_word_lang ON public.translations(base_word_id, language_id);
GRANT SELECT ON public.translations TO anon, authenticated;
GRANT ALL ON public.translations TO service_role;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.translation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid REFERENCES public.translations(id) ON DELETE CASCADE,
  candidate_id uuid, event_type text NOT NULL,
  previous_status text, new_status text, comment text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.translation_history TO authenticated;
GRANT ALL ON public.translation_history TO service_role;
ALTER TABLE public.translation_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  normalized_text text NOT NULL, display_text text NOT NULL, region text,
  submission_count integer NOT NULL DEFAULT 0, weighted_score numeric NOT NULL DEFAULT 0,
  agreement_ratio numeric NOT NULL DEFAULT 0, confidence numeric NOT NULL DEFAULT 0,
  status public.candidate_status NOT NULL DEFAULT 'pending',
  reviewer_note text, reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_word_id, language_id, normalized_text)
);
CREATE INDEX IF NOT EXISTS idx_candidates_lang_conf ON public.candidates(language_id, confidence DESC);
GRANT SELECT ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'coverage', kind text NOT NULL DEFAULT 'translate',
  created_at timestamptz NOT NULL DEFAULT now(), answered_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  translated_text text NOT NULL, normalized_text text NOT NULL,
  cultural_note text, region text,
  weight_at_submit numeric NOT NULL DEFAULT 1, agreed_with_consensus boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, base_word_id, language_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_word_lang ON public.submissions(base_word_id, language_id);
GRANT SELECT, INSERT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.badges (
  code text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
  icon text NOT NULL DEFAULT 'Sparkles', tier text NOT NULL DEFAULT 'bronze',
  xp_reward integer NOT NULL DEFAULT 25, sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_code)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies (has_role already defined above) ──────────
DROP POLICY IF EXISTS "languages public read" ON public.languages;
CREATE POLICY "languages public read" ON public.languages FOR SELECT USING (true);

DROP POLICY IF EXISTS "base words public read" ON public.base_words;
CREATE POLICY "base words public read" ON public.base_words FOR SELECT USING (true);

DROP POLICY IF EXISTS "badges public read" ON public.badges;
CREATE POLICY "badges public read" ON public.badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "verified corpus public read" ON public.translations;
CREATE POLICY "verified corpus public read" ON public.translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "history reviewer read" ON public.translation_history;
DROP POLICY IF EXISTS "history public read" ON public.translation_history;
CREATE POLICY "history reviewer read" ON public.translation_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "candidates public read" ON public.candidates;
DROP POLICY IF EXISTS "candidates reviewer read" ON public.candidates;
CREATE POLICY "candidates public read" ON public.candidates FOR SELECT USING (true);
DROP POLICY IF EXISTS "reviewers update candidates" ON public.candidates;
CREATE POLICY "reviewers update candidates" ON public.candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "profiles readable by all" ON public.profiles;
DROP POLICY IF EXISTS "profiles readable by members" ON public.profiles;
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "see own roles" ON public.user_roles;
CREATE POLICY "see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own badges read" ON public.user_badges;
DROP POLICY IF EXISTS "user badges member read" ON public.user_badges;
DROP POLICY IF EXISTS "user badges public read" ON public.user_badges;
CREATE POLICY "own badges read" ON public.user_badges FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own xp events" ON public.xp_events;
CREATE POLICY "own xp events" ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own challenges" ON public.challenges;
CREATE POLICY "own challenges" ON public.challenges FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own submissions read" ON public.submissions;
CREATE POLICY "own submissions read" ON public.submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own submissions insert" ON public.submissions;
CREATE POLICY "own submissions insert" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── 5. Remaining functions & triggers ─────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_text(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(btrim(_t)), '[^a-z0-9 ]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Player'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'contributor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.recompute_candidates(_base_word_id bigint, _language_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_weight numeric; total_count integer;
BEGIN
  SELECT COALESCE(sum(s.weight_at_submit),0), count(*) INTO total_weight, total_count
  FROM public.submissions s WHERE s.base_word_id=_base_word_id AND s.language_id=_language_id;
  IF total_weight=0 THEN RETURN; END IF;
  INSERT INTO public.candidates
    (base_word_id,language_id,normalized_text,display_text,submission_count,weighted_score,agreement_ratio,confidence)
  SELECT _base_word_id,_language_id,s.normalized_text,
    (array_agg(s.translated_text ORDER BY s.created_at))[1],
    count(*),sum(s.weight_at_submit),
    sum(s.weight_at_submit)/total_weight,
    round((sum(s.weight_at_submit)/total_weight)*(1-exp(-total_count::numeric/4.0)),4)
  FROM public.submissions s
  WHERE s.base_word_id=_base_word_id AND s.language_id=_language_id
  GROUP BY s.normalized_text
  ON CONFLICT (base_word_id,language_id,normalized_text) DO UPDATE SET
    submission_count=EXCLUDED.submission_count, weighted_score=EXCLUDED.weighted_score,
    agreement_ratio=EXCLUDED.agreement_ratio, confidence=EXCLUDED.confidence,
    display_text=EXCLUDED.display_text, updated_at=now();
  UPDATE public.candidates c SET status='queued'
  WHERE c.base_word_id=_base_word_id AND c.language_id=_language_id
    AND c.status='pending' AND c.confidence>=0.6 AND c.submission_count>=3;
  UPDATE public.submissions s
  SET agreed_with_consensus=(s.normalized_text=lead.normalized_text)
  FROM (SELECT normalized_text FROM public.candidates
        WHERE base_word_id=_base_word_id AND language_id=_language_id
        ORDER BY weighted_score DESC LIMIT 1) lead
  WHERE s.base_word_id=_base_word_id AND s.language_id=_language_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_submission_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t numeric;
BEGIN
  NEW.normalized_text := public.normalize_text(NEW.translated_text);
  SELECT trust_score INTO t FROM public.profiles WHERE id=NEW.user_id;
  NEW.weight_at_submit := GREATEST(0.2, COALESCE(t,50)/50.0);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_submission_defaults ON public.submissions;
CREATE TRIGGER trg_submission_defaults BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_submission_defaults();

CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_words integer; n_notes integer; n_langs integer; n_agree integer;
  p public.profiles%ROWTYPE; earned text[]; b record;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id=_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*),
    count(*) FILTER (WHERE cultural_note IS NOT NULL AND length(btrim(cultural_note))>0),
    count(DISTINCT language_id),
    count(*) FILTER (WHERE agreed_with_consensus)
  INTO n_words,n_notes,n_langs,n_agree
  FROM public.submissions WHERE user_id=_user_id;
  earned := ARRAY[]::text[];
  IF n_words>=1   THEN earned:=array_append(earned,'first_word'); END IF;
  IF n_words>=10  THEN earned:=array_append(earned,'words_10');   END IF;
  IF n_words>=50  THEN earned:=array_append(earned,'words_50');   END IF;
  IF n_words>=100 THEN earned:=array_append(earned,'words_100');  END IF;
  IF n_words>=250 THEN earned:=array_append(earned,'words_250');  END IF;
  IF p.streak_longest>=3  THEN earned:=array_append(earned,'streak_3');  END IF;
  IF p.streak_longest>=7  THEN earned:=array_append(earned,'streak_7');  END IF;
  IF p.streak_longest>=30 THEN earned:=array_append(earned,'streak_30'); END IF;
  IF p.days_goal_met>=1   THEN earned:=array_append(earned,'goal_1');    END IF;
  IF p.days_goal_met>=10  THEN earned:=array_append(earned,'goal_10');   END IF;
  IF n_notes>=10  THEN earned:=array_append(earned,'notes_10'); END IF;
  IF n_langs>=3   THEN earned:=array_append(earned,'langs_3');  END IF;
  IF n_langs>=6   THEN earned:=array_append(earned,'langs_6');  END IF;
  IF n_agree>=25  THEN earned:=array_append(earned,'agree_25'); END IF;
  IF p.trust_score>=85 THEN earned:=array_append(earned,'trust_85'); END IF;
  FOR b IN SELECT bd.code,bd.xp_reward,bd.name FROM public.badges bd
    WHERE bd.code=ANY(earned)
      AND NOT EXISTS(SELECT 1 FROM public.user_badges ub WHERE ub.user_id=_user_id AND ub.badge_code=bd.code)
  LOOP
    INSERT INTO public.user_badges(user_id,badge_code) VALUES(_user_id,b.code) ON CONFLICT DO NOTHING;
    INSERT INTO public.xp_events(user_id,amount,reason) VALUES(_user_id,b.xp_reward,'Badge unlocked: '||b.name);
    UPDATE public.profiles SET xp=xp+b.xp_reward, gems=gems+1 WHERE id=_user_id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.after_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE; gained integer:=10; new_streak integer;
  agree_rate numeric; sample integer; today_count integer;
  reason text:='Translation locked in';
BEGIN
  PERFORM public.recompute_candidates(NEW.base_word_id,NEW.language_id);
  SELECT * INTO p FROM public.profiles WHERE id=NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF p.last_played_on=CURRENT_DATE THEN new_streak:=GREATEST(p.streak_current,1);
  ELSIF p.last_played_on=CURRENT_DATE-1 THEN new_streak:=p.streak_current+1;
  ELSE new_streak:=1; END IF;
  SELECT count(*) INTO today_count FROM public.submissions
  WHERE user_id=NEW.user_id AND created_at::date=CURRENT_DATE;
  gained:=gained+LEAST(new_streak,10)*2+LEAST(today_count-1,5)*2;
  IF NEW.cultural_note IS NOT NULL AND length(btrim(NEW.cultural_note))>0 THEN
    gained:=gained+5; reason:=reason||' + cultural note'; END IF;
  IF today_count=1 THEN gained:=gained+15; reason:=reason||' + first of the day'; END IF;
  IF today_count=p.daily_goal THEN gained:=gained+50; reason:=reason||' + daily goal complete'; END IF;
  SELECT count(*), COALESCE(avg(CASE WHEN agreed_with_consensus THEN 1 ELSE 0 END),0)
  INTO sample,agree_rate FROM public.submissions
  WHERE user_id=NEW.user_id AND agreed_with_consensus IS NOT NULL;
  UPDATE public.profiles SET
    xp=xp+gained, streak_current=new_streak, streak_longest=GREATEST(streak_longest,new_streak),
    last_played_on=CURRENT_DATE, best_day_count=GREATEST(best_day_count,today_count),
    days_goal_met=days_goal_met+CASE WHEN today_count=p.daily_goal THEN 1 ELSE 0 END,
    gems=gems+CASE WHEN today_count=p.daily_goal THEN 3 ELSE 0 END,
    freeze_tokens=LEAST(freeze_tokens+CASE WHEN new_streak>0 AND new_streak%7=0 AND today_count=1 THEN 1 ELSE 0 END,3),
    trust_score=round(((50*8)+(agree_rate*100*sample))/(8+sample),2)
  WHERE id=NEW.user_id;
  INSERT INTO public.xp_events(user_id,amount,reason)
  VALUES(NEW.user_id,gained,reason||' (streak x'||new_streak||')');
  PERFORM public.evaluate_badges(NEW.user_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_after_submission ON public.submissions;
CREATE TRIGGER trg_after_submission AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.after_submission();

CREATE OR REPLACE FUNCTION public.use_streak_freeze()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id=auth.uid();
  IF p.freeze_tokens<1 THEN RETURN false; END IF;
  IF p.last_played_on IS NULL OR p.last_played_on>=CURRENT_DATE-1 THEN RETURN false; END IF;
  UPDATE public.profiles SET freeze_tokens=freeze_tokens-1, last_played_on=CURRENT_DATE-1 WHERE id=auth.uid();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.next_challenge(_language_id bigint)
RETURNS TABLE(base_word_id bigint,swahili_word text,english_word text,category text,reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH answered AS (
    SELECT s.base_word_id FROM public.submissions s WHERE s.user_id=auth.uid() AND s.language_id=_language_id
  ), stats AS (
    SELECT b.id,b.swahili_word,b.english_word,b.category,
      (SELECT count(*) FROM public.submissions s WHERE s.base_word_id=b.id AND s.language_id=_language_id) AS obs,
      (SELECT count(*) FROM public.candidates c WHERE c.base_word_id=b.id AND c.language_id=_language_id) AS variants,
      (SELECT COALESCE(max(c.confidence),0) FROM public.candidates c WHERE c.base_word_id=b.id AND c.language_id=_language_id) AS best_conf,
      EXISTS(SELECT 1 FROM public.translations t WHERE t.base_word_id=b.id AND t.language_id=_language_id AND t.status='verified') AS verified
    FROM public.base_words b WHERE b.id NOT IN(SELECT base_word_id FROM answered)
  )
  SELECT id,swahili_word,english_word,category,
    CASE WHEN obs=0 THEN 'No observations yet'
         WHEN variants>1 AND best_conf<0.75 THEN 'Contributors disagree here'
         WHEN best_conf<0.6 THEN 'Low confidence — needs corroboration'
         ELSE 'Corpus coverage' END
  FROM stats WHERE NOT verified
  ORDER BY (CASE WHEN obs=0 THEN 0 WHEN variants>1 AND best_conf<0.75 THEN 1 WHEN best_conf<0.6 THEN 2 ELSE 3 END),random()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.consensus_candidates(_language_id bigint DEFAULT NULL, _base_word_id bigint DEFAULT NULL)
RETURNS TABLE(
  id uuid, base_word_id bigint, language_id bigint,
  swahili_word text, english_word text, category text,
  display_text text, normalized_text text, region text,
  submission_count integer, weighted_score numeric,
  agreement_ratio numeric, confidence numeric, status public.candidate_status,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,c.base_word_id,c.language_id,b.swahili_word,b.english_word,b.category,
    c.display_text,c.normalized_text,c.region,c.submission_count,c.weighted_score,
    c.agreement_ratio,c.confidence,c.status,c.created_at,c.updated_at
  FROM public.candidates c JOIN public.base_words b ON b.id=c.base_word_id
  WHERE auth.uid() IS NOT NULL
    AND (_language_id IS NULL OR c.language_id=_language_id)
    AND (_base_word_id IS NULL OR c.base_word_id=_base_word_id)
  ORDER BY c.weighted_score DESC LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE(user_id uuid,display_name text,xp integer,trust_score numeric,streak_current integer,submissions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,p.display_name,p.xp,p.trust_score,p.streak_current,
    (SELECT count(*) FROM public.submissions s WHERE s.user_id=p.id)
  FROM public.profiles p WHERE auth.uid() IS NOT NULL ORDER BY p.xp DESC LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.weekly_league()
RETURNS TABLE(user_id uuid,display_name text,week_xp integer,streak_current integer,trust_score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,p.display_name,COALESCE(sum(e.amount),0)::int,p.streak_current,p.trust_score
  FROM public.profiles p
  LEFT JOIN public.xp_events e ON e.user_id=p.id AND e.created_at>=date_trunc('week',now())
  GROUP BY p.id,p.display_name,p.streak_current,p.trust_score
  HAVING COALESCE(sum(e.amount),0)>0 ORDER BY 3 DESC LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.player_stats()
RETURNS TABLE(today_count integer,total_words integer,notes integer,languages integer,
              agreed integer,verified integer,week_xp integer,rank integer,badges integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.submissions WHERE user_id=auth.uid() AND created_at::date=CURRENT_DATE),
    (SELECT count(*)::int FROM public.submissions WHERE user_id=auth.uid()),
    (SELECT count(*)::int FROM public.submissions WHERE user_id=auth.uid() AND cultural_note IS NOT NULL AND length(btrim(cultural_note))>0),
    (SELECT count(DISTINCT language_id)::int FROM public.submissions WHERE user_id=auth.uid()),
    (SELECT count(*)::int FROM public.submissions WHERE user_id=auth.uid() AND agreed_with_consensus),
    (SELECT count(*)::int FROM public.submissions s
       JOIN public.translations t ON t.base_word_id=s.base_word_id AND t.language_id=s.language_id
        AND public.normalize_text(t.translated_text)=s.normalized_text WHERE s.user_id=auth.uid()),
    (SELECT COALESCE(sum(amount),0)::int FROM public.xp_events WHERE user_id=auth.uid() AND created_at>=date_trunc('week',now())),
    (SELECT(count(*)+1)::int FROM public.profiles WHERE xp>(SELECT xp FROM public.profiles WHERE id=auth.uid())),
    (SELECT count(*)::int FROM public.user_badges WHERE user_id=auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin')
$$;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES(auth.uid(),'admin'),(auth.uid(),'reviewer') ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.promote_candidate(_candidate_id uuid, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.candidates%ROWTYPE; prev public.translations%ROWTYPE; new_id uuid;
BEGIN
  IF NOT(public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only reviewers can promote candidates'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id=_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  SELECT * INTO prev FROM public.translations
   WHERE base_word_id=c.base_word_id AND language_id=c.language_id AND status='verified'
   ORDER BY version DESC LIMIT 1;
  INSERT INTO public.translations(base_word_id,language_id,translated_text,cultural_note,status,version,supersedes_id,confidence,verified_by)
  VALUES(c.base_word_id,c.language_id,c.display_text,NULL,'verified',COALESCE(prev.version,0)+1,prev.id,c.confidence,auth.uid())
  RETURNING id INTO new_id;
  IF prev.id IS NOT NULL THEN
    UPDATE public.translations SET status='archived' WHERE id=prev.id;
    INSERT INTO public.translation_history(translation_id,event_type,previous_status,new_status,actor_id,comment)
    VALUES(prev.id,'superseded','verified','archived',auth.uid(),_note); END IF;
  INSERT INTO public.translation_history(translation_id,candidate_id,event_type,new_status,actor_id,comment)
  VALUES(new_id,c.id,'verified','verified',auth.uid(),_note);
  UPDATE public.candidates SET status='promoted',reviewer_note=_note,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=c.id;
  UPDATE public.candidates SET status='rejected',reviewed_by=auth.uid(),reviewed_at=now()
   WHERE base_word_id=c.base_word_id AND language_id=c.language_id AND id<>c.id AND status<>'promoted';
  INSERT INTO public.xp_events(user_id,amount,reason)
  SELECT s.user_id,25,'Your translation was verified into the corpus'
  FROM public.submissions s WHERE s.base_word_id=c.base_word_id AND s.language_id=c.language_id AND s.normalized_text=c.normalized_text;
  UPDATE public.profiles p SET xp=p.xp+25
  FROM public.submissions s WHERE s.user_id=p.id AND s.base_word_id=c.base_word_id AND s.language_id=c.language_id AND s.normalized_text=c.normalized_text;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_candidate(_candidate_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT(public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only reviewers can reject candidates'; END IF;
  UPDATE public.candidates SET status='rejected',reviewer_note=_note,reviewed_by=auth.uid(),reviewed_at=now()
  WHERE id=_candidate_id;
END; $$;

-- ── 6. Grants ─────────────────────────────────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_challenge(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consensus_candidates(bigint,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze() TO authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_league() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_candidate(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_candidate(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_text(text) TO authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, daily_goal) ON public.profiles TO authenticated;

-- ── 7. Seed data ──────────────────────────────────────────────
INSERT INTO public.languages(code,name,family,target_word_count) VALUES
  ('suk','Kisukuma','Bantu',500),('chg','Kichagga','Bantu',500),('hay','Luhaya','Bantu',500),
  ('nyy','Kinyakyusa','Bantu',500),('heh','Kihehe','Bantu',500),('gog','Kigogo','Bantu',500),
  ('kde','Kimakonde','Bantu',500),('mas','Kimasaai','Nilotic',500),('rim','Kinyaturu','Bantu',500),
  ('ksb','Kishambaa','Bantu',500)
ON CONFLICT(code) DO NOTHING;

INSERT INTO public.base_words(swahili_word,english_word,category) VALUES
  ('habari','hello / news','Greetings'),('asante','thank you','Greetings'),
  ('karibu','welcome','Greetings'),('kwaheri','goodbye','Greetings'),('tafadhali','please','Greetings'),
  ('moja','one','Numbers'),('mbili','two','Numbers'),('tatu','three','Numbers'),
  ('nne','four','Numbers'),('tano','five','Numbers'),
  ('maji','water','Basic Needs'),('chakula','food','Basic Needs'),
  ('nyumba','house','Basic Needs'),('moto','fire','Basic Needs'),
  ('mama','mother','Family'),('baba','father','Family'),('mtoto','child','Family'),('ndugu','sibling','Family'),
  ('soko','market','Market'),('pesa','money','Market'),('bei','price','Market'),('kununua','to buy','Market'),
  ('msaada','help','Emergency'),('hospitali','hospital','Emergency'),('hatari','danger','Emergency'),
  ('leo','today','Time'),('kesho','tomorrow','Time'),('jana','yesterday','Time'),('usiku','night','Time'),
  ('nyekundu','red','Colors'),('nyeusi','black','Colors'),('nyeupe','white','Colors'),('kijani','green','Colors')
ON CONFLICT(swahili_word) DO NOTHING;

INSERT INTO public.badges(code,name,description,icon,tier,xp_reward,sort_order) VALUES
  ('first_word','First Words','Lock in your very first translation','Sparkles','bronze',20,1),
  ('words_10','Getting Fluent','Contribute 10 translations','Feather','bronze',30,2),
  ('words_50','Word Keeper','Contribute 50 translations','BookOpen','silver',75,3),
  ('words_100','Corpus Builder','Contribute 100 translations','Library','gold',150,4),
  ('words_250','Living Archive','Contribute 250 translations','Landmark','legend',300,5),
  ('streak_3','Warming Up','Play 3 days in a row','Flame','bronze',25,6),
  ('streak_7','Week of Fire','Play 7 days in a row','Flame','silver',80,7),
  ('streak_30','Unbroken','Play 30 days in a row','Flame','legend',400,8),
  ('goal_1','Goal Getter','Finish your daily goal once','Target','bronze',25,9),
  ('goal_10','Relentless','Finish your daily goal 10 times','Target','gold',200,10),
  ('notes_10','Storyteller','Add 10 cultural notes','ScrollText','silver',60,11),
  ('langs_3','Bridge Builder','Contribute to 3 different languages','Languages','silver',70,12),
  ('langs_6','Pan-Tanzanian','Contribute to 6 different languages','Globe','gold',180,13),
  ('agree_25','In Harmony','Match community consensus 25 times','Users','silver',90,14),
  ('verified_1','Made It Official','Have a translation verified into the corpus','ShieldCheck','gold',120,15),
  ('trust_85','Trusted Elder','Reach a trust score of 85','Crown','legend',250,16)
ON CONFLICT(code) DO NOTHING;

-- =================================================================
-- Done. All tables, policies, functions, triggers and seed data ready.
-- =================================================================
