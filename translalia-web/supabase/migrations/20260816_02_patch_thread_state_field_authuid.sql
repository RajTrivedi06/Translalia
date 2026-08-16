-- =============================================================================
-- SECURITY: auth.uid()-derived thread state patching (F-04-012, F-04-007)
-- =============================================================================
-- Date: 2026-08-16
--
-- WHAT THIS FIXES
-- The existing patch_thread_state_field(uuid, uuid, text[], jsonb) takes the
-- owner id as a CALLER-SUPPLIED p_user_id and matches on it. A SECURITY
-- DEFINER function that trusts a caller-supplied identity is not an ownership
-- check — any authenticated caller can pass any uuid. This adds a 3-argument
-- overload that derives the user from auth.uid() instead, which the caller
-- cannot forge.
--
-- OVERLOAD, NOT REPLACEMENT — DELIBERATE
-- The 4-arg function currently backs notebook_notes, variant_recipes_v3,
-- express_your_view, translation_insights and refine_rhyme. Dropping and
-- recreating would break every one of those write paths for the duration of
-- the migration, with no rollback if the recreate failed. The overload lets us
-- deploy, verify, then remove the old signature separately — see
-- supabase/pending-migrations/ for the drop, which is NOT to be applied yet.
--
-- The residual exposure is narrow: PUBLIC and anon were revoked from all nine
-- SECURITY DEFINER functions on 2026-08-15, so only signed-in users can reach
-- the 4-arg signature at all.
--
-- POSTGRES OVERLOAD RESOLUTION
-- 3-arg and 4-arg signatures are unambiguous — they differ in arity, so no
-- call can resolve to the wrong one. PostgREST dispatches on the JSON body's
-- key set, so a body of {p_thread_id, p_path, p_value} reaches the new
-- function and {p_thread_id, p_user_id, p_path, p_value} reaches the old one.
--
-- Both functions below pin search_path (see migration 01 for the rationale).
-- auth.uid() is schema-qualified, so it resolves regardless of the pinned path.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. patch_thread_state_field(uuid, text[], jsonb) — SET a path
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patch_thread_state_field(
  p_thread_id uuid,
  p_path      text[],
  p_value     jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user        uuid := auth.uid();
  affected_rows int;
BEGIN
  -- Fail closed. Without this an unauthenticated context would compare
  -- created_by = NULL, match nothing, and return false — which reads as
  -- "thread not found" rather than "not signed in".
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'patch_thread_state_field: no authenticated user'
      USING ERRCODE = '28000';
  END IF;

  -- jsonb_set with a NULL or empty path is a silent no-op; reject it so a
  -- malformed call is visible instead of quietly doing nothing.
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'patch_thread_state_field: p_path must be a non-empty path'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_threads
  SET state = jsonb_set(COALESCE(state, '{}'::jsonb), p_path, p_value, true)
  WHERE id = p_thread_id
    AND created_by = v_user;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.patch_thread_state_field(uuid, text[], jsonb) IS
  'Atomically sets a single path in chat_threads.state. Ownership derived from '
  'auth.uid(), not from a caller-supplied id. Supersedes the 4-arg overload.';

REVOKE ALL ON FUNCTION public.patch_thread_state_field(uuid, text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.patch_thread_state_field(uuid, text[], jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.patch_thread_state_field(uuid, text[], jsonb) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. delete_thread_state_field(uuid, text[]) — REMOVE a path
-- -----------------------------------------------------------------------------
-- jsonb_set cannot remove a key. Clearing legacy state.guide_answers by
-- "setting it to null" leaves the key present with a JSON null value, which is
-- not the same thing and is why that cleanup never worked (F-04-007). The
-- `#-` operator deletes the path outright.
CREATE OR REPLACE FUNCTION public.delete_thread_state_field(
  p_thread_id uuid,
  p_path      text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user        uuid := auth.uid();
  affected_rows int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'delete_thread_state_field: no authenticated user'
      USING ERRCODE = '28000';
  END IF;

  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'delete_thread_state_field: p_path must be a non-empty path'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_threads
  SET state = COALESCE(state, '{}'::jsonb) #- p_path
  WHERE id = p_thread_id
    AND created_by = v_user;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

COMMENT ON FUNCTION public.delete_thread_state_field(uuid, text[]) IS
  'Atomically removes a path from chat_threads.state using #-. Ownership from '
  'auth.uid(). Use instead of setting a key to JSON null.';

REVOKE ALL ON FUNCTION public.delete_thread_state_field(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_thread_state_field(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_thread_state_field(uuid, text[]) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. ASSERT — both overloads present, both pinned, old one still intact
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.patch_thread_state_field(uuid, text[], jsonb)') IS NULL THEN
    RAISE EXCEPTION '3-arg patch_thread_state_field was not created';
  END IF;

  IF to_regprocedure('public.delete_thread_state_field(uuid, text[])') IS NULL THEN
    RAISE EXCEPTION 'delete_thread_state_field was not created';
  END IF;

  -- The old signature must SURVIVE this migration. If it is gone, the five
  -- existing write paths are broken and this migration did the thing it was
  -- explicitly designed not to do.
  IF to_regprocedure('public.patch_thread_state_field(uuid, uuid, text[], jsonb)') IS NULL THEN
    RAISE EXCEPTION
      '4-arg patch_thread_state_field is MISSING — existing write paths would break';
  END IF;

  RAISE NOTICE 'VERIFIED: 3-arg + delete created, 4-arg still present.';
END;
$$;
