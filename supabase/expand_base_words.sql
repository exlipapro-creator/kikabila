-- =================================================================
-- Kikabila — Expand base_words + tier/level system
-- Run in Supabase SQL Editor
-- =================================================================

-- ── 1. Add tier, level, challenge_type to base_words ──────────
ALTER TABLE public.base_words
  ADD COLUMN IF NOT EXISTS tier           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_level      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS challenge_type text NOT NULL DEFAULT 'word';

-- Add challenge_mode to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS challenge_mode text NOT NULL DEFAULT 'translation';

-- ── 2. Update next_challenge to respect user level ────────────
DROP FUNCTION IF EXISTS public.next_challenge(bigint);
CREATE OR REPLACE FUNCTION public.next_challenge(_language_id bigint)
RETURNS TABLE(base_word_id bigint, swahili_word text, english_word text,
              category text, reason text, tier integer, challenge_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH user_level AS (
    SELECT GREATEST(1, FLOOR(SQRT(GREATEST(xp,0)::numeric / 50)) + 1)::int AS lvl
    FROM public.profiles WHERE id = auth.uid()
  ),
  answered AS (
    SELECT base_word_id FROM public.submissions
    WHERE user_id = auth.uid() AND language_id = _language_id
  ),
  stats AS (
    SELECT b.id, b.swahili_word, b.english_word, b.category,
           b.tier, b.challenge_type,
      (SELECT count(*) FROM public.submissions s
        WHERE s.base_word_id = b.id AND s.language_id = _language_id) AS obs,
      (SELECT count(*) FROM public.candidates c
        WHERE c.base_word_id = b.id AND c.language_id = _language_id) AS variants,
      (SELECT COALESCE(max(c.confidence),0) FROM public.candidates c
        WHERE c.base_word_id = b.id AND c.language_id = _language_id) AS best_conf,
      EXISTS (SELECT 1 FROM public.translations t
        WHERE t.base_word_id = b.id AND t.language_id = _language_id
          AND t.status = 'verified') AS verified
    FROM public.base_words b, user_level ul
    WHERE b.id NOT IN (SELECT base_word_id FROM answered)
      AND b.min_level <= ul.lvl   -- only show words user has unlocked
  )
  SELECT id, swahili_word, english_word, category,
    CASE WHEN obs=0 THEN 'No observations yet'
         WHEN variants>1 AND best_conf<0.75 THEN 'Contributors disagree here'
         WHEN best_conf<0.6 THEN 'Low confidence — needs corroboration'
         ELSE 'Corpus coverage' END,
    tier, challenge_type
  FROM stats WHERE NOT verified
  ORDER BY
    tier,
    (CASE WHEN obs=0 THEN 0 WHEN variants>1 AND best_conf<0.75 THEN 1
          WHEN best_conf<0.6 THEN 2 ELSE 3 END),
    random()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.next_challenge(bigint) TO authenticated;

-- ── 3. Seed 300 words across tiers and categories ─────────────
-- Format: (swahili, english, category, tier, min_level)
INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 1: Greetings (already exist, updating) ──────
('shikamoo',    'respectful greeting to elder', 'Greetings',    1, 1),
('marahaba',    'reply to shikamoo',             'Greetings',    1, 1),
('nzuri',       'good / fine',                   'Greetings',    1, 1),
('sawa',        'okay / alright',                'Greetings',    1, 1),
('pole',        'sorry / take it easy',          'Greetings',    1, 1),
('asalamu aleikum', 'peace be upon you',         'Greetings',    1, 1),
('hujambo',     'how are you (singular)',        'Greetings',    1, 1),
('sijambo',     'I am fine (reply)',             'Greetings',    1, 1),
('hamjambo',    'how are you (plural)',          'Greetings',    1, 1),

-- ── TIER 1, LEVEL 1: Numbers ─────────────────────────────────
('sita',    'six',     'Numbers', 1, 1),
('saba',    'seven',   'Numbers', 1, 1),
('nane',    'eight',   'Numbers', 1, 1),
('tisa',    'nine',    'Numbers', 1, 1),
('kumi',    'ten',     'Numbers', 1, 1),
('ishirini','twenty',  'Numbers', 1, 1),
('thelathini','thirty','Numbers', 1, 1),
('mia',     'hundred', 'Numbers', 1, 1),
('elfu',    'thousand','Numbers', 1, 1),

-- ── TIER 1, LEVEL 2: Family ──────────────────────────────────
('shangazi', 'aunt (father''s sister)',  'Family', 1, 2),
('mjomba',   'uncle (mother''s brother)','Family', 1, 2),
('kaka',     'older brother',            'Family', 1, 2),
('dada',     'older sister',             'Family', 1, 2),
('binamu',   'cousin',                   'Family', 1, 2),
('mkwe',     'parent-in-law',            'Family', 1, 2),
('mkubwa',   'elder / older person',     'Family', 1, 2),
('mwana',    'child / son',              'Family', 1, 2),
('binti',    'daughter',                 'Family', 1, 2),
('mpenzi',   'beloved / dear one',       'Family', 1, 2),

-- ── TIER 1, LEVEL 2: Body ────────────────────────────────────
('kichwa',   'head',    'Body', 1, 2),
('macho',    'eyes',    'Body', 1, 2),
('masikio',  'ears',    'Body', 1, 2),
('pua',      'nose',    'Body', 1, 2),
('mdomo',    'mouth',   'Body', 1, 2),
('meno',     'teeth',   'Body', 1, 2),
('shingo',   'neck',    'Body', 1, 2),
('bega',     'shoulder','Body', 1, 2),
('mkono',    'arm/hand','Body', 1, 2),
('kidole',   'finger',  'Body', 1, 2),
('tumbo',    'stomach', 'Body', 1, 2),
('mguu',     'leg/foot','Body', 1, 2),
('moyo',     'heart',   'Body', 1, 2),
('damu',     'blood',   'Body', 1, 2),
('ngozi',    'skin',    'Body', 1, 2)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 3: Nature ──────────────────────────────────
('bahari',    'ocean/sea',      'Nature', 1, 3),
('ziwa',      'lake',           'Nature', 1, 3),
('mto',       'river',          'Nature', 1, 3),
('mlima',     'mountain',       'Nature', 1, 3),
('msitu',     'forest',         'Nature', 1, 3),
('jangwa',    'desert',         'Nature', 1, 3),
('pwani',     'coast/beach',    'Nature', 1, 3),
('taa',       'light',          'Nature', 1, 3),
('giza',      'darkness',       'Nature', 1, 3),
('upepo',     'wind',           'Nature', 1, 3),
('theluji',   'snow/ice',       'Nature', 1, 3),
('radi',      'thunder',        'Nature', 1, 3),
('umeme',     'lightning/electricity','Nature', 1, 3),
('mwanga',    'light/sunshine', 'Nature', 1, 3),
('kivuli',    'shadow/shade',   'Nature', 1, 3),

-- ── TIER 1, LEVEL 3: Animals ─────────────────────────────────
('ndege',     'bird',           'Animals', 1, 3),
('samaki',    'fish',           'Animals', 1, 3),
('nyati',     'buffalo',        'Animals', 1, 3),
('twiga',     'giraffe',        'Animals', 1, 3),
('kiboko',    'hippo',          'Animals', 1, 3),
('fisi',      'hyena',          'Animals', 1, 3),
('chui',      'leopard',        'Animals', 1, 3),
('sungura',   'rabbit',         'Animals', 1, 3),
('tumbili',   'monkey',         'Animals', 1, 3),
('nzige',     'locust',         'Animals', 1, 3),
('mbu',       'mosquito',       'Animals', 1, 3),
('nyuki',     'bee',            'Animals', 1, 3),
('samaki wa bahari','sea fish',  'Animals', 1, 3),
('kaa',       'crab',           'Animals', 1, 3),
('nge',       'scorpion',       'Animals', 1, 3)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 4: Food & Market ───────────────────────────
('uji',       'porridge',       'Food', 1, 4),
('wali',      'cooked rice',    'Food', 1, 4),
('ugali',     'stiff porridge', 'Food', 1, 4),
('mchuzi',    'stew/sauce',     'Food', 1, 4),
('mboga',     'vegetable',      'Food', 1, 4),
('matunda',   'fruits',         'Food', 1, 4),
('ndizi',     'banana',         'Food', 1, 4),
('embe',      'mango',          'Food', 1, 4),
('mnanasi',   'pineapple',      'Food', 1, 4),
('ndimu',     'lemon/lime',     'Food', 1, 4),
('sukari',    'sugar',          'Food', 1, 4),
('chumvi',    'salt',           'Food', 1, 4),
('mafuta',    'oil/fat',        'Food', 1, 4),
('unga',      'flour',          'Food', 1, 4),
('mahindi',   'corn/maize',     'Food', 1, 4),
('maharage',  'beans',          'Food', 1, 4),
('viazi',     'potatoes',       'Food', 1, 4),
('nyanya',    'tomatoes',       'Food', 1, 4),
('kitunguu',  'onion',          'Food', 1, 4),
('pilipili',  'pepper/chilli',  'Food', 1, 4),
('nazi',      'coconut',        'Food', 1, 4),
('dagaa',     'small dried fish','Food', 1, 4),
('mchele',    'uncooked rice',  'Food', 1, 4),
('mkate wa kukaanga','fried bread','Food', 1, 4),
('chai',      'tea',            'Food', 1, 4),
('kahawa',    'coffee',         'Food', 1, 4),
('maji ya matunda','fruit juice','Food', 1, 4),
('biashara',  'trade/business', 'Market', 1, 4),
('duka',      'shop',           'Market', 1, 4),
('mnunuzi',   'buyer',          'Market', 1, 4),
('muuzaji',   'seller',         'Market', 1, 4),
('faida',     'profit',         'Market', 1, 4),
('hasara',    'loss',           'Market', 1, 4),
('mkopo',     'loan/debt',      'Market', 1, 4),
('malipo',    'payment',        'Market', 1, 4)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 5: Emotions & States ───────────────────────
('furaha',    'joy/happiness',  'Emotions', 1, 5),
('huzuni',    'sadness',        'Emotions', 1, 5),
('hasira',    'anger',          'Emotions', 1, 5),
('hofu',      'fear',           'Emotions', 1, 5),
('upendo',    'love',           'Emotions', 1, 5),
('chuki',     'hate',           'Emotions', 1, 5),
('wivu',      'jealousy',       'Emotions', 1, 5),
('aibu',      'shame/embarrassment','Emotions', 1, 5),
('heshima',   'respect',        'Emotions', 1, 5),
('huruma',    'compassion/pity','Emotions', 1, 5),
('amani',     'peace',          'Emotions', 1, 5),
('utulivu',   'calmness',       'Emotions', 1, 5),
('fahari',    'pride/glory',    'Emotions', 1, 5),
('shida',     'problem/trouble','Emotions', 1, 5),
('baraka',    'blessing',       'Emotions', 1, 5),

-- ── TIER 1, LEVEL 5: Time ────────────────────────────────────
('saa',       'hour/clock',     'Time', 1, 5),
('dakika',    'minute',         'Time', 1, 5),
('wiki',      'week',           'Time', 1, 5),
('mwezi',     'month/moon',     'Time', 1, 5),
('mwaka',     'year',           'Time', 1, 5),
('asubuhi',   'morning',        'Time', 1, 5),
('mchana',    'noon/daytime',   'Time', 1, 5),
('jioni',     'evening',        'Time', 1, 5),
('usiku',     'night',          'Time', 1, 5),
('jana',      'yesterday',      'Time', 1, 5),
('leo',       'today',          'Time', 1, 5),
('kesho',     'tomorrow',       'Time', 1, 5),
('juzi',      'day before yesterday','Time', 1, 5),
('mapema',    'early',          'Time', 1, 5),
('baadaye',   'later',          'Time', 1, 5),
('sasa',      'now',            'Time', 1, 5),
('zamani',    'long ago/past',  'Time', 1, 5),

-- ── TIER 1, LEVEL 6: Health ──────────────────────────────────
('mgonjwa',   'sick person/patient','Health', 1, 6),
('ugonjwa',   'disease/illness','Health', 1, 6),
('dawa',      'medicine',       'Health', 1, 6),
('daktari',   'doctor',         'Health', 1, 6),
('muuguzi',   'nurse',          'Health', 1, 6),
('maumivu',   'pain',           'Health', 1, 6),
('homa',      'fever',          'Health', 1, 6),
('kikohozi',  'cough',          'Health', 1, 6),
('malaria',   'malaria',        'Health', 1, 6),
('jeraha',    'wound/injury',   'Health', 1, 6),
('kupumzika', 'to rest',        'Health', 1, 6),
('nguvu',     'strength',       'Health', 1, 6),
('uchovu',    'tiredness',      'Health', 1, 6),
('njaa',      'hunger',         'Health', 1, 6),
('kiu',       'thirst',         'Health', 1, 6)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 7: Agriculture & Land ──────────────────────
('ardhi',     'land/soil',      'Agriculture', 1, 7),
('kilimo',    'farming',        'Agriculture', 1, 7),
('mkulima',   'farmer',         'Agriculture', 1, 7),
('zao',       'crop/produce',   'Agriculture', 1, 7),
('mbolea',    'fertilizer',     'Agriculture', 1, 7),
('umwagiliaji','irrigation',    'Agriculture', 1, 7),
('wakati wa mvua','rainy season','Agriculture', 1, 7),
('kiangazi',  'dry season',     'Agriculture', 1, 7),
('mzigo',     'load/burden',    'Agriculture', 1, 7),
('gunny',     'sack/bag',       'Agriculture', 1, 7),

-- ── TIER 1, LEVEL 7: Transport ───────────────────────────────
('barabara',  'road',           'Transport', 1, 7),
('gari',      'car/vehicle',    'Transport', 1, 7),
('basi',      'bus',            'Transport', 1, 7),
('pikipiki',  'motorcycle',     'Transport', 1, 7),
('baiskeli',  'bicycle',        'Transport', 1, 7),
('treni',     'train',          'Transport', 1, 7),
('ndege',     'aeroplane',      'Transport', 1, 7),
('meli',      'ship',           'Transport', 1, 7),
('kivuko',    'ferry crossing', 'Transport', 1, 7),
('safari',    'journey/trip',   'Transport', 1, 7),
('dereva',    'driver',         'Transport', 1, 7),
('kituo',     'station/stop',   'Transport', 1, 7),

-- ── TIER 1, LEVEL 8: School & Learning ───────────────────────
('shule',     'school',         'Education', 1, 8),
('mwalimu',   'teacher',        'Education', 1, 8),
('mwanafunzi','student',        'Education', 1, 8),
('kitabu',    'book',           'Education', 1, 8),
('kalamu',    'pen',            'Education', 1, 8),
('bodi',      'blackboard',     'Education', 1, 8),
('darasa',    'classroom',      'Education', 1, 8),
('mtihani',   'exam',           'Education', 1, 8),
('elimu',     'education',      'Education', 1, 8),
('kusoma',    'to read/study',  'Education', 1, 8),
('kuandika',  'to write',       'Education', 1, 8),
('kuhesabu',  'to calculate',   'Education', 1, 8)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level) VALUES

