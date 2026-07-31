
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('contributor','reviewer','admin');
CREATE TYPE public.translation_status AS ENUM ('verified','archived');
CREATE TYPE public.candidate_status AS ENUM ('pending','queued','promoted','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Anonymous',
  xp integer NOT NULL DEFAULT 0,
  trust_score numeric NOT NULL DEFAULT 50,
  streak_current integer NOT NULL DEFAULT 0,
  streak_longest integer NOT NULL DEFAULT 0,
  last_played_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Player'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'contributor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATALOG
CREATE TABLE public.languages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  family text NOT NULL,
  target_word_count integer NOT NULL DEFAULT 500
);
GRANT SELECT ON public.languages TO anon, authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "languages public read" ON public.languages FOR SELECT USING (true);

CREATE TABLE public.base_words (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  swahili_word text NOT NULL,
  english_word text NOT NULL,
  category text NOT NULL,
  UNIQUE (swahili_word)
);
GRANT SELECT ON public.base_words TO anon, authenticated;
GRANT ALL ON public.base_words TO service_role;
ALTER TABLE public.base_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "base words public read" ON public.base_words FOR SELECT USING (true);

-- CANONICAL CORPUS (immutable, versioned)
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  translated_text text NOT NULL,
  cultural_note text,
  status public.translation_status NOT NULL DEFAULT 'verified',
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.translations(id),
  confidence numeric,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.translations (base_word_id, language_id);
GRANT SELECT ON public.translations TO anon, authenticated;
GRANT ALL ON public.translations TO service_role;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verified corpus public read" ON public.translations FOR SELECT USING (true);

CREATE TABLE public.translation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid REFERENCES public.translations(id) ON DELETE CASCADE,
  candidate_id uuid,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  comment text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.translation_history TO anon, authenticated;
GRANT ALL ON public.translation_history TO service_role;
ALTER TABLE public.translation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history public read" ON public.translation_history FOR SELECT USING (true);

-- CANDIDATES (consensus layer, separate from corpus)
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  normalized_text text NOT NULL,
  display_text text NOT NULL,
  region text,
  submission_count integer NOT NULL DEFAULT 0,
  weighted_score numeric NOT NULL DEFAULT 0,
  agreement_ratio numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  status public.candidate_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_word_id, language_id, normalized_text)
);
CREATE INDEX ON public.candidates (language_id, confidence DESC);
GRANT SELECT ON public.candidates TO anon, authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates public read" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "reviewers update candidates" ON public.candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));

-- CHALLENGES
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'coverage',
  kind text NOT NULL DEFAULT 'translate',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges" ON public.challenges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SUBMISSIONS (locked answers)
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  base_word_id bigint NOT NULL REFERENCES public.base_words(id) ON DELETE CASCADE,
  language_id bigint NOT NULL REFERENCES public.languages(id) ON DELETE CASCADE,
  translated_text text NOT NULL,
  normalized_text text NOT NULL,
  cultural_note text,
  region text,
  weight_at_submit numeric NOT NULL DEFAULT 1,
  agreed_with_consensus boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, base_word_id, language_id)
);
CREATE INDEX ON public.submissions (base_word_id, language_id);
GRANT SELECT, INSERT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own submissions read" ON public.submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own submissions insert" ON public.submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- XP EVENTS
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp events" ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- NORMALIZER
CREATE OR REPLACE FUNCTION public.normalize_text(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(btrim(_t)), '[^a-z0-9 ]', '', 'g')
$$;

