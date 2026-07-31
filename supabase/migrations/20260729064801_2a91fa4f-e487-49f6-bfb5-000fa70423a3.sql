
-- ---------- profile extras ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_goal integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS freeze_tokens integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS best_day_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_goal_met integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;

-- ---------- badge catalog ----------
CREATE TABLE public.badges (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  tier text NOT NULL DEFAULT 'bronze',
  xp_reward integer NOT NULL DEFAULT 25,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges public read" ON public.badges FOR SELECT USING (true);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_code)
);
CREATE INDEX ON public.user_badges (user_id);
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user badges public read" ON public.user_badges FOR SELECT USING (true);

INSERT INTO public.badges (code, name, description, icon, tier, xp_reward, sort_order) VALUES
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
 ('trust_85','Trusted Elder','Reach a trust score of 85','Crown','legend',250,16);

-- ---------- badge engine ----------
CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_words integer; n_notes integer; n_langs integer; n_agree integer; n_verified integer;
  p public.profiles%ROWTYPE;
  earned text[];
  b record;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE cultural_note IS NOT NULL AND length(btrim(cultural_note)) > 0),
         count(DISTINCT language_id),
         count(*) FILTER (WHERE agreed_with_consensus)
    INTO n_words, n_notes, n_langs, n_agree
  FROM public.submissions WHERE user_id = _user_id;

  SELECT count(*) INTO n_verified
  FROM public.submissions s
  JOIN public.translations t
    ON t.base_word_id = s.base_word_id
   AND t.language_id = s.language_id
   AND public.normalize_text(t.translated_text) = s.normalized_text
  WHERE s.user_id = _user_id;

  earned := ARRAY[]::text[];
  IF n_words >= 1   THEN earned := earned || 'first_word'; END IF;
  IF n_words >= 10  THEN earned := earned || 'words_10';   END IF;
  IF n_words >= 50  THEN earned := earned || 'words_50';   END IF;
  IF n_words >= 100 THEN earned := earned || 'words_100';  END IF;
  IF n_words >= 250 THEN earned := earned || 'words_250';  END IF;
  IF p.streak_longest >= 3  THEN earned := earned || 'streak_3';  END IF;
  IF p.streak_longest >= 7  THEN earned := earned || 'streak_7';  END IF;
  IF p.streak_longest >= 30 THEN earned := earned || 'streak_30'; END IF;
  IF p.days_goal_met >= 1   THEN earned := earned || 'goal_1';    END IF;
  IF p.days_goal_met >= 10  THEN earned := earned || 'goal_10';   END IF;
  IF n_notes >= 10 THEN earned := earned || 'notes_10'; END IF;
  IF n_langs >= 3  THEN earned := earned || 'langs_3';  END IF;
  IF n_langs >= 6  THEN earned := earned || 'langs_6';  END IF;
  IF n_agree >= 25 THEN earned := earned || 'agree_25'; END IF;
  IF n_verified >= 1 THEN earned := earned || 'verified_1'; END IF;
  IF p.trust_score >= 85 THEN earned := earned || 'trust_85'; END IF;

  FOR b IN
    SELECT bd.code, bd.xp_reward, bd.name
    FROM public.badges bd
    WHERE bd.code = ANY(earned)
      AND NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = _user_id AND ub.badge_code = bd.code)
  LOOP
    INSERT INTO public.user_badges (user_id, badge_code) VALUES (_user_id, b.code)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.xp_events (user_id, amount, reason)
    VALUES (_user_id, b.xp_reward, 'Badge unlocked: ' || b.name);
    UPDATE public.profiles SET xp = xp + b.xp_reward, gems = gems + 1 WHERE id = _user_id;
  END LOOP;
END; $$;