-- ── TIER 1, LEVEL 9: Religion & Culture ──────────────────────
('Mungu',     'God',            'Culture', 1, 9),
('sala',      'prayer',         'Culture', 1, 9),
('kanisa',    'church',         'Culture', 1, 9),
('msikiti',   'mosque',         'Culture', 1, 9),
('ibada',     'worship',        'Culture', 1, 9),
('imani',     'faith/belief',   'Culture', 1, 9),
('desturi',   'custom/tradition','Culture', 1, 9),
('mila',      'culture/custom', 'Culture', 1, 9),
('sherehe',   'celebration',    'Culture', 1, 9),
('ngoma',     'drum/dance',     'Culture', 1, 9),
('wimbo',     'song',           'Culture', 1, 9),
('muziki',    'music',          'Culture', 1, 9),
('hadithi',   'story',          'Culture', 1, 9),
('mshairi',   'poem/poet',      'Culture', 1, 9),
('hekima',    'wisdom',         'Culture', 1, 9),

-- ── TIER 1, LEVEL 10: Dwelling & Home ────────────────────────
('mlango',    'door',           'Dwelling', 1, 10),
('dirisha',   'window',         'Dwelling', 1, 10),
('dari',      'floor',          'Dwelling', 1, 10),
('paa',       'roof',           'Dwelling', 1, 10),
('ukuta',     'wall',           'Dwelling', 1, 10),
('sebule',    'sitting room',   'Dwelling', 1, 10),
('jiko',      'stove/kitchen',  'Dwelling', 1, 10),
('choo',      'toilet',         'Dwelling', 1, 10),
('kijiji',    'village',        'Dwelling', 1, 10),
('mji',       'town/city',      'Dwelling', 1, 10),
('mtaa',      'neighbourhood',  'Dwelling', 1, 10),
('mto wa karibu','nearby river','Dwelling', 1, 10)

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  category = EXCLUDED.category;

