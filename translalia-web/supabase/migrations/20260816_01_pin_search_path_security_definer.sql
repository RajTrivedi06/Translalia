-- =============================================================================
-- SECURITY: pin search_path on every SECURITY DEFINER function
-- =============================================================================
-- Date: 2026-08-16
--
-- THREAT
-- A SECURITY DEFINER function with no pinned search_path inherits the CALLER's
-- search_path. Any role that can create objects in a schema on that path can
-- shadow a table or function name the function references unqualified; the
-- function then operates on the attacker's object while running with the
-- definer's privileges. Pinning the path to a fixed value defeats this
-- completely, because the caller's setting no longer applies.
--
-- WHY ALTER FUNCTION AND NOT CREATE OR REPLACE
-- Four of the nine target functions have no definition anywhere in this repo
-- (add_owner_membership, append_thread_audit, llm_schema_context,
-- llm_schema_context_v2 were created out of band). CREATE OR REPLACE requires
-- the full body, which we do not have and must not guess at. ALTER FUNCTION
-- ... SET search_path changes only the config, leaves the body untouched, and
-- is exactly the tool for this. It is also strictly lower-risk: there is no
-- way for it to alter behaviour other than name resolution.
--
-- The DO block below iterates pg_proc rather than naming signatures, because
-- we do not know the argument lists of those same four functions. It is
-- idempotent: functions that already pin a search_path are skipped and
-- reported.
--
-- ⚠ PRE-FLIGHT — RUN SECTION 0 BEFORE APPLYING THIS MIGRATION
-- Pinning to `public, pg_temp` will BREAK any function whose body calls an
-- extension function unqualified (uuid_generate_v4(), crypt(), digest(), …),
-- because Supabase installs those into the `extensions` schema and it will no
-- longer be on the path. Section 0 lists every candidate body so this can be
-- checked. If any function needs it, change the two occurrences of
-- `public, pg_temp` below to `public, extensions, pg_temp` — that still fully
-- defeats the hijack, since the caller can no longer influence the path.
--
-- Note: pg_temp is deliberately LAST. Placing it earlier would let a caller
-- shadow objects with temporary ones, which is the same class of attack.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 0 — PRE-FLIGHT (read-only; run this first, apply nothing)
-- -----------------------------------------------------------------------------
-- Lists every SECURITY DEFINER function in `public`, whether it already pins a
-- search_path, and flags bodies that reference known extension functions
-- unqualified. Investigate anything flagged `REVIEW` before proceeding.
--
--   SELECT
--     p.proname,
--     pg_get_function_identity_arguments(p.oid)      AS args,
--     COALESCE(
--       (SELECT c FROM unnest(p.proconfig) c WHERE c LIKE 'search\_path=%'),
--       '(none — will be pinned)'
--     )                                              AS current_search_path,
--     CASE
--       WHEN p.prosrc ~* '(?<!extensions\.)\m(uuid_generate_v[0-9]|crypt|gen_salt|digest|hmac|pgp_sym_)'
--       THEN 'REVIEW — may need extensions on the path'
--       ELSE 'ok'
--     END                                            AS extension_risk
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef
--   ORDER BY p.proname;


-- -----------------------------------------------------------------------------
-- SECTION 1 — APPLY
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn         record;
  pinned     int := 0;
  skipped    int := 0;
  stmt       text;
BEGIN
  FOR fn IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args,
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search\_path=%'
      ) AS already_pinned
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                      -- SECURITY DEFINER only
    ORDER BY p.proname
  LOOP
    IF fn.already_pinned THEN
      skipped := skipped + 1;
      RAISE NOTICE 'skip (already pinned): %(%)', fn.proname, fn.args;
      CONTINUE;
    END IF;

    stmt := format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      fn.proname, fn.args
    );
    EXECUTE stmt;
    pinned := pinned + 1;
    RAISE NOTICE 'pinned: %(%)', fn.proname, fn.args;
  END LOOP;

  RAISE NOTICE 'search_path pinned on % function(s); % already pinned.',
    pinned, skipped;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 2 — ASSERT
-- -----------------------------------------------------------------------------
-- Fails the migration loudly if any SECURITY DEFINER function in `public` is
-- still unpinned, rather than reporting success on a partial result.
DO $$
DECLARE
  unpinned text;
BEGIN
  SELECT string_agg(format('%s(%s)', p.proname,
                           pg_get_function_identity_arguments(p.oid)), ', ')
  INTO unpinned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
      WHERE c LIKE 'search\_path=%'
    );

  IF unpinned IS NOT NULL THEN
    RAISE EXCEPTION
      'search_path still unpinned on SECURITY DEFINER function(s): %', unpinned;
  END IF;

  RAISE NOTICE 'VERIFIED: every SECURITY DEFINER function in public pins a search_path.';
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 3 — COVERAGE CHECK against the expected inventory
-- -----------------------------------------------------------------------------
-- The investigation named nine SECURITY DEFINER functions. This reports which
-- of them are actually present, so a missing one is noticed rather than
-- silently assumed handled. It does NOT fail the migration: a function absent
-- from production is fine (and is itself useful information).
--
-- Note: `append_method2_audit` is SECURITY DEFINER in
-- 20240117_add_exec_sql_rpc.sql but was NOT among the nine. If Section 1
-- reports pinning it, the inventory of nine was incomplete.
DO $$
DECLARE
  expected text[] := ARRAY[
    'accept_line', 'add_owner_membership', 'append_thread_audit',
    'ensure_accepted_version', 'exec_sql', 'get_accepted_version',
    'llm_schema_context', 'llm_schema_context_v2', 'patch_thread_state_field'
  ];
  name text;
  found int;
BEGIN
  FOREACH name IN ARRAY expected LOOP
    SELECT count(*) INTO found
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = name AND p.prosecdef;

    IF found = 0 THEN
      RAISE NOTICE 'NOT PRESENT in this database: %', name;
    ELSE
      RAISE NOTICE 'present (% overload(s)): %', found, name;
    END IF;
  END LOOP;
END;
$$;
