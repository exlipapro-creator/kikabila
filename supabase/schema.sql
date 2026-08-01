-- =============================================================
-- KIKABILA — Full database schema
-- Paste this entire file into Supabase SQL Editor and run it.
-- =============================================================

-- ── Enums ─────────────────────────────────────────────────────
do $$ begin
  create type public.app_role as enum ('contributor', 'reviewer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.candidate_status as enum ('pending', 'queued', 'promoted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.translation_status as enum ('verified', 'archived');
exception when duplicate_object then null; end $$;

-- ── Base reference tables ─────────────────────────────────────
create table if not exists public.languages (
  id                serial primary key,
  code              text not null unique,
  name              text not null,
  family            text not null default '',
  target_word_count int  not null default 500
);

create table if not exists public.base_words (
  id            serial primary key,
  swahili_word  text not null,
  english_word  text not null,
  category      text not null default 'general'
);

create table if not exists public.badges (
  code        text primary key,
  name        text not null,
  description text not null,
  icon        text not null default 'Sparkles',
  tier        text not null default 'bronze',
  xp_reward   int  not null default 50,
  sort_order  int  not null default 0
);

-- ── User-facing tables ────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users on delete cascade,
  display_name     text not null default 'Player',
  xp               int  not null default 0,
  trust_score      numeric(6,3) not null default 50,
  streak_current   int  not null default 0,
  streak_longest   int  not null default 0,
  daily_goal       int  not null default 10,
  freeze_tokens    int  not null default 0,
  gems             int  not null default 0,
  last_played_on   date,
  best_day_count   int  not null default 0,
  days_goal_met    int  not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);

create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  badge_code text not null references public.badges(code),
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_code)
);

create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  amount     int  not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

-- ── Submission & consensus pipeline ───────────────────────────
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  base_word_id int not null references public.base_words(id),
  language_id  int not null references public.languages(id),
  kind        text not null default 'translation',
  reason      text not null default 'no_data',
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.submissions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  base_word_id          int  not null references public.base_words(id),
  language_id           int  not null references public.languages(id),
  challenge_id          uuid references public.challenges(id),
  translated_text       text not null,
  normalized_text       text not null,
  cultural_note         text,
  region                text,
  weight_at_submit      numeric(6,3) not null default 1,
  agreed_with_consensus boolean,
  created_at            timestamptz not null default now()
);

create table if not exists public.candidates (
  id               uuid primary key default gen_random_uuid(),
  base_word_id     int  not null references public.base_words(id),
  language_id      int  not null references public.languages(id),
  normalized_text  text not null,
  display_text     text not null,
  region           text,
  submission_count int  not null default 0,
  weighted_score   numeric(10,4) not null default 0,
  agreement_ratio  numeric(6,4) not null default 0,
  confidence       numeric(6,4) not null default 0,
  status           public.candidate_status not null default 'pending',
  reviewed_by      uuid references auth.users,
  reviewed_at      timestamptz,
  reviewer_note    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (base_word_id, language_id, normalized_text)
);

-- ── Verified corpus ───────────────────────────────────────────
create table if not exists public.translations (
  id              uuid primary key default gen_random_uuid(),
  base_word_id    int  not null references public.base_words(id),
  language_id     int  not null references public.languages(id),
  translated_text text not null,
  cultural_note   text,
  version         int  not null default 1,
  status          public.translation_status not null default 'verified',
  confidence      numeric(6,4),
  verified_by     uuid references auth.users,
  supersedes_id   uuid references public.translations(id),
  created_at      timestamptz not null default now()
);