-- ── TIER 2: Phrases (min_level 11+, challenge_type 'phrase') ──
INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level, challenge_type) VALUES

-- Greetings & courtesies
('Habari za asubuhi',       'Good morning news',              'Phrases', 2, 11, 'phrase'),
('Habari za jioni',         'Good evening news',              'Phrases', 2, 11, 'phrase'),
('Karibu nyumbani',         'Welcome home',                   'Phrases', 2, 11, 'phrase'),
('Asante sana',             'Thank you very much',            'Phrases', 2, 11, 'phrase'),
('Samahani sana',           'I am very sorry',                'Phrases', 2, 11, 'phrase'),
('Nisamehe tafadhali',      'Please forgive me',              'Phrases', 2, 11, 'phrase'),
('Hujambo mzee',            'How are you elder',              'Phrases', 2, 11, 'phrase'),
('Niko sawa kabisa',        'I am completely fine',           'Phrases', 2, 11, 'phrase'),
('Tutaonana kesho',         'We will see each other tomorrow','Phrases', 2, 11, 'phrase'),
('Lala salama',             'Sleep peacefully',               'Phrases', 2, 11, 'phrase'),

-- Daily life
('Ninajisikia vizuri',      'I feel well',                    'Phrases', 2, 12, 'phrase'),
('Nina njaa sana',          'I am very hungry',               'Phrases', 2, 12, 'phrase'),
('Ninahitaji msaada',       'I need help',                    'Phrases', 2, 12, 'phrase'),
('Wapi hospitali',          'Where is the hospital',          'Phrases', 2, 12, 'phrase'),
('Bei gani',                'What is the price',              'Phrases', 2, 12, 'phrase'),
('Ni mbali sana',           'It is very far',                 'Phrases', 2, 12, 'phrase'),
('Njoo hapa',               'Come here',                      'Phrases', 2, 12, 'phrase'),
('Nenda polepole',          'Go slowly',                      'Phrases', 2, 12, 'phrase'),
('Simama kidogo',           'Stop/wait a little',             'Phrases', 2, 12, 'phrase'),
('Nilianguka',              'I fell down',                    'Phrases', 2, 12, 'phrase'),

