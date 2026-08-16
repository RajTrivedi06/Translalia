-- =============================================================================
-- SECURITY: soft-deprecate the accepted-version functions
-- =============================================================================
-- Date: 2026-08-16
--
-- WHAT AND WHY
-- accept_line, ensure_accepted_version and get_accepted_version have zero
-- references in the application: a search of src/, scripts/ and every .ts/.tsx/
-- .js/.mjs/.sql/.md file in the repo returns nothing, including camelCase
-- spellings. The complete live RPC surface is diary_completed_poems, exec_sql,
-- patch_thread_state_field and a jsonb_set probe. The backing schema looks
-- equally dead — chat_threads.accepted_version_id and the `versions` table have
-- no code references either.
--
-- REVOKE RATHER THAN DROP — DELIBERATE
-- The evidence above only covers this repository. A saved dashboard query, an
-- internal tool, or another client could still call these, and that cannot be
-- ruled out from the code. DROP is irreversible; REVOKE is one line to undo.
-- So: soft-deprecate, watch, then drop — the same pattern used for tables.
--
-- REVIEW DATE: 2026-09-13 (~4 weeks). If nothing has broken and no permission
-- errors referencing these names appear in the logs by then, follow up with a
-- DROP migration. If something does break, re-grant:
--
--   GRANT EXECUTE ON FUNCTION public.accept_line(uuid, integer, text, uuid) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.ensure_accepted_version(uuid) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.get_accepted_version(uuid) TO authenticated;
--
-- EXPLICITLY OUT OF SCOPE
-- chat_threads.accepted_version_id, its foreign key, the `versions` table,
-- chat_threads_accepted_version_unique_idx and
-- versions_one_accepted_per_thread_idx are all left completely alone. Whether
-- that data should go is a separate decision on separate evidence.
-- =============================================================================

DO $$
DECLARE
  target      text;
  targets     text[] := ARRAY[
    'public.accept_line(uuid, integer, text, uuid)',
    'public.ensure_accepted_version(uuid)',
    'public.get_accepted_version(uuid)'
  ];
  revoked     int := 0;
  absent      int := 0;
BEGIN
  FOREACH target IN ARRAY targets LOOP
    -- to_regprocedure returns NULL rather than erroring for a missing
    -- function, so a database that never had these applies cleanly.
    IF to_regprocedure(target) IS NULL THEN
      absent := absent + 1;
      RAISE NOTICE 'not present, nothing to revoke: %', target;
      CONTINUE;
    END IF;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', target);
    -- Belt and braces: PUBLIC and anon were revoked on 2026-08-15, but a
    -- re-created function would silently inherit the PUBLIC default again.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', target);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', target);

    EXECUTE format(
      'COMMENT ON FUNCTION %s IS %L',
      target,
      'SOFT-DEPRECATED 2026-08-16: no references in the application. EXECUTE '
      'revoked from authenticated/anon/PUBLIC. Scheduled for DROP after '
      '2026-09-13 if nothing breaks. Re-grant to authenticated to restore.'
    );

    revoked := revoked + 1;
    RAISE NOTICE 'revoked + commented: %', target;
  END LOOP;

  RAISE NOTICE 'accepted-version soft-deprecation: % revoked, % absent.',
    revoked, absent;
END;
$$;


-- -----------------------------------------------------------------------------
-- ASSERT — nothing but the intended grants remain
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  still_granted text;
BEGIN
  SELECT string_agg(format('%s → %s', p.proname, a.grantee), ', ')
  INTO still_granted
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE n.nspname = 'public'
    AND p.proname IN ('accept_line', 'ensure_accepted_version', 'get_accepted_version')
    AND a.privilege_type = 'EXECUTE'
    AND r.rolname IN ('authenticated', 'anon');

  IF still_granted IS NOT NULL THEN
    RAISE EXCEPTION 'EXECUTE still granted after revoke: %', still_granted;
  END IF;

  RAISE NOTICE 'VERIFIED: accepted-version functions unreachable by authenticated/anon.';
END;
$$;
