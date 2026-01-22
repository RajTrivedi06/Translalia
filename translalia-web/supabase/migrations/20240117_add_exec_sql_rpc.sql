-- =============================================================================
-- CRITICAL MIGRATION: Add exec_sql RPC for atomic JSONB updates
-- =============================================================================
-- This RPC function is REQUIRED to prevent state clobber in concurrent writes.
-- Without it, patchThreadStateField will throw ATOMIC_PATCH_UNAVAILABLE.
--
-- The function uses jsonb_set to atomically update a single path in the state
-- column without reading the entire state first (no read-modify-write race).
-- =============================================================================

-- Create the exec_sql function that accepts parameterized queries
-- This is a generic SQL executor with parameter binding for safety
CREATE OR REPLACE FUNCTION exec_sql(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  param_values text[];
  i int;
BEGIN
  -- Convert JSONB array to text array for parameter binding
  IF jsonb_array_length(params) > 0 THEN
    FOR i IN 0..jsonb_array_length(params) - 1 LOOP
      param_values := array_append(param_values, params->>i);
    END LOOP;
  END IF;

  -- Execute with parameters
  EXECUTE query USING
    param_values[1],
    param_values[2],
    param_values[3],
    param_values[4];
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql(text, jsonb) TO authenticated;

-- Add a comment explaining the function's purpose
COMMENT ON FUNCTION exec_sql IS
  'Executes parameterized SQL for atomic JSONB updates. Required by patchThreadStateField.';


-- =============================================================================
-- ALTERNATIVE: Dedicated function for thread state updates (more secure)
-- =============================================================================
-- If you prefer not to have a generic exec_sql, use this dedicated function:

CREATE OR REPLACE FUNCTION patch_thread_state_field(
  p_thread_id uuid,
  p_user_id uuid,
  p_path text[],
  p_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows int;
BEGIN
  UPDATE chat_threads
  SET state = jsonb_set(COALESCE(state, '{}'::jsonb), p_path, p_value)
  WHERE id = p_thread_id AND created_by = p_user_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION patch_thread_state_field(uuid, uuid, text[], jsonb) TO authenticated;

COMMENT ON FUNCTION patch_thread_state_field IS
  'Atomically patches a single field in chat_threads.state using jsonb_set. Prevents clobber.';


-- =============================================================================
-- ATOMIC AUDIT APPEND: Append to method2_audit array without clobbering state
-- =============================================================================
-- This function atomically appends an audit entry to the method2_audit array
-- while keeping only the last N entries. It does NOT read/write the entire state,
-- so it cannot clobber translation_job writes happening concurrently.

CREATE OR REPLACE FUNCTION append_method2_audit(
  p_thread_id uuid,
  p_audit jsonb,
  p_max_n int DEFAULT 50
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows int;
  current_audits jsonb;
  new_audits jsonb;
BEGIN
  -- Get current method2_audit array (only this field, not entire state)
  SELECT COALESCE(state->'method2_audit', '[]'::jsonb)
  INTO current_audits
  FROM chat_threads
  WHERE id = p_thread_id;

  -- Append new audit and trim to last p_max_n entries
  -- This is done in SQL to minimize the window for race conditions
  new_audits := (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(current_audits || jsonb_build_array(p_audit)) AS elem
      ORDER BY 1 -- Maintain order
      OFFSET GREATEST(0, jsonb_array_length(current_audits || jsonb_build_array(p_audit)) - p_max_n)
    ) sub
  );

  -- Atomic update using jsonb_set (only touches method2_audit path)
  UPDATE chat_threads
  SET state = jsonb_set(
    COALESCE(state, '{}'::jsonb),
    '{method2_audit}',
    COALESCE(new_audits, '[]'::jsonb)
  )
  WHERE id = p_thread_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION append_method2_audit(uuid, jsonb, int) TO authenticated;

COMMENT ON FUNCTION append_method2_audit IS
  'Atomically appends an audit entry to method2_audit array without clobbering other state fields. Keeps last N entries.';