-- Community & culture
('Tunafanya kazi pamoja',   'We work together',               'Phrases', 2, 13, 'phrase'),
('Watoto wa shule',         'School children',                'Phrases', 2, 13, 'phrase'),
('Mvua inanyesha',          'It is raining',                  'Phrases', 2, 13, 'phrase'),
('Jua linachoma',           'The sun is burning hot',         'Phrases', 2, 13, 'phrase'),
('Mazao yamekuwa mazuri',   'The crops have grown well',      'Phrases', 2, 13, 'phrase'),
('Mwaka huu ni mzuri',      'This year is good',              'Phrases', 2, 13, 'phrase'),
('Familia yangu ni kubwa',  'My family is large',             'Phrases', 2, 13, 'phrase'),
('Mtoto amezaliwa',         'A child has been born',          'Phrases', 2, 13, 'phrase'),
('Mzee amefariki',          'The elder has passed away',      'Phrases', 2, 13, 'phrase'),
('Harusi itafanyika kesho', 'The wedding will be held tomorrow','Phrases', 2, 13, 'phrase')

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  challenge_type = EXCLUDED.challenge_type,
  category = EXCLUDED.category;

-- ── TIER 3: Sentences (min_level 15+) ─────────────────────────
INSERT INTO public.base_words (swahili_word, english_word, category, tier, min_level, challenge_type) VALUES