-- CONSENSUS ENGINE
CREATE OR REPLACE FUNCTION public.recompute_candidates(_base_word_id bigint, _language_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_weight numeric;
  total_count integer;
BEGIN
  SELECT COALESCE(sum(s.weight_at_submit),0), count(*) INTO total_weight, total_count
  FROM public.submissions s
  WHERE s.base_word_id = _base_word_id AND s.language_id = _language_id;

  IF total_weight = 0 THEN RETURN; END IF;

  INSERT INTO public.candidates (base_word_id, language_id, normalized_text, display_text, submission_count, weighted_score, agreement_ratio, confidence)
  SELECT _base_word_id, _language_id, s.normalized_text,
         (array_agg(s.translated_text ORDER BY s.created_at))[1],
         count(*), sum(s.weight_at_submit),
         sum(s.weight_at_submit) / total_weight,
         round((sum(s.weight_at_submit) / total_weight) * (1 - exp(-total_count::numeric / 4.0)), 4)
  FROM public.submissions s
  WHERE s.base_word_id = _base_word_id AND s.language_id = _language_id
  GROUP BY s.normalized_text
  ON CONFLICT (base_word_id, language_id, normalized_text) DO UPDATE
  SET submission_count = EXCLUDED.submission_count,
      weighted_score = EXCLUDED.weighted_score,
      agreement_ratio = EXCLUDED.agreement_ratio,
      confidence = EXCLUDED.confidence,
      display_text = EXCLUDED.display_text,
      updated_at = now();

  -- queue strong candidates for reviewers
  UPDATE public.candidates c
  SET status = 'queued'
  WHERE c.base_word_id = _base_word_id AND c.language_id = _language_id
    AND c.status = 'pending' AND c.confidence >= 0.6 AND c.submission_count >= 3;

  -- mark which submissions agreed with the leading candidate
  UPDATE public.submissions s
  SET agreed_with_consensus = (s.normalized_text = lead.normalized_text)
  FROM (
    SELECT normalized_text FROM public.candidates
    WHERE base_word_id = _base_word_id AND language_id = _language_id
    ORDER BY weighted_score DESC LIMIT 1
  ) lead
  WHERE s.base_word_id = _base_word_id AND s.language_id = _language_id;
END; $$;

-- TRUST + XP + STREAKS ON SUBMISSION
CREATE OR REPLACE FUNCTION public.after_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  gained integer := 10;
  new_streak integer;
  agree_rate numeric;
  sample integer;
BEGIN
  PERFORM public.recompute_candidates(NEW.base_word_id, NEW.language_id);

  SELECT * INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF p.last_played_on = CURRENT_DATE THEN
    new_streak := GREATEST(p.streak_current, 1);
  ELSIF p.last_played_on = CURRENT_DATE - 1 THEN
    new_streak := p.streak_current + 1;
  ELSE
    new_streak := 1;
  END IF;

  gained := gained + LEAST(new_streak, 10) * 2;
  IF NEW.cultural_note IS NOT NULL AND length(btrim(NEW.cultural_note)) > 0 THEN
    gained := gained + 5;
  END IF;

  SELECT count(*), COALESCE(avg(CASE WHEN agreed_with_consensus THEN 1 ELSE 0 END),0)
    INTO sample, agree_rate
  FROM public.submissions
  WHERE user_id = NEW.user_id AND agreed_with_consensus IS NOT NULL;

  UPDATE public.profiles
  SET xp = xp + gained,
      streak_current = new_streak,
      streak_longest = GREATEST(streak_longest, new_streak),
      last_played_on = CURRENT_DATE,
      -- Bayesian-smoothed trust: starts at 50, converges on the user's agreement rate
      trust_score = round(((50 * 8) + (agree_rate * 100 * sample)) / (8 + sample), 2)
  WHERE id = NEW.user_id;

  INSERT INTO public.xp_events (user_id, amount, reason)
  VALUES (NEW.user_id, gained, 'Submitted a translation (streak x' || new_streak || ')');

  RETURN NEW;
END; $$;
CREATE TRIGGER trg_after_submission AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.after_submission();

CREATE OR REPLACE FUNCTION public.set_submission_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t numeric;
BEGIN
  NEW.normalized_text := public.normalize_text(NEW.translated_text);
  SELECT trust_score INTO t FROM public.profiles WHERE id = NEW.user_id;
  NEW.weight_at_submit := GREATEST(0.2, COALESCE(t,50) / 50.0);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_submission_defaults BEFORE INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.set_submission_defaults();

-- PROMOTION (reviewer action -> immutable corpus)
CREATE OR REPLACE FUNCTION public.promote_candidate(_candidate_id uuid, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.candidates%ROWTYPE;
  prev public.translations%ROWTYPE;
  new_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only reviewers can promote candidates';
  END IF;
  SELECT * INTO c FROM public.candidates WHERE id = _candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;

  SELECT * INTO prev FROM public.translations
   WHERE base_word_id = c.base_word_id AND language_id = c.language_id AND status = 'verified'
   ORDER BY version DESC LIMIT 1;

  INSERT INTO public.translations (base_word_id, language_id, translated_text, cultural_note, status, version, supersedes_id, confidence, verified_by)
  VALUES (c.base_word_id, c.language_id, c.display_text, NULL, 'verified',
          COALESCE(prev.version,0) + 1, prev.id, c.confidence, auth.uid())
  RETURNING id INTO new_id;

  IF prev.id IS NOT NULL THEN
    UPDATE public.translations SET status = 'archived' WHERE id = prev.id;
    INSERT INTO public.translation_history (translation_id, event_type, previous_status, new_status, actor_id, comment)
    VALUES (prev.id, 'superseded', 'verified', 'archived', auth.uid(), _note);
  END IF;

  INSERT INTO public.translation_history (translation_id, candidate_id, event_type, new_status, actor_id, comment)
  VALUES (new_id, c.id, 'verified', 'verified', auth.uid(), _note);

  UPDATE public.candidates SET status = 'promoted', reviewer_note = _note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = c.id;
  UPDATE public.candidates SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   WHERE base_word_id = c.base_word_id AND language_id = c.language_id AND id <> c.id AND status <> 'promoted';

  -- reward contributors whose submission matched the promoted text
  INSERT INTO public.xp_events (user_id, amount, reason)
  SELECT s.user_id, 25, 'Your translation was verified into the corpus'
  FROM public.submissions s
  WHERE s.base_word_id = c.base_word_id AND s.language_id = c.language_id AND s.normalized_text = c.normalized_text;

  UPDATE public.profiles p SET xp = p.xp + 25
  FROM public.submissions s
  WHERE s.user_id = p.id AND s.base_word_id = c.base_word_id AND s.language_id = c.language_id AND s.normalized_text = c.normalized_text;

  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_candidate(_candidate_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'reviewer') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only reviewers can reject candidates';
  END IF;
  UPDATE public.candidates SET status = 'rejected', reviewer_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _candidate_id;
END; $$;

-- ADAPTIVE CHALLENGE PICKER
CREATE OR REPLACE FUNCTION public.next_challenge(_language_id bigint)
RETURNS TABLE (base_word_id bigint, swahili_word text, english_word text, category text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH answered AS (
    SELECT s.base_word_id FROM public.submissions s
    WHERE s.user_id = auth.uid() AND s.language_id = _language_id
  ), stats AS (
    SELECT b.id, b.swahili_word, b.english_word, b.category,
      (SELECT count(*) FROM public.submissions s WHERE s.base_word_id = b.id AND s.language_id = _language_id) AS obs,
      (SELECT count(*) FROM public.candidates c WHERE c.base_word_id = b.id AND c.language_id = _language_id) AS variants,
      (SELECT COALESCE(max(c.confidence),0) FROM public.candidates c WHERE c.base_word_id = b.id AND c.language_id = _language_id) AS best_conf,
      EXISTS (SELECT 1 FROM public.translations t WHERE t.base_word_id = b.id AND t.language_id = _language_id AND t.status='verified') AS verified
    FROM public.base_words b
    WHERE b.id NOT IN (SELECT base_word_id FROM answered)
  )
  SELECT id, swahili_word, english_word, category,
    CASE WHEN obs = 0 THEN 'No observations yet'
         WHEN variants > 1 AND best_conf < 0.75 THEN 'Contributors disagree here'
         WHEN best_conf < 0.6 THEN 'Low confidence — needs corroboration'
         ELSE 'Corpus coverage' END
  FROM stats
  WHERE NOT verified
  ORDER BY (CASE WHEN obs = 0 THEN 0 WHEN variants > 1 AND best_conf < 0.75 THEN 1 WHEN best_conf < 0.6 THEN 2 ELSE 3 END), random()
  LIMIT 1
$$;

-- LEADERBOARD
CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE (display_name text, xp integer, trust_score numeric, streak_current integer, submissions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.display_name, p.xp, p.trust_score, p.streak_current,
         (SELECT count(*) FROM public.submissions s WHERE s.user_id = p.id)
  FROM public.profiles p ORDER BY p.xp DESC LIMIT 20
$$;

-- SEED
INSERT INTO public.languages (code, name, family, target_word_count) VALUES
 ('suk','Kisukuma','Bantu',500),('chg','Kichagga','Bantu',500),('hay','Luhaya','Bantu',500),
 ('nyy','Kinyakyusa','Bantu',500),('heh','Kihehe','Bantu',500),('gog','Kigogo','Bantu',500),
 ('kde','Kimakonde','Bantu',500),('mas','Kimasaai','Nilotic',500),('rim','Kinyaturu','Bantu',500),
 ('ksb','Kishambaa','Bantu',500);

INSERT INTO public.base_words (swahili_word, english_word, category) VALUES
 ('habari','hello / news','Greetings'),('asante','thank you','Greetings'),('karibu','welcome','Greetings'),
 ('kwaheri','goodbye','Greetings'),('tafadhali','please','Greetings'),
 ('moja','one','Numbers'),('mbili','two','Numbers'),('tatu','three','Numbers'),('nne','four','Numbers'),('tano','five','Numbers'),
 ('maji','water','Basic Needs'),('chakula','food','Basic Needs'),('nyumba','house','Basic Needs'),('moto','fire','Basic Needs'),
 ('mama','mother','Family'),('baba','father','Family'),('mtoto','child','Family'),('ndugu','sibling','Family'),
 ('soko','market','Market'),('pesa','money','Market'),('bei','price','Market'),('kununua','to buy','Market'),
 ('msaada','help','Emergency'),('hospitali','hospital','Emergency'),('hatari','danger','Emergency'),
 ('leo','today','Time'),('kesho','tomorrow','Time'),('jana','yesterday','Time'),('usiku','night','Time'),
 ('nyekundu','red','Colors'),('nyeusi','black','Colors'),('nyeupe','white','Colors'),('kijani','green','Colors');
