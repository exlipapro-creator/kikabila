DROP VIEW IF EXISTS public.candidates_public;

CREATE OR REPLACE FUNCTION public.consensus_candidates(_language_id bigint DEFAULT NULL, _base_word_id bigint DEFAULT NULL)
RETURNS TABLE(
  id uuid, base_word_id bigint, language_id bigint,
  swahili_word text, english_word text, category text,
  display_text text, normalized_text text, region text,
  submission_count integer, weighted_score numeric,
  agreement_ratio numeric, confidence numeric, status candidate_status,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.base_word_id, c.language_id,
         b.swahili_word, b.english_word, b.category,
         c.display_text, c.normalized_text, c.region,
         c.submission_count, c.weighted_score, c.agreement_ratio, c.confidence, c.status,
         c.created_at, c.updated_at
  FROM public.candidates c
  JOIN public.base_words b ON b.id = c.base_word_id
  WHERE auth.uid() IS NOT NULL
    AND (_language_id IS NULL OR c.language_id = _language_id)
    AND (_base_word_id IS NULL OR c.base_word_id = _base_word_id)
  ORDER BY c.weighted_score DESC
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION public.consensus_candidates(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consensus_candidates(bigint, bigint) TO authenticated, service_role;