create table if not exists public.translation_history (
  id              uuid primary key default gen_random_uuid(),
  translation_id  uuid references public.translations(id),
  candidate_id    uuid,
  actor_id        uuid references auth.users,
  event_type      text not null,
  previous_status text,
  new_status      text,
  comment         text,
  created_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_submissions_user_created   on public.submissions(user_id, created_at desc);
create index if not exists idx_submissions_word_lang      on public.submissions(base_word_id, language_id);
create index if not exists idx_candidates_word_lang       on public.candidates(base_word_id, language_id);
create index if not exists idx_candidates_status          on public.candidates(status);
create index if not exists idx_translations_word_lang     on public.translations(base_word_id, language_id);
create index if not exists idx_xp_events_user_created     on public.xp_events(user_id, created_at desc);

-- ── Row-Level Security ────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.user_roles      enable row level security;
alter table public.user_badges     enable row level security;
alter table public.xp_events       enable row level security;
alter table public.challenges      enable row level security;
alter table public.submissions     enable row level security;
alter table public.candidates      enable row level security;
alter table public.translations    enable row level security;
alter table public.translation_history enable row level security;
alter table public.badges          enable row level security;
alter table public.languages       enable row level security;
alter table public.base_words      enable row level security;

-- Public read-only tables
drop policy if exists "public read" on public.languages;
create policy "public read" on public.languages       for select using (true);
drop policy if exists "public read" on public.base_words;
create policy "public read" on public.base_words      for select using (true);
drop policy if exists "public read" on public.badges;
create policy "public read" on public.badges          for select using (true);
drop policy if exists "public read" on public.translations;
create policy "public read" on public.translations    for select using (true);
drop policy if exists "public read" on public.translation_history;
create policy "public read" on public.translation_history for select using (true);
drop policy if exists "public read" on public.candidates;
create policy "public read" on public.candidates      for select using (true);

-- Profiles: owner read/update, insert on first login
drop policy if exists "owner read"   on public.profiles;
create policy "owner read"   on public.profiles for select using (auth.uid() = id);
drop policy if exists "owner update" on public.profiles;
create policy "owner update" on public.profiles for update using (auth.uid() = id);
drop policy if exists "owner insert" on public.profiles;
create policy "owner insert" on public.profiles for insert with check (auth.uid() = id);

-- User roles: self read
drop policy if exists "owner read" on public.user_roles;
create policy "owner read" on public.user_roles for select using (auth.uid() = user_id);

-- User badges: self read
drop policy if exists "owner read" on public.user_badges;
create policy "owner read" on public.user_badges for select using (auth.uid() = user_id);

-- XP events: self read
drop policy if exists "owner read" on public.xp_events;
create policy "owner read" on public.xp_events for select using (auth.uid() = user_id);

-- Challenges: owner CRUD
drop policy if exists "owner all" on public.challenges;
create policy "owner all" on public.challenges for all using (auth.uid() = user_id);

-- Submissions: owner insert + read, public read for consensus
drop policy if exists "owner insert" on public.submissions;
create policy "owner insert" on public.submissions for insert with check (auth.uid() = user_id);
drop policy if exists "public read"  on public.submissions;
create policy "public read"  on public.submissions for select using (true);

-- ── Auto-create profile on signup ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Player')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'contributor')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Normalize text helper ─────────────────────────────────────
create or replace function public.normalize_text(_t text)
returns text language sql immutable as $$
  select lower(regexp_replace(trim(_t), '[^a-z0-9 ]', '', 'gi'));
$$;

-- ── Recompute candidates after each submission ─────────────────
create or replace function public.recompute_candidates(_base_word_id int, _language_id int)
returns void language plpgsql security definer as $$
declare
  total_weight numeric;
begin
  select coalesce(sum(weight_at_submit), 0) into total_weight
  from public.submissions
  where base_word_id = _base_word_id and language_id = _language_id;

  insert into public.candidates (
    base_word_id, language_id, normalized_text, display_text,
    submission_count, weighted_score, agreement_ratio, confidence, status
  )
  select
    _base_word_id,
    _language_id,
    s.normalized_text,
    -- pick most common display form
    (select translated_text from public.submissions s2
      where s2.base_word_id = _base_word_id and s2.language_id = _language_id
        and s2.normalized_text = s.normalized_text
      group by translated_text order by count(*) desc limit 1),
    count(*)::int,
    sum(s.weight_at_submit),
    case when total_weight > 0 then sum(s.weight_at_submit) / total_weight else 0 end,
    -- confidence: harmonic of agreement_ratio and log-scaled observation count
    case when total_weight > 0
      then (sum(s.weight_at_submit) / total_weight)
           * (1 - 1.0 / (1 + count(*)))
      else 0
    end,
    'queued'
  from public.submissions s
  where s.base_word_id = _base_word_id and s.language_id = _language_id
  group by s.normalized_text
  on conflict (base_word_id, language_id, normalized_text) do update set
    display_text     = excluded.display_text,
    submission_count = excluded.submission_count,
    weighted_score   = excluded.weighted_score,
    agreement_ratio  = excluded.agreement_ratio,
    confidence       = excluded.confidence,
    updated_at       = now();
end;
$$;

-- trigger to recompute after each new submission
create or replace function public.after_submission()
returns trigger language plpgsql security definer as $$
begin
  -- normalize text in-place
  new.normalized_text := public.normalize_text(new.translated_text);
  -- set submission weight from submitter's trust score
  select coalesce(trust_score / 100.0, 1) into new.weight_at_submit
  from public.profiles where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists before_submission_insert on public.submissions;
create trigger before_submission_insert
  before insert on public.submissions
  for each row execute procedure public.after_submission();

create or replace function public.after_submission_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_candidates(new.base_word_id, new.language_id);
  -- award XP
  perform public.award_xp(new.user_id, 10, 'submission');
  if new.cultural_note is not null and length(trim(new.cultural_note)) > 0 then
    perform public.award_xp(new.user_id, 5, 'cultural_note');
  end if;
  return new;
end;
$$;

drop trigger if exists after_submission_insert on public.submissions;
create trigger after_submission_insert
  after insert on public.submissions
  for each row execute procedure public.after_submission_insert();

-- ── XP & streak helper ────────────────────────────────────────
create or replace function public.award_xp(_user_id uuid, _amount int, _reason text)
returns void language plpgsql security definer as $$
declare
  today date := current_date;
  last_played date;
  new_streak int;
begin
  -- insert XP event
  insert into public.xp_events (user_id, amount, reason) values (_user_id, _amount, _reason);

  -- update profile xp + streak
  select last_played_on into last_played from public.profiles where id = _user_id;

  if last_played = today then
    new_streak := null; -- no change
  elsif last_played = today - 1 then
    new_streak := (select streak_current from public.profiles where id = _user_id) + 1;
  else
    new_streak := 1;
  end if;

  update public.profiles set
    xp = xp + _amount,
    last_played_on = today,
    streak_current = coalesce(new_streak, streak_current),
    streak_longest = greatest(streak_longest, coalesce(new_streak, streak_current))
  where id = _user_id;
end;
$$;

-- ── Streak freeze ─────────────────────────────────────────────
create or replace function public.use_streak_freeze()
returns boolean language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
  yesterday date := current_date - 1;
  last_played date;
  tokens int;
begin
  select last_played_on, freeze_tokens into last_played, tokens
  from public.profiles where id = uid;

  -- only useful if streak would be broken (last played was before yesterday)
  if last_played >= yesterday or tokens < 1 then return false; end if;

  update public.profiles set
    freeze_tokens  = freeze_tokens - 1,
    last_played_on = yesterday
  where id = uid;
  return true;
end;
$$;

-- ── Core RPC functions ────────────────────────────────────────

-- next challenge: prioritise words with no/low confidence for this user
create or replace function public.next_challenge(_language_id int)
returns table(base_word_id int, swahili_word text, english_word text, category text, reason text)
language sql security definer as $$
  select
    bw.id,
    bw.swahili_word,
    bw.english_word,
    bw.category,
    case
      when c.id is null then 'no_data'
      when c.confidence < 0.4 then 'low_confidence'
      else 'conflict'
    end as reason
  from public.base_words bw
  left join public.candidates c
    on c.base_word_id = bw.id and c.language_id = _language_id
       and c.status not in ('promoted', 'rejected')
  where bw.id not in (
    select base_word_id from public.submissions
    where user_id = auth.uid() and language_id = _language_id
  )
  order by
    case when c.id is null then 0 else 1 end,
    coalesce(c.confidence, 0),
    random()
  limit 1;
$$;

-- consensus candidates for a word (or all words in a language)
create or replace function public.consensus_candidates(_language_id int default null, _base_word_id int default null)
returns table(
  id uuid, base_word_id int, language_id int, normalized_text text, display_text text,
  submission_count int, weighted_score numeric, agreement_ratio numeric, confidence numeric,
  status public.candidate_status, region text, swahili_word text, english_word text,
  category text, created_at timestamptz, updated_at timestamptz
)
language sql security definer as $$
  select
    c.id, c.base_word_id, c.language_id, c.normalized_text, c.display_text,
    c.submission_count, c.weighted_score, c.agreement_ratio, c.confidence,
    c.status, c.region, bw.swahili_word, bw.english_word, bw.category,
    c.created_at, c.updated_at
  from public.candidates c
  join public.base_words bw on bw.id = c.base_word_id
  where
    (_language_id is null or c.language_id = _language_id)
    and (_base_word_id is null or c.base_word_id = _base_word_id)
  order by c.confidence desc, c.submission_count desc;
$$;

-- leaderboard (all-time)
create or replace function public.leaderboard()
returns table(user_id uuid, display_name text, xp int, trust_score numeric, streak_current int, submissions bigint)
language sql security definer as $$
  select
    p.id, p.display_name, p.xp, p.trust_score, p.streak_current,
    count(s.id) as submissions
  from public.profiles p
  left join public.submissions s on s.user_id = p.id
  group by p.id
  order by p.xp desc
  limit 100;
$$;

-- weekly league (XP earned this week)
create or replace function public.weekly_league()
returns table(user_id uuid, display_name text, week_xp bigint, trust_score numeric, streak_current int)
language sql security definer as $$
  select
    p.id, p.display_name,
    coalesce(sum(e.amount), 0) as week_xp,
    p.trust_score, p.streak_current
  from public.profiles p
  left join public.xp_events e
    on e.user_id = p.id
    and e.created_at >= date_trunc('week', now())
  group by p.id
  order by week_xp desc
  limit 100;
$$;

-- player stats (for logged-in user)
create or replace function public.player_stats()
returns table(
  today_count bigint, total_words bigint, notes bigint, languages bigint,
  agreed bigint, verified bigint, week_xp bigint, rank bigint, badges bigint
)
language sql security definer as $$
  select
    (select count(*) from public.submissions
      where user_id = auth.uid()
        and created_at >= current_date) as today_count,
    (select count(*) from public.submissions where user_id = auth.uid()) as total_words,
    (select count(*) from public.submissions
      where user_id = auth.uid()
        and cultural_note is not null and length(trim(cultural_note)) > 0) as notes,
    (select count(distinct language_id) from public.submissions where user_id = auth.uid()) as languages,
    (select count(*) from public.submissions
      where user_id = auth.uid() and agreed_with_consensus = true) as agreed,
    (select count(distinct t.id) from public.translations t
      join public.submissions s on s.base_word_id = t.base_word_id and s.language_id = t.language_id
      where s.user_id = auth.uid() and t.status = 'verified') as verified,
    (select coalesce(sum(amount), 0) from public.xp_events
      where user_id = auth.uid()
        and created_at >= date_trunc('week', now())) as week_xp,
    (select rank from (
      select id, rank() over (order by xp desc) as rank from public.profiles
    ) r where id = auth.uid()) as rank,
    (select count(*) from public.user_badges where user_id = auth.uid()) as badges;
$$;

-- ── Reviewer functions ────────────────────────────────────────
create or replace function public.admin_exists()
returns boolean language sql security definer as $$
  select exists(select 1 from public.user_roles where role = 'admin');
$$;

create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer as $$
begin
  if exists(select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  insert into public.user_roles (user_id, role) values (auth.uid(), 'reviewer')
    on conflict do nothing;
  return true;
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql security definer as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.promote_candidate(_candidate_id uuid, _note text default null)
returns uuid language plpgsql security definer as $$
declare
  c public.candidates%rowtype;
  prev_id uuid;
  new_version int := 1;
  new_id uuid;
begin
  -- permission check
  if not public.has_role(auth.uid(), 'reviewer') and not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer role required';
  end if;

  select * into c from public.candidates where id = _candidate_id;

  -- archive previous verified translation for this word+language
  select id, version into prev_id, new_version
  from public.translations
  where base_word_id = c.base_word_id and language_id = c.language_id
    and status = 'verified'
  order by version desc limit 1;

  if prev_id is not null then
    update public.translations set status = 'archived' where id = prev_id;
    new_version := new_version + 1;
  end if;

  -- insert new verified translation
  insert into public.translations
    (base_word_id, language_id, translated_text, confidence, version, status, verified_by, supersedes_id)
  values
    (c.base_word_id, c.language_id, c.display_text, c.confidence, new_version, 'verified', auth.uid(), prev_id)
  returning id into new_id;

  -- mark candidate as promoted
  update public.candidates set
    status = 'promoted', reviewed_by = auth.uid(), reviewed_at = now(), reviewer_note = _note
  where id = _candidate_id;

  -- audit trail
  insert into public.translation_history
    (translation_id, candidate_id, actor_id, event_type, new_status, comment)
  values (new_id, _candidate_id, auth.uid(), 'promoted', 'verified', _note);

  return new_id;
end;
$$;

create or replace function public.reject_candidate(_candidate_id uuid, _note text default null)
returns void language plpgsql security definer as $$
begin
  if not public.has_role(auth.uid(), 'reviewer') and not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer role required';
  end if;

  update public.candidates set
    status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reviewer_note = _note
  where id = _candidate_id;

  insert into public.translation_history
    (candidate_id, actor_id, event_type, new_status, comment)
  values (_candidate_id, auth.uid(), 'rejected', 'rejected', _note);
end;
$$;

-- ── Badge evaluation ──────────────────────────────────────────
create or replace function public.evaluate_badges(_user_id uuid)
returns void language plpgsql security definer as $$
declare
  total_words int;
  total_notes int;
  total_langs int;
  current_streak int;
begin
  select
    count(*),
    count(*) filter (where cultural_note is not null and length(trim(cultural_note)) > 0),
    count(distinct language_id)
  into total_words, total_notes, total_langs
  from public.submissions where user_id = _user_id;

  select streak_current into current_streak from public.profiles where id = _user_id;

  -- word count badges
  if total_words >= 1   then perform public.grant_badge(_user_id, 'first_word'); end if;
  if total_words >= 50  then perform public.grant_badge(_user_id, 'word_50'); end if;
  if total_words >= 200 then perform public.grant_badge(_user_id, 'word_200'); end if;
  if total_words >= 500 then perform public.grant_badge(_user_id, 'word_500'); end if;

  -- note badges
  if total_notes >= 1  then perform public.grant_badge(_user_id, 'first_note'); end if;
  if total_notes >= 10 then perform public.grant_badge(_user_id, 'notes_10'); end if;

  -- multilingual
  if total_langs >= 2 then perform public.grant_badge(_user_id, 'multilingual'); end if;
  if total_langs >= 5 then perform public.grant_badge(_user_id, 'polyglot'); end if;

  -- streak
  if current_streak >= 7  then perform public.grant_badge(_user_id, 'streak_7'); end if;
  if current_streak >= 30 then perform public.grant_badge(_user_id, 'streak_30'); end if;
end;
$$;

create or replace function public.grant_badge(_user_id uuid, _code text)
returns void language plpgsql security definer as $$
declare
  reward int;
begin
  if not exists(select 1 from public.user_badges where user_id = _user_id and badge_code = _code) then
    if exists(select 1 from public.badges where code = _code) then
      insert into public.user_badges (user_id, badge_code) values (_user_id, _code);
      select xp_reward into reward from public.badges where code = _code;
      perform public.award_xp(_user_id, reward, 'badge:' || _code);
    end if;
  end if;
end;
$$;

-- evaluate badges after each submission
create or replace function public.after_submission_badges()
returns trigger language plpgsql security definer as $$
begin
  perform public.evaluate_badges(new.user_id);
  return new;
end;
$$;

drop trigger if exists after_submission_badges on public.submissions;
create trigger after_submission_badges
  after insert on public.submissions
  for each row execute procedure public.after_submission_badges();

-- ── Seed data ─────────────────────────────────────────────────

-- Languages (major Tanzanian languages)
insert into public.languages (code, name, family, target_word_count) values
  ('suk', 'Sukuma',     'Bantu', 500),
  ('nya', 'Nyamwezi',   'Bantu', 500),
  ('heh', 'Hehe',       'Bantu', 500),
  ('chg', 'Chagga',     'Bantu', 500),
  ('mak', 'Makonde',    'Bantu', 500),
  ('yao', 'Yao',        'Bantu', 500),
  ('gog', 'Gogo',       'Bantu', 500),
  ('ben', 'Bena',       'Bantu', 500),
  ('kur', 'Kurya',      'Bantu', 500),
  ('zar', 'Zaramo',     'Bantu', 500)
on conflict (code) do nothing;

-- Base words (50 starter Swahili words across categories)
insert into public.base_words (swahili_word, english_word, category) values
  ('maji',      'water',       'nature'),
  ('moto',      'fire',        'nature'),
  ('ardhi',     'earth/soil',  'nature'),
  ('jua',       'sun',         'nature'),
  ('mvua',      'rain',        'nature'),
  ('mti',       'tree',        'nature'),
  ('nyumba',    'house',       'dwelling'),
  ('chakula',   'food',        'sustenance'),
  ('mkate',     'bread',       'sustenance'),
  ('nyama',     'meat',        'sustenance'),
  ('samaki',    'fish',        'sustenance'),
  ('maziwa',    'milk',        'sustenance'),
  ('mama',      'mother',      'family'),
  ('baba',      'father',      'family'),
  ('mtoto',     'child',       'family'),
  ('ndugu',     'sibling',     'family'),
  ('babu',      'grandfather', 'family'),
  ('bibi',      'grandmother', 'family'),
  ('mke',       'wife',        'family'),
  ('mume',      'husband',     'family'),
  ('rafiki',    'friend',      'social'),
  ('jirani',    'neighbour',   'social'),
  ('mkutano',   'meeting',     'social'),
  ('harusi',    'wedding',     'social'),
  ('mazishi',   'funeral',     'social'),
  ('shamba',    'farm/field',  'agriculture'),
  ('jembe',     'hoe',         'agriculture'),
  ('panga',     'machete',     'agriculture'),
  ('mbegu',     'seed',        'agriculture'),
  ('mavuno',    'harvest',     'agriculture'),
  ('ng''ombe',  'cow',         'animals'),
  ('mbuzi',     'goat',        'animals'),
  ('kondoo',    'sheep',       'animals'),
  ('kuku',      'chicken',     'animals'),
  ('mbwa',      'dog',         'animals'),
  ('paka',      'cat',         'animals'),
  ('simba',     'lion',        'animals'),
  ('tembo',     'elephant',    'animals'),
  ('nzige',     'locust',      'animals'),
  ('nyoka',     'snake',       'animals'),
  ('nzuri',     'good/nice',   'adjectives'),
  ('baya',      'bad',         'adjectives'),
  ('kubwa',     'big',         'adjectives'),
  ('ndogo',     'small',       'adjectives'),
  ('mzee',      'elder/old',   'adjectives'),
  ('kwenda',    'to go',       'verbs'),
  ('kuja',      'to come',     'verbs'),
  ('kula',      'to eat',      'verbs'),
  ('kunywa',    'to drink',    'verbs'),
  ('kulala',    'to sleep',    'verbs')
on conflict do nothing;

-- Badges
insert into public.badges (code, name, description, icon, tier, xp_reward, sort_order) values
  ('first_word',  'First Word',      'Submitted your very first translation',         'Feather',    'bronze', 20,  1),
  ('word_50',     'Word Collector',  'Submitted 50 translations',                     'BookOpen',   'bronze', 50,  2),
  ('word_200',    'Scribe',          'Submitted 200 translations',                    'ScrollText', 'silver', 100, 3),
  ('word_500',    'Archivist',       'Submitted 500 translations',                    'Library',    'gold',   250, 4),
  ('first_note',  'Culture Keeper',  'Added your first cultural note',                'Landmark',   'bronze', 15,  5),
  ('notes_10',    'Story Weaver',    'Added 10 cultural notes',                       'Sparkles',   'silver', 75,  6),
  ('multilingual','Bilingual',       'Contributed in 2 or more languages',            'Languages',  'bronze', 30,  7),
  ('polyglot',    'Polyglot',        'Contributed in 5 or more languages',            'Globe',      'gold',   150, 8),
  ('streak_7',    '7-Day Flame',     'Maintained a 7-day streak',                     'Flame',      'silver', 75,  9),
  ('streak_30',   'Month Guardian',  'Maintained a 30-day streak',                    'ShieldCheck','gold',   300, 10),
  ('consensus_1', 'First Consensus', 'Your answer matched the community consensus',   'Users',      'bronze', 20,  11),
  ('top_10',      'Top Contributor', 'Reached the top 10 on the leaderboard',         'Crown',      'legend', 500, 12)
on conflict (code) do nothing;

-- =============================================================
-- DONE. Your Kikabila database is ready.
-- =============================================================