('Mvua ya masika huleta baraka mashambani',
 'The long rains bring blessings to the farms',
 'Sentences', 3, 15, 'sentence'),

('Mtoto wa jirani ni mtoto wako pia',
 'A neighbour''s child is also your child',
 'Sentences', 3, 15, 'sentence'),

('Asubuhi na jioni mkulima hulima shamba lake',
 'Morning and evening the farmer cultivates his field',
 'Sentences', 3, 15, 'sentence'),

('Wazee wanafundisha vijana desturi za kabila',
 'Elders teach young people the customs of the tribe',
 'Sentences', 3, 15, 'sentence'),

('Mama anafanya uji kwa ajili ya watoto',
 'Mother makes porridge for the children',
 'Sentences', 3, 16, 'sentence'),

('Ng''ombe ni utajiri wa familia yetu',
 'Cattle are the wealth of our family',
 'Sentences', 3, 16, 'sentence'),

('Tunapaswa kulinda lugha za mababu zetu',
 'We must protect the languages of our ancestors',
 'Sentences', 3, 16, 'sentence'),

('Vijana wanaenda shuleni kila asubuhi',
 'Young people go to school every morning',
 'Sentences', 3, 16, 'sentence'),

-- ── TIER 4: Proverbs (min_level 20+) ──────────────────────────
('Haba na haba hujaza kibaba',
 'Little by little fills the measure (patience builds success)',
 'Proverbs', 4, 20, 'proverb'),

