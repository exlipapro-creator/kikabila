-- Add Kirangi (Rangi) to the languages table
-- Kirangi is spoken by the Rangi/Langi people in Kondoa district, Dodoma region, Tanzania

INSERT INTO public.languages (code, name, family, target_word_count)
VALUES ('rng', 'Kirangi', 'Bantu', 500)
ON CONFLICT (code) DO NOTHING;
