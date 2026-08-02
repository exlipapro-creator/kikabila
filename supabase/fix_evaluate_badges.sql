-- Fix: use array_append instead of || to avoid malformed array literal error
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
  INTO n_words, n_notes, n_langs, n_agree
  FROM public.submissions WHERE user_id=_user_id;

  earned := ARRAY[]::text[];
  IF n_words>=1   THEN earned := array_append(earned, 'first_word'); END IF;
  IF n_words>=10  THEN earned := array_append(earned, 'words_10');   END IF;
  IF n_words>=50  THEN earned := array_append(earned, 'words_50');   END IF;
  IF n_words>=100 THEN earned := array_append(earned, 'words_100');  END IF;
  IF n_words>=250 THEN earned := array_append(earned, 'words_250');  END IF;
  IF p.streak_longest>=3  THEN earned := array_append(earned, 'streak_3');  END IF;
  IF p.streak_longest>=7  THEN earned := array_append(earned, 'streak_7');  END IF;
  IF p.streak_longest>=30 THEN earned := array_append(earned, 'streak_30'); END IF;
  IF p.days_goal_met>=1   THEN earned := array_append(earned, 'goal_1');    END IF;
  IF p.days_goal_met>=10  THEN earned := array_append(earned, 'goal_10');   END IF;
  IF n_notes>=10  THEN earned := array_append(earned, 'notes_10'); END IF;
  IF n_langs>=3   THEN earned := array_append(earned, 'langs_3');  END IF;
  IF n_langs>=6   THEN earned := array_append(earned, 'langs_6');  END IF;
  IF n_agree>=25  THEN earned := array_append(earned, 'agree_25'); END IF;
  IF p.trust_score>=85 THEN earned := array_append(earned, 'trust_85'); END IF;

  FOR b IN
    SELECT bd.code, bd.xp_reward, bd.name FROM public.badges bd
    WHERE bd.code = ANY(earned)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_badges ub
        WHERE ub.user_id=_user_id AND ub.badge_code=bd.code
      )
  LOOP
    INSERT INTO public.user_badges(user_id, badge_code) VALUES(_user_id, b.code) ON CONFLICT DO NOTHING;
    INSERT INTO public.xp_events(user_id, amount, reason) VALUES(_user_id, b.xp_reward, 'Badge unlocked: ' || b.name);
    UPDATE public.profiles SET xp=xp+b.xp_reward, gems=gems+1 WHERE id=_user_id;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.evaluate_badges(uuid) TO authenticated;
