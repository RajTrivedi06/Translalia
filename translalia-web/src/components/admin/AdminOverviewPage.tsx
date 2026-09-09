import type { SupabaseClient } from "@supabase/supabase-js";

// Placeholder until the overview RPC lands in the next commit.
export async function AdminOverviewPage({ sb }: { sb: SupabaseClient }) {
  void sb;
  return (
    <div className="h-[calc(100vh-var(--header-h))] overflow-y-auto bg-base">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">Translalia</h1>
        <p className="mt-2 text-foreground-secondary">Overview coming in the next commit.</p>
      </main>
    </div>
  );
}