('Umoja ni nguvu utengano ni udhaifu',
 'Unity is strength division is weakness',
 'Proverbs', 4, 20, 'proverb'),

('Haraka haraka haina baraka',
 'Hurry hurry has no blessing (haste makes waste)',
 'Proverbs', 4, 20, 'proverb'),

('Mtu ni watu',
 'A person is people (no one thrives alone)',
 'Proverbs', 4, 20, 'proverb'),

('Asiyejua kushukuru, hashukuriwi',
 'One who does not give thanks does not receive thanks',
 'Proverbs', 4, 20, 'proverb'),

('Damu nzito kuliko maji',
 'Blood is thicker than water (family bonds are strongest)',
 'Proverbs', 4, 21, 'proverb'),

('Mgeni njoo, mwenyeji apone',
 'Let the guest come so the host may heal (hospitality heals)',
 'Proverbs', 4, 21, 'proverb'),

('Elimu ni bora kuliko mali',
 'Education is better than wealth',
 'Proverbs', 4, 21, 'proverb')

ON CONFLICT (swahili_word) DO UPDATE SET
  tier = EXCLUDED.tier,
  min_level = EXCLUDED.min_level,
  challenge_type = EXCLUDED.challenge_type,
  category = EXCLUDED.category;

-- =================================================================
-- Summary of content added:
-- Tier 1 (words):    ~200 words, levels 1-10, categories: Greetings,
--   Numbers, Family, Body, Nature, Animals, Food, Market, Emotions,
--   Time, Health, Agriculture, Transport, Education, Culture, Dwelling
-- Tier 2 (phrases):   30 phrases, levels 11-13
-- Tier 3 (sentences):  8 sentences, levels 15-16
-- Tier 4 (proverbs):   8 proverbs, levels 20-21
-- Total: ~246 new entries on top of the original 33
-- =================================================================
