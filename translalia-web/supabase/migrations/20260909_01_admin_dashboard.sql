-- =============================================================================
-- Admin dashboard v1: admin allowlist + is_admin()
-- =============================================================================
-- Spec: docs/agent-temp/admin-dashboard-v1-scope.md
--
-- Admins are an email allowlist, not a column on profiles and not a user-id
-- table. profiles is upserted straight from the browser (useProfile.save), so
-- a role column there would be user-writable without extra grants. Keying on
-- email rather than user id means a person can be authorised before they have
-- an account: the check starts passing the first time they sign in.
--
-- No policies for authenticated on admin_emails. Rows are added from the SQL
-- console only, so adding a person never needs a deploy or a code change.
--
-- is_admin() is SECURITY DEFINER so it can read auth.users and so RLS on
-- admin_emails cannot recurse into itself (same reason is_project_member is
-- definer, see 20260816_04). search_path is pinned per 20260816_01.
--
-- Idempotent and safe to re-run.
-- =============================================================================

create table if not exists public.admin_emails (
  email      text primary key,
  note       text,
  added_at   timestamptz not null default now()
);

alter table public.admin_emails enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.admin_emails a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$fn$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  'True when the calling session''s email is on admin_emails. Gate for /admin and admin_* RPCs.';

-- Add admins from the SQL editor. Example (emails are compared lowercased):
-- insert into public.admin_emails (email, note)
-- values ('someone@example.org', 'client — Prof. Reynolds')
-- on conflict (email) do nothing;

-- =============================================================================
-- admin_overview(): everything the /admin page renders, as one JSON object.
-- =============================================================================
-- SECURITY DEFINER so it can read auth.users and every user's chat_threads
-- without loosening any RLS policy. Calls is_admin() first and raises P0002
-- (no_data_found) otherwise, which the app treats as a 404.
--
-- Returns counts, dates, language labels and display names only. Never poem
-- text, translated lines, notes or reflections. scripts/admin/verify-admin.ts
-- asserts that against real rows.
--
-- Field definitions: docs/agent-temp/admin-dashboard-v1-scope.md, "Definitions
-- behind admin_overview()". One deliberate narrowing: a line only enters the
-- by-hand ratio when it carries the explicit `source` stamp written by the save
-- routes. The older heuristic (empty word_options and selections means manual)
-- is wrong for method-2, whose generated variants are saved as full text with
-- no word data, so every such line looked hand-written. Lines without a stamp
-- are left out rather than guessed; the page drops the tile below 10 lines.
-- =============================================================================

