-- =============================================================================
-- ⚠ NOT APPLIED — DO NOT RUN YET
-- =============================================================================
-- Drop the insecure 4-argument patch_thread_state_field.
--
-- This file lives outside supabase/migrations/ so it is not picked up by
-- `supabase db push`. Move it in, with the date prefix set to the day it is
-- actually applied, only once every precondition below holds.
--
-- WHAT IT REMOVES
--   patch_thread_state_field(p_thread_id uuid, p_user_id uuid,
--                            p_path text[], p_value jsonb)
-- Superseded by the 3-arg overload added in
-- 20260816_02_patch_thread_state_field_authuid.sql, which derives the owner
-- from auth.uid() instead of trusting a caller-supplied p_user_id (F-04-012).
--
-- PRECONDITIONS — all must hold
--   1. 20260816_02 applied and verified in production.
--   2. The application deploy that switches patchThreadStateField() to the
--      3-arg call is live, and has been for long enough to be confident
--      (suggest one full week).
--   3. All five write paths verified working against the new overload:
--      notebook_notes (thread note), notebook_notes (line note),
--      express_your_view, variant_recipes_v3, translation_insights.
--   4. No 4-arg calls remain. Confirm from the application side — the repo
--      should contain no p_user_id key in any rpc() body:
--
--        grep -rn "p_user_id" translalia-web/src/
--
--      and from the database side, if pg_stat_statements is available:
--
--        SELECT calls, query FROM pg_stat_statements
--        WHERE query ILIKE '%patch_thread_state_field%'
--          AND query ILIKE '%p_user_id%';
--
--   5. A rollback is available. Re-creating this function needs its full body;
--      it is preserved verbatim in the ROLLBACK section at the foot of this
--      file, and also in 20240117_add_exec_sql_rpc.sql.
-- =============================================================================

DO $$
BEGIN
  IF to_regprocedure('public.patch_thread_state_field(uuid, text[], jsonb)') IS NULL THEN
    RAISE EXCEPTION
      'refusing to drop: the 3-arg replacement does not exist. Apply 20260816_02 first.';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.patch_thread_state_field(uuid, uuid, text[], jsonb);

DO $$
BEGIN
  IF to_regprocedure('public.patch_thread_state_field(uuid, uuid, text[], jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'drop did not take effect';
  END IF;
  RAISE NOTICE 'VERIFIED: 4-arg patch_thread_state_field removed; 3-arg overload remains.';
END;
$$;


-- =============================================================================
-- ROLLBACK — recreates the dropped function exactly as it was
-- =============================================================================
-- Body copied verbatim from 20240117_add_exec_sql_rpc.sql, with the
-- search_path pin from 20260816_01 applied so the restored function is not
-- itself a regression.
--
-- CREATE OR REPLACE FUNCTION public.patch_thread_state_field(
--   p_thread_id uuid,
--   p_user_id   uuid,
--   p_path      text[],
--   p_value     jsonb
-- )
-- RETURNS boolean
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public, pg_temp
-- AS $fn$
-- DECLARE
--   affected_rows int;
-- BEGIN
--   UPDATE chat_threads
--   SET state = jsonb_set(COALESCE(state, '{}'::jsonb), p_path, p_value)
--   WHERE id = p_thread_id AND created_by = p_user_id;
--
--   GET DIAGNOSTICS affected_rows = ROW_COUNT;
--   RETURN affected_rows > 0;
-- END;
-- $fn$;
--
-- REVOKE ALL ON FUNCTION public.patch_thread_state_field(uuid, uuid, text[], jsonb) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.patch_thread_state_field(uuid, uuid, text[], jsonb) FROM anon;
-- GRANT EXECUTE ON FUNCTION public.patch_thread_state_field(uuid, uuid, text[], jsonb) TO authenticated;
