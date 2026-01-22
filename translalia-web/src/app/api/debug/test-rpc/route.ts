// TEMP DEBUG - Test exec_sql RPC availability
// DELETE AFTER VERIFYING RPC IS WORKING
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type TestResult = {
  available: boolean;
  error: { code: string; message: string } | string | null;
  data: unknown;
};

type Results = {
  timestamp: string;
  userId: string;
  exec_sql_test?: TestResult;
  patch_thread_state_field_test?: TestResult;
  jsonb_set_test?: TestResult;
  summary?: {
    exec_sql_available: boolean;
    jsonb_set_works: boolean;
    patchThreadStateField_will_work: boolean;
    recommendation: string;
  };
};

export async function GET() {
  const supabase = await supabaseServer();
  
  // Try to get user (optional for debug endpoint)
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // No auth required for this debug endpoint
  }

  const results: Results = {
    timestamp: new Date().toISOString(),
    userId: userId ?? "unauthenticated",
  };

  // Test 1: exec_sql RPC (simple SELECT)
  try {
    const { data: execSqlData, error: execSqlError } = await supabase.rpc(
      "exec_sql",
      {
        query: "SELECT 1 as test_value",
        params: [],
      }
    );

    results.exec_sql_test = {
      available: !execSqlError,
      error: execSqlError
        ? {
            code: execSqlError.code,
            message: execSqlError.message,
          }
        : null,
      data: execSqlData,
    };
  } catch (err) {
    results.exec_sql_test = {
      available: false,
      error: err instanceof Error ? err.message : String(err),
      data: null,
    };
  }

  // Test 2: patch_thread_state_field RPC (if it exists)
  try {
    // Skip this test if no user (can't test with fake thread/user)
    if (!userId) {
      results.patch_thread_state_field_test = {
        available: false,
        error: "Skipped: No authenticated user",
        data: null,
      };
    } else {
      // Use a test path that won't affect real data
      const testThreadId = "00000000-0000-0000-0000-000000000000";
      const testPath = ["_debug_test"];
      const testValue = { test: true, timestamp: Date.now() };

      const { data: patchData, error: patchError } = await supabase.rpc(
        "patch_thread_state_field",
        {
          p_thread_id: testThreadId,
          p_user_id: userId,
          p_path: testPath,
          p_value: testValue,
        }
      );

      results.patch_thread_state_field_test = {
        available: !patchError,
        error: patchError
          ? {
              code: patchError.code,
              message: patchError.message,
            }
          : null,
        data: patchData,
      };
    }
  } catch (err) {
    results.patch_thread_state_field_test = {
      available: false,
      error: err instanceof Error ? err.message : String(err),
      data: null,
    };
  }

  // Test 3: Direct jsonb_set via exec_sql (what patchThreadStateField uses)
  try {
    const { data: jsonbSetData, error: jsonbSetError } = await supabase.rpc(
      "exec_sql",
      {
        query: `
          SELECT jsonb_set(
            COALESCE('{}'::jsonb, '{}'::jsonb),
            '{test}'::text[],
            '{"value": "test"}'::jsonb
          ) as result
        `,
        params: [],
      }
    );

    results.jsonb_set_test = {
      available: !jsonbSetError,
      error: jsonbSetError
        ? {
            code: jsonbSetError.code,
            message: jsonbSetError.message,
          }
        : null,
      data: jsonbSetData,
    };
  } catch (err) {
    results.jsonb_set_test = {
      available: false,
      error: err instanceof Error ? err.message : String(err),
      data: null,
    };
  }

  // Summary
  const execSqlAvailable = results.exec_sql_test?.available === true;
  const jsonbSetWorks =
    results.jsonb_set_test?.available === true &&
    results.jsonb_set_test?.error === null;

  results.summary = {
    exec_sql_available: execSqlAvailable,
    jsonb_set_works: jsonbSetWorks,
    patchThreadStateField_will_work: execSqlAvailable && jsonbSetWorks,
    recommendation: execSqlAvailable
      ? "✅ RPC is available - patchThreadStateField will work"
      : "❌ RPC not available - need to create exec_sql function",
  };

  return NextResponse.json(results);
}
