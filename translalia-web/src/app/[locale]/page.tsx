"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Highlighter } from "@/components/ui/highlighter";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useSupabaseUser();

  const handleGetStarted = () => {
    if (loading) return; // Wait for auth check to complete
    
    if (user) {
      // User is authenticated, go to workspaces
      router.push("/workspaces");
    } else {
      // User is not authenticated, go to sign-in with redirect
      router.push(`/auth/sign-in?redirect=${encodeURIComponent("/workspaces")}`);
    }
  };
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsIntersectionObserver = "IntersectionObserver" in window;
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));

    let revealObserver: IntersectionObserver | null = null;
    if (prefersReducedMotion || !supportsIntersectionObserver) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && revealObserver) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
      );
      revealEls.forEach((el) => revealObserver?.observe(el));
    }

    let cleanupParallax = () => {};
    if (!prefersReducedMotion && parallaxEls.length > 0) {
      let ticking = false;
      const update = () => {
        const y = window.scrollY || 0;
        parallaxEls.forEach((el) => {
          const speed = parseFloat(el.dataset.speed || "0.08");
          const offset = parseFloat(el.dataset.offset || "0");
          el.style.transform = `translate3d(0, ${y * speed + offset}px, 0)`;
        });
        ticking = false;
      };
      const onScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      };

      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);

      cleanupParallax = () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    }

    return () => {
      if (revealObserver) {
        revealObserver.disconnect();
      }
      cleanupParallax();
    };
  }, []);

  return (
    <main className="min-h-dvh bg-white text-slate-900 selection:bg-sky-600 selection:text-white">
      {/* Scroll indicator */}
      <div className="fixed bottom-8 right-8 z-40 hidden lg:block">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-px bg-gradient-to-b from-transparent via-slate-300 to-slate-500" />
          <span className="text-[10px] tracking-[0.3em] text-slate-400">(SCROLL)</span>
        </div>
      </div>

      {/* Hero Section */}
      <section
        className="relative flex min-h-dvh flex-col justify-center px-6 sm:px-12 lg:px-24"
        id="intro"
        data-section
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -right-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-sky-100 opacity-50 blur-[150px]"
            data-parallax
            data-speed="0.08"
          />
          <div
            className="absolute -left-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-blue-100 opacity-50 blur-[120px]"
            data-parallax
            data-speed="0.12"
          />
          <div
            className="absolute left-[15%] top-[18%] h-40 w-40 rounded-full bg-sky-200/40 blur-[80px]"
            data-parallax
            data-speed="0.18"
          />
          <div
            className="absolute right-[18%] bottom-[12%] h-32 w-32 rounded-full bg-blue-200/40 blur-[70px]"
            data-parallax
            data-speed="0.16"
          />
          <div className="pointer-events-none absolute inset-0 hero-grain" />
        </div>

        <div className="relative z-10 max-w-6xl">
          <div
            className="mb-8 flex items-center gap-4 text-xs tracking-[0.4em] text-slate-500"
            style={{ animation: "fadeSlideUp 1s ease-out 0.2s both" }}
          >
            <span>01</span>
            <div className="h-px w-12 bg-slate-300" />
            <span>INTRODUCTION</span>
          </div>

          <h1
            className="font-serif text-[clamp(3.5rem,12vw,10rem)] font-light leading-[0.85] tracking-[-0.03em] text-slate-900"
            style={{ animation: "fadeSlideUp 1.2s ease-out 0.4s both" }}
          >
            <span className="block">
              Trans<span className="italic text-sky-600">lalia</span>
            </span>
          </h1>

          <div
            className="mt-12 max-w-xl"
            style={{ animation: "fadeSlideUp 1s ease-out 0.8s both" }}
          >
            <p className="text-xl leading-relaxed text-slate-600 sm:text-2xl">
              A place to engage in translation that is{" "}
              <em className="text-sky-600">slow</em>,{" "}
              <em className="text-sky-600">plural</em>,{" "}
              <em className="text-sky-600">creative</em> and{" "}
              <em className="text-sky-600">decolonial</em>
            </p>
          </div>

          <div
            className="mt-16"
            style={{ animation: "fadeSlideUp 1s ease-out 1s both" }}
          >
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="group inline-flex items-center gap-4 border border-slate-300 px-8 py-5 text-sm tracking-[0.2em] text-slate-900 transition-all duration-500 hover:border-sky-600 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>BEGIN YOUR TRANSLATION</span>
              <svg
                className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Manifesto Section */}
      <section className="relative px-6 py-32 sm:px-12 lg:px-24" id="problem" data-section>
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 flex items-center gap-4 text-xs tracking-[0.4em] text-slate-500" data-reveal>
            <span>02</span>
            <div className="h-px w-12 bg-slate-300" />
            <span>THE PROBLEM</span>
          </div>

          <div className="grid gap-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2
                className="font-serif text-4xl font-light leading-tight tracking-[-0.02em] text-slate-900 sm:text-5xl lg:text-6xl"
                data-reveal
                style={{ transitionDelay: "120ms" }}
              >
                Online, translation happens{" "}
                <span className="italic text-sky-600">immediately</span> and{" "}
                <span className="italic text-sky-600">automatically</span>.
              </h2>
            </div>

            <div
              className="flex flex-col justify-center space-y-8 text-lg leading-relaxed text-slate-600 lg:text-xl"
              data-reveal
              style={{ transitionDelay: "220ms" }}
            >
              <p>
                Words in one language turn into words in another. It looks like there is nothing to think about and nothing at stake.
              </p>
              <p className="border-l-2 border-sky-400 pl-6 text-slate-900">
                But a lot is at stake and there is a great deal to think about.
              </p>
            </div>
          </div>

          <div className="mt-20">
            <div className="mb-8 flex items-center gap-4 text-xs tracking-[0.35em] text-slate-500" data-reveal>
              <span>THE JOURNEY</span>
              <div className="h-px w-12 bg-slate-300" />
              <span>FROM TEXT TO VOICE</span>
            </div>

            <div className="relative">
              <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-sky-300/60 to-transparent md:block" />
              <div className="grid gap-6 md:grid-cols-3">
                <div
                  className="group relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-lg"
                  data-reveal
                  style={{ transitionDelay: "120ms" }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-[10px] tracking-[0.2em] text-slate-500">
                      01
                    </span>
                    <h3 className="font-serif text-xl text-slate-900">Listen</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Sit with the source text. Notice its rhythm, pauses, and the feelings it carries.
                  </p>
                </div>

                <div
                  className="group relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-lg"
                  data-reveal
                  style={{ transitionDelay: "220ms" }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-[10px] tracking-[0.2em] text-slate-500">
                      02
                    </span>
                    <h3 className="font-serif text-xl text-slate-900">Explore</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Compare options. Let the translation open up multiple possible ways forward.
                  </p>
                </div>

                <div
                  className="group relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-lg"
                  data-reveal
                  style={{ transitionDelay: "320ms" }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-[10px] tracking-[0.2em] text-slate-500">
                      03
                    </span>
                    <h3 className="font-serif text-xl text-slate-900">Assemble</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Choose with intention. Shape a version that sounds true in your own voice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your Language Section */}
      <section className="relative bg-slate-50 px-6 py-32 sm:px-12 lg:px-24" id="voice" data-section>
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 flex items-center gap-4 text-xs tracking-[0.4em] text-slate-500" data-reveal>
            <span>03</span>
            <div className="h-px w-12 bg-slate-300" />
            <span>YOUR VOICE</span>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-0 hidden text-[12rem] font-serif leading-none text-slate-200 lg:block">
              &ldquo;
            </div>

            <div className="space-y-12 lg:pl-24">
              <p
                className="font-serif text-2xl leading-relaxed text-slate-800 sm:text-3xl lg:text-4xl lg:leading-relaxed"
                data-reveal
                style={{ transitionDelay: "120ms" }}
              >
                When you write, or speak, you don&apos;t just use &apos;a language&apos;. You use{" "}
                <Highlighter action="circle" color="#0ea5e9" strokeWidth={2} padding={6} isView>
                  <em className="text-sky-600">your</em>
                </Highlighter>{" "}
                language – the words that feel right to{" "}
                <Highlighter action="circle" color="#0ea5e9" strokeWidth={2} padding={6} isView>
                  <em className="text-sky-600">you</em>
                </Highlighter>.
              </p>

              <p className="max-w-3xl text-xl leading-relaxed text-slate-500" data-reveal style={{ transitionDelay: "220ms" }}>
                You do something particular with language every time you open your mouth or tap a key.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Translation Philosophy Section */}
      <section className="relative px-6 py-32 sm:px-12 lg:px-24" id="craft" data-section>
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 flex items-center gap-4 text-xs tracking-[0.4em] text-slate-500" data-reveal>
            <span>04</span>
            <div className="h-px w-12 bg-slate-300" />
            <span>THE CRAFT</span>
          </div>

          <div className="grid gap-16 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p
                className="text-xl leading-relaxed text-slate-700 sm:text-2xl sm:leading-relaxed"
                data-reveal
                style={{ transitionDelay: "120ms" }}
              >
                And when someone translates what you have made with your language, they need to make it feel right to them, in their kind of language, as they speak on your behalf.
              </p>

              <div className="mt-12 space-y-8 text-lg leading-relaxed text-slate-500" data-reveal style={{ transitionDelay: "220ms" }}>
                <p>
                  Nothing ever lines up exactly; it is never just a matter of correct or incorrect. This is obvious if what is being translated is a poem or a novel.
                </p>
                <p>
                  But it is also a general truth. There are always differences to be thought about and choices to be made – choices that are{" "}
                  <Highlighter action="underline" color="#0ea5e9" strokeWidth={2} isView>
                    <span className="text-sky-600 font-medium">ethical</span>
                  </Highlighter>,{" "}
                  <Highlighter action="underline" color="#0ea5e9" strokeWidth={2} isView>
                    <span className="text-sky-600 font-medium">aesthetic</span>
                  </Highlighter>{" "}
                  and{" "}
                  <Highlighter action="underline" color="#0ea5e9" strokeWidth={2} isView>
                    <span className="text-sky-600 font-medium">political</span>
                  </Highlighter>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="relative h-64 w-64" data-parallax data-speed="0.05">
                <div className="relative h-full w-full" data-reveal style={{ transitionDelay: "260ms" }}>
                  <div className="absolute inset-0 rounded-full border border-slate-200 spin-slow" />
                  <div className="absolute inset-4 rounded-full border border-slate-200" />
                  <div className="absolute inset-8 rounded-full border border-slate-200" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-5xl italic text-sky-400 pulse-glow">✳︎</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-24 border-l-2 border-sky-400 py-4 pl-8" data-reveal>
            <p className="font-serif text-2xl italic leading-relaxed text-slate-800">
              The same goes for you when you are translating someone else&apos;s words.
            </p>
          </div>
        </div>
      </section>

      {/* What Translalia Does Section */}
      <section className="relative bg-slate-900 px-6 py-32 text-white sm:px-12 lg:px-24" id="solution" data-section>
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-sky-950/40 blur-[140px]"
            data-parallax
            data-speed="0.05"
          />
          <div
            className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-blue-950/40 blur-[140px]"
            data-parallax
            data-speed="0.08"
          />
          <div className="absolute left-1/2 top-1/3" data-parallax data-speed="0.12">
            <div className="h-40 w-40 -translate-x-1/2 rounded-full bg-sky-900/40 blur-[120px]" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-16 flex items-center gap-4 text-xs tracking-[0.4em] text-slate-400" data-reveal>
            <span>05</span>
            <div className="h-px w-12 bg-slate-600" />
            <span>THE SOLUTION</span>
          </div>

          <div className="mb-20">
            <h2
              className="font-serif text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl lg:text-6xl"
              data-reveal
              style={{ transitionDelay: "120ms" }}
            >
              Translalia uses AI to{" "}
              <span className="italic text-sky-400">help you understand</span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className="group border border-slate-700 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-sky-500 hover:bg-sky-950/30 hover:shadow-lg hover:shadow-sky-950/40"
              data-reveal
              style={{ transitionDelay: "140ms" }}
            >
              <div className="mb-6 text-xs tracking-[0.3em] text-slate-500">01</div>
              <h3 className="mb-4 font-serif text-xl text-white">Understanding</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Whatever text you are interested in translating – whether that is a poem, a piece of fiction or anything else.
              </p>
            </div>

            <div
              className="group border border-slate-700 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-sky-500 hover:bg-sky-950/30 hover:shadow-lg hover:shadow-sky-950/40"
              data-reveal
              style={{ transitionDelay: "240ms" }}
            >
              <div className="mb-6 text-xs tracking-[0.3em] text-slate-500">02</div>
              <h3 className="mb-4 font-serif text-xl text-white">Choices</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                It gives you choices. Multiple paths forward. Different ways to honor the original while making it your own.
              </p>
            </div>

            <div
              className="group border border-slate-700 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-sky-500 hover:bg-sky-950/30 hover:shadow-lg hover:shadow-sky-950/40"
              data-reveal
              style={{ transitionDelay: "340ms" }}
            >
              <div className="mb-6 text-xs tracking-[0.3em] text-slate-500">03</div>
              <h3 className="mb-4 font-serif text-xl text-white">Assembly</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                And it helps you work out how to pull your translation together with intention and care.
              </p>
            </div>
          </div>

          <div className="mt-20 text-center" data-reveal>
            <p className="mx-auto max-w-2xl font-serif text-2xl italic leading-relaxed text-white">
              It puts you at the centre of the translation process.
            </p>
            <p className="mt-8 text-lg text-slate-400">
              It aims to give everyone a sense of what is at stake in translation.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-6 py-32 sm:px-12 lg:px-24" id="begin" data-section>
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute left-10 top-10 h-48 w-48 rounded-full bg-sky-100 blur-[100px]"
            data-parallax
            data-speed="0.06"
          />
          <div
            className="absolute right-10 bottom-10 h-56 w-56 rounded-full bg-blue-100 blur-[110px]"
            data-parallax
            data-speed="0.09"
          />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-12 flex items-center justify-center gap-4 text-xs tracking-[0.4em] text-slate-500" data-reveal>
            <span>06</span>
            <div className="h-px w-12 bg-slate-300" />
            <span>BEGIN</span>
            <div className="h-px w-12 bg-slate-300" />
          </div>

          <h2
            className="font-serif text-4xl font-light tracking-[-0.02em] text-slate-900 sm:text-5xl lg:text-6xl"
            data-reveal
            style={{ transitionDelay: "120ms" }}
          >
            Ready to{" "}
            <span className="italic text-sky-600">translate</span>?
          </h2>

          <div className="mt-12" data-reveal style={{ transitionDelay: "220ms" }}>
            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="sharp-cta-btn group relative inline-flex items-center gap-4 overflow-hidden border-0 bg-sky-600 px-12 py-6 text-sm font-semibold tracking-[0.2em] text-white shadow-lg transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-medium">START HERE</span>
              <svg
                className="h-4 w-4 transition-transform duration-250 group-hover:translate-x-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Credits Section */}
      <section className="relative bg-slate-50 px-6 py-24 sm:px-12 lg:px-24" id="colophon">
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-4xl">
          <div className="mb-12 flex items-center justify-center gap-4 text-xs tracking-[0.4em] text-slate-400" data-reveal>
            <span className="text-sky-600">✳︎</span>
            <span>COLOPHON</span>
            <span className="text-sky-600">✳︎</span>
          </div>

          <div className="text-center" data-reveal style={{ transitionDelay: "120ms" }}>
            <p className="text-sm leading-loose text-slate-500">
              Translalia is the creation of Matthew Reynolds and the AI, Decoloniality and Creative Poetry Translation Project (participants: Joseph Hankinson, Deepshikha Behera, Luciana Beroiz, Yingxin Chen, Karen Cresci, Annmarie Drury, Sarah Ekdawi, Vani Nautiyal, Mary Newman, Wen-Chin Ouyang, Rafaa Ragebi, María Eugenia Rigane, Xuemeng Zhang). The idea of making an app came from Lachlan Kermode. The process was supported by Dominik Lukes and Oxford University&apos;s AI and ML Competency Centre. The coding was done by Raj Trivedi.
            </p>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 text-xs tracking-[0.3em] text-slate-400">
            <span>AIDCPT</span>
            <span>•</span>
            <span>2026</span>
            <span>•</span>
            <span>TRANSLALIA</span>
          </div>
        </div>
      </section>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        [data-reveal] {
          opacity: 0;
          transform: translate3d(0, 24px, 0);
          filter: blur(2px);
          transition: opacity 800ms ease, transform 800ms ease, filter 800ms ease;
        }

        [data-reveal].is-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
          filter: blur(0);
        }

        [data-parallax] {
          will-change: transform;
        }

        .hero-grain {
          background-image: radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px);
          background-size: 3px 3px;
          mix-blend-mode: multiply;
          opacity: 0.35;
        }

        .spin-slow {
          animation: slowSpin 18s linear infinite;
        }

        .pulse-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }

        .sharp-cta-btn {
          border-radius: 0;
          z-index: 1;
          position: relative;
          box-shadow: 4px 8px 19px -3px rgba(0, 0, 0, 0.27);
        }

        .sharp-cta-btn::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0;
          border-radius: 0;
          background-color: rgb(15, 23, 42);
          z-index: -1;
          transition: all 250ms;
        }

        .sharp-cta-btn:hover:not(:disabled) {
          color: rgb(2, 132, 199);
        }

        .sharp-cta-btn:hover:not(:disabled)::before {
          width: 100%;
        }

        .sharp-cta-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        @keyframes slowSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.08);
          }
        }


        @media (prefers-reduced-motion: reduce) {
          [data-reveal] {
            opacity: 1;
            transform: none;
            filter: none;
            transition: none;
          }

          .spin-slow,
          .pulse-glow {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