-- ---------- reward engine on submission ----------
CREATE OR REPLACE FUNCTION public.after_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  gained integer := 10;
  new_streak integer;
  agree_rate numeric;
  sample integer;
  today_count integer;
  reason text := 'Translation locked in';
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

  SELECT count(*) INTO today_count
  FROM public.submissions
  WHERE user_id = NEW.user_id AND created_at::date = CURRENT_DATE;

  -- streak bonus
  gained := gained + LEAST(new_streak, 10) * 2;
  -- combo bonus: answering in a rhythm within the same day
  gained := gained + LEAST(today_count - 1, 5) * 2;
  -- cultural note bonus
  IF NEW.cultural_note IS NOT NULL AND length(btrim(NEW.cultural_note)) > 0 THEN
    gained := gained + 5;
    reason := reason || ' + cultural note';
  END IF;
  -- first answer of the day
  IF today_count = 1 THEN
    gained := gained + 15;
    reason := reason || ' + first of the day';
  END IF;
  -- daily goal completion
  IF today_count = p.daily_goal THEN
    gained := gained + 50;
    reason := reason || ' + daily goal complete';
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
      best_day_count = GREATEST(best_day_count, today_count),
      days_goal_met = days_goal_met + CASE WHEN today_count = p.daily_goal THEN 1 ELSE 0 END,
      gems = gems + CASE WHEN today_count = p.daily_goal THEN 3 ELSE 0 END,
      freeze_tokens = LEAST(freeze_tokens + CASE WHEN new_streak > 0 AND new_streak % 7 = 0 AND today_count = 1 THEN 1 ELSE 0 END, 3),
      trust_score = round(((50 * 8) + (agree_rate * 100 * sample)) / (8 + sample), 2)
  WHERE id = NEW.user_id;

  INSERT INTO public.xp_events (user_id, amount, reason)
  VALUES (NEW.user_id, gained, reason || ' (streak x' || new_streak || ')');

  PERFORM public.evaluate_badges(NEW.user_id);

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_after_submission ON public.submissions;
CREATE TRIGGER trg_after_submission AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.after_submission();

-- ---------- streak freeze ----------
CREATE OR REPLACE FUNCTION public.use_streak_freeze()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF p.freeze_tokens < 1 THEN RETURN false; END IF;
  IF p.last_played_on IS NULL OR p.last_played_on >= CURRENT_DATE - 1 THEN RETURN false; END IF;
  UPDATE public.profiles
  SET freeze_tokens = freeze_tokens - 1,
      last_played_on = CURRENT_DATE - 1
  WHERE id = auth.uid();
  RETURN true;
END; $$;

-- ---------- player stats ----------
CREATE OR REPLACE FUNCTION public.player_stats()
RETURNS TABLE (
  today_count integer, total_words integer, notes integer, languages integer,
  agreed integer, verified integer, week_xp integer, rank integer, badges integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.submissions WHERE user_id = auth.uid() AND created_at::date = CURRENT_DATE),
    (SELECT count(*)::int FROM public.submissions WHERE user_id = auth.uid()),
    (SELECT count(*)::int FROM public.submissions WHERE user_id = auth.uid() AND cultural_note IS NOT NULL AND length(btrim(cultural_note)) > 0),
    (SELECT count(DISTINCT language_id)::int FROM public.submissions WHERE user_id = auth.uid()),
    (SELECT count(*)::int FROM public.submissions WHERE user_id = auth.uid() AND agreed_with_consensus),
    (SELECT count(*)::int FROM public.submissions s
       JOIN public.translations t ON t.base_word_id = s.base_word_id AND t.language_id = s.language_id
        AND public.normalize_text(t.translated_text) = s.normalized_text
      WHERE s.user_id = auth.uid()),
    (SELECT COALESCE(sum(amount),0)::int FROM public.xp_events WHERE user_id = auth.uid() AND created_at >= date_trunc('week', now())),
    (SELECT (count(*) + 1)::int FROM public.profiles WHERE xp > (SELECT xp FROM public.profiles WHERE id = auth.uid())),
    (SELECT count(*)::int FROM public.user_badges WHERE user_id = auth.uid())
$$;

-- ---------- weekly league ----------
CREATE OR REPLACE FUNCTION public.weekly_league()
RETURNS TABLE (user_id uuid, display_name text, week_xp integer, streak_current integer, trust_score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, COALESCE(sum(e.amount),0)::int, p.streak_current, p.trust_score
  FROM public.profiles p
  LEFT JOIN public.xp_events e
    ON e.user_id = p.id AND e.created_at >= date_trunc('week', now())
  GROUP BY p.id, p.display_name, p.streak_current, p.trust_score
  HAVING COALESCE(sum(e.amount),0) > 0
  ORDER BY 3 DESC
  LIMIT 50
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.after_submission() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.use_streak_freeze() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.player_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze() TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_league() TO anon, authenticated;
