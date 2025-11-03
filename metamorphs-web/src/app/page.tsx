import { AppLink } from "@/lib/routers";

export default function Home() {
  return (
    <main className="min-h-dvh">
      <section className="container py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl inline-flex items-center justify-center gap-3">
            <img src="/globe.svg" alt="" className="h-9 w-9" />
            Translalia
          </h1>
          <p className="mt-4 text-balance text-lg text-gray-600">
            A decolonial, AI-assisted creative poetry translation workspace.
          </p>

          <div className="mt-8 inline-flex gap-3">
            <AppLink
              to="workspaces"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-white hover:opacity-90"
            >
              Open Workspaces
            </AppLink>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Placeholder landing page — wiring to Supabase & UI kit comes next.
          </p>
        </div>
      </section>
    </main>
  );
}
