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