create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $fn$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  with
  line_rows as (
    select t.id as thread_id, e.val
    from public.chat_threads t
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(t.state->'workshop_lines') = 'array'
           then t.state->'workshop_lines' else '[]'::jsonb end
    ) as e(val)
  ),
  line_facts as (
    select
      thread_id,
      (jsonb_typeof(val) = 'object' and coalesce(val->>'translated', '') <> '')       as saved,
      (jsonb_typeof(val) <> 'object' or coalesce(val->>'translated', '') = '')        as broken,
      (jsonb_typeof(val) = 'object' and val->>'source' in ('ai', 'manual'))             as classifiable,
      (jsonb_typeof(val) = 'object' and val->>'source' = 'manual')                       as manual,
      case when jsonb_typeof(val) = 'object' and (val->>'completedAt') ~ '^\d{4}-\d{2}-\d{2}'
           then (val->>'completedAt')::timestamptz end                                 as completed_at
    from line_rows
  ),
  thread_lines as (
    select thread_id,
           count(*)                        as n_elems,
           count(*) filter (where saved)   as n_saved,
           count(*) filter (where broken)  as n_broken,
           min(completed_at)               as first_saved_at,
           max(completed_at)               as last_saved_at
    from line_facts
    group by thread_id
  ),
  threads as (
    select
      t.id, t.created_by, t.created_at,
      coalesce(t.raw_poem, t.state->>'raw_poem', '') <> ''                             as started,
      (t.state ? 'translation_job')                                                    as ran,
      coalesce(tl.n_saved, 0)                                                          as lines_saved,
      (coalesce(tl.n_elems, 0) > 0 and coalesce(tl.n_broken, 0) = 0)                   as finished,
      tl.last_saved_at,
      nullif(lower(regexp_replace(trim(coalesce(t.source_language_variety, '')), '\s+', ' ', 'g')), '') as source_language,
      nullif(lower(trim(coalesce(t.state->'guide_answers'->'targetLanguage'->>'lang', ''))), '')        as target_language,
      (coalesce(t.state->>'express_your_view', '') <> ''
        or exists (select 1 from public.journey_reflections r where r.thread_id = t.id))              as reflected,
      case when (t.state->'notebook_notes'->>'updated_at') ~ '^\d{4}-'
           then (t.state->'notebook_notes'->>'updated_at')::timestamptz end                            as notes_updated_at
    from public.chat_threads t
    left join thread_lines tl on tl.thread_id = t.id
  ),
  users as (
    select
      u.id, u.last_sign_in_at, p.display_name, p.username,
      (select count(*) from threads th where th.created_by = u.id)                        as n_threads,
      (select count(*) filter (where th.finished) from threads th where th.created_by = u.id) as poems_finished,
      greatest(
        u.last_sign_in_at,
        (select max(greatest(th.created_at, th.last_saved_at, th.notes_updated_at)) from threads th where th.created_by = u.id),
        (select max(r.updated_at) from public.journey_reflections r where r.created_by = u.id)
      )                                                                                  as last_active
    from auth.users u
    left join public.profiles p on p.id = u.id
  ),
  hand as (
    select count(*) filter (where lf.manual) as manual, count(*) as classified
    from line_facts lf
    join threads th on th.id = lf.thread_id
    where th.finished and lf.saved and lf.classifiable
  ),
  growth as (
    select date_trunc('week', completed_at)::date as week, count(*) as lines
    from line_facts
    where saved and completed_at is not null
    group by 1
  ),
  lang_rows as (
    select source_language, target_language,
           count(*) filter (where finished) as poems_finished,
           count(*) filter (where started)  as poems_started
    from threads
    where source_language is not null
    group by 1, 2
  )
  select jsonb_build_object(
    'generated_at',        now(),
    'poems_finished',      (select count(*) from threads where finished),
    'poems_in_progress',   (select count(*) from threads where lines_saved > 0 and not finished),
    'lines_saved',         (select coalesce(sum(lines_saved), 0) from threads),
    'lines_undated',       (select count(*) from line_facts where saved and completed_at is null),
    'source_languages',    (select count(distinct source_language) from threads where source_language is not null),
    'target_languages',    (select count(distinct target_language) from threads where target_language is not null),
    'finished_with_pair',  (select count(*) from threads where finished and source_language is not null and target_language is not null),
    'pairings',            (select count(*) from (select distinct source_language, target_language from threads
                                                  where source_language is not null and target_language is not null) x),
    'translators',         (select count(*) from users where n_threads > 0),
    'active_30d',          (select count(*) from users where n_threads > 0 and last_active > now() - interval '30 days'),
    'reflections_written', (select count(*) from threads where reflected),
    'hand',                (select jsonb_build_object('manual', manual, 'classified', classified) from hand),
    'growth',              (select coalesce(jsonb_agg(jsonb_build_object('week', week, 'lines', lines) order by week), '[]'::jsonb) from growth),
    'languages',           (select coalesce(jsonb_agg(jsonb_build_object(
                              'source', source_language, 'target', target_language,
                              'poems_finished', poems_finished, 'poems_started', poems_started)
                              order by poems_finished desc, poems_started desc), '[]'::jsonb) from lang_rows),
    'funnel', jsonb_build_object(
      'started',          (select count(*) from threads where started),
      'ran',              (select count(*) from threads where ran),
      'saved_first_line', (select count(*) from threads where lines_saved > 0),
      'finished',         (select count(*) from threads where finished),
      'reflected',        (select count(*) from threads where reflected)),
    'recent_translators', (select coalesce(jsonb_agg(jsonb_build_object(
                             'name', coalesce(nullif(display_name, ''), nullif(username, ''), 'Translator ' || left(id::text, 4)),
                             'last_active', last_active,
                             'poems_finished', poems_finished) order by last_active desc), '[]'::jsonb)
                           from (select * from users where n_threads > 0 and last_active is not null
                                 order by last_active desc limit 8) r)
  ) into result;

  return result;
end
$fn$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

comment on function public.admin_overview() is
  'Admin dashboard v1 payload: counts, dates, language labels, display names. Raises P0002 unless is_admin().';
