-- =============================================================================
-- Migration: Diary Completed Poems RPC
-- =============================================================================
-- Creates RPC function to fetch completed poems for Diary page.
-- Uses SECURITY INVOKER to rely on auth.uid() for user filtering.
-- Returns only necessary fields (not full state blob) for performance.
-- =============================================================================

-- 1A) Add supporting indexes for fast lookups

create index if not exists journey_ai_summaries_thread_created_at_idx
on public.journey_ai_summaries (thread_id, created_at desc);

create index if not exists chat_threads_created_by_created_at_idx
on public.chat_threads (created_by, created_at desc);

-- 1B) Create RPC function

create or replace function public.diary_completed_poems(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  thread_id uuid,
  title text,
  thread_created_at timestamptz,
  raw_poem text,
  workshop_lines jsonb,
  notebook_notes jsonb,
  journey_summary_created_at timestamptz,
  reflection_text text,
  insights text[],
  strengths text[],
  challenges text[],
  recommendations text[]
)
language sql
security invoker
set search_path = public
as $$
  select
    ct.id as thread_id,
    ct.title,
    ct.created_at as thread_created_at,
    ct.raw_poem,
    ct.state->'workshop_lines' as workshop_lines,
    ct.state->'notebook_notes' as notebook_notes,

    jas.created_at as journey_summary_created_at,
    jas.reflection_text,
    jas.insights,
    jas.strengths,
    jas.challenges,
    jas.recommendations
  from public.chat_threads ct
  left join lateral (
    select s.*
    from public.journey_ai_summaries s
    where s.thread_id = ct.id
    order by s.created_at desc
    limit 1
  ) jas on true
  where
    ct.created_by = auth.uid()

    -- pagination (DESC order)
    and (
      p_before_created_at is null
      or (ct.created_at, ct.id) < (p_before_created_at, p_before_id)
    )

    -- must have workshop_lines array
    and ct.state ? 'workshop_lines'
    and jsonb_typeof(ct.state->'workshop_lines') = 'array'
    and jsonb_array_length(ct.state->'workshop_lines') > 0

    -- completion: no nulls + every element has translated
    and not exists (
      select 1
      from jsonb_array_elements(ct.state->'workshop_lines') as e
      where
        e = 'null'::jsonb
        or coalesce(nullif(e->>'translated',''), '') = ''
    )
  order by ct.created_at desc, ct.id desc
  limit greatest(1, least(p_limit, 50));
$$;

-- 1C) Grant permissions

grant execute on function public.diary_completed_poems(integer, timestamptz, uuid) to authenticated;

-- Add comment explaining the function's purpose
comment on function public.diary_completed_poems is
  'Returns completed poems for the authenticated user. A poem is completed when all workshop_lines have non-empty translated fields. Includes latest journey summary per thread.';
