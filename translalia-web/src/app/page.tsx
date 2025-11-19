import { AppLink } from "@/lib/routers";

const highlights = [
  {
    title: "Create translations with confidence",
    copy: "A calm space where you can explore words, rhythm, and tone without pressure.",
    icon: "🌱",
  },
  {
    title: "Guided by friendly AI",
    copy: "Prompts nudge you toward multiple possibilities instead of one “right” answer.",
    icon: "🌀",
  },
  {
    title: "Made for curious students",
    copy: "Built especially for ages 12–16 with clear steps, soft visuals, and simple language.",
    icon: "🎒",
  },
];

const recipes = [
  {
    title: "Quick Start Translation",
    description: "Pick any poem line and get three ready-to-edit versions in seconds.",
    tag: "Beginner",
  },
  {
    title: "Tone Explorer",
    description: "Compare literal, balanced, and creative vibes to match your intent.",
    tag: "Creative",
  },
  {
    title: "Group Workshop",
    description: "Share a recipe with classmates and remix the same stanza together.",
    tag: "Collab",
  },
  {
    title: "Homework Helper",
    description: "Use guided prompts to turn rough drafts into polished submissions.",
    tag: "Quick",
  },
];

const steps = [
  {
    title: "Sign in & open a workspace",
    detail: "Use your class login or invite link to access your poem.",
  },
  {
    title: "Choose a recipe",
    detail: "Pick a card that matches what you want to try—quick draft, tone shift, collaboration, and more.",
  },
  {
    title: "Follow the prompts",
    detail: "Answer a few friendly questions and let Translalia suggest options you can keep or remix.",
  },
  {
    title: "Share or continue",
    detail: "Save your best line, keep experimenting, or show your teacher right from the rail.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      {/* Hero */}
      <section className="container flex flex-col gap-10 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Translation studio for young poets
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Translate poetry with a calm guide by your side.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Translalia is a decolonial, AI-assisted workspace that helps students explore
            multiple versions of a poem, understand the choices they make, and feel proud of
            their voice.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <AppLink
              to="workspaces"
              className="inline-flex items-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-500"
            >
              Open the app
            </AppLink>
            <a
              href="#how-it-works"
              className="text-base font-semibold text-sky-700 transition hover:text-sky-600"
            >
              Learn how it works →
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="container pb-16">
        <div className="rounded-3xl bg-white px-6 py-10 shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:px-10">
          <div className="grid gap-8 sm:grid-cols-3">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="space-y-3">
                <div className="text-3xl">{highlight.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900">{highlight.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{highlight.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recipes */}
      <section className="container py-12">
        <div className="mb-10 flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Recipes
          </p>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Try a path that fits what you need
          </h2>
          <p className="text-base text-slate-600">
            Each recipe gives you a guided flow—no guesswork, just vibes.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">{recipe.title}</h3>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  {recipe.tag}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{recipe.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use */}
      <section id="how-it-works" className="container py-16">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            How to use Translalia
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Four easy steps to start translating
          </h2>
        </div>
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow-sm ring-1 ring-slate-100 sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-lg font-semibold text-sky-700">
                {index + 1}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-12 text-center text-white shadow-[0_20px_60px_rgba(30,41,59,0.45)]">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Ready to see your poem in a new light?
          </h2>
          <p className="mt-4 text-base text-slate-200">
            Translalia makes it safe to experiment. Grab a recipe, invite a friend, and let’s try a new line together.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <AppLink
              to="workspaces"
              className="inline-flex items-center rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Start translating
            </AppLink>
            <p className="text-sm text-slate-300">
              Teachers & mentors can onboard students in minutes.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
