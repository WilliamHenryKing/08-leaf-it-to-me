import { useEffect, useRef, useSyncExternalStore } from "react";
import { GUIDE_STEPS, type Play } from "../play";

const REACHES = ["The Flooded Flowerpot", "The Root Tunnel", "The Lantern Pond"];

function Lantern({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 12 16" className="h-4 w-3" aria-hidden="true">
      <path
        d="M6 1 C9.5 3 11 6 11 9 C11 12.5 8.5 15 6 15 C3.5 15 1 12.5 1 9 C1 6 2.5 3 6 1Z"
        fill={lit ? "#ffb45a" : "none"}
        stroke={lit ? "#ffd9a0" : "currentColor"}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function StarRow({ n, label }: { n: number; label: string }) {
  return (
    <span className="block text-lg tracking-wider text-[#c47a12]" role="img" aria-label={label}>
      {"★".repeat(n)}
      <span className="opacity-30">{"★".repeat(3 - n)}</span>
    </span>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path d="M17 9l5 6M22 9l-5 6" />
      ) : (
        <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
      )}
    </svg>
  );
}

function Panel({
  title,
  children,
  labelledBy,
}: {
  title: string;
  children: React.ReactNode;
  labelledBy: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-20 grid place-items-center p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelledBy}
        className="panel pointer-events-auto w-full max-w-md rounded-3xl p-6 text-center sm:p-8"
      >
        <h1 id={labelledBy} className="title text-3xl sm:text-4xl">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

/** The guided first minute, one step at a time (play.ts moves it on as the player acts). */
const GUIDE: { lead: string; more: string; keys?: string }[] = [
  {
    lead: "Drag anywhere to aim a gust.",
    more: "The longer the drag, the stronger the gust.",
    keys: "Keys: ← → turn the gust · ↑ ↓ strength",
  },
  {
    lead: "Let go to blow.",
    more: "Time slows while you aim, and the dotted line shows where the leaf will go.",
    keys: "Keys: Space blows · Esc cancels",
  },
  {
    lead: "Between gusts, the current carries you.",
    more: "Watch where it takes the leaf, and blow again when you need to. Too strong a gust spills from the sail and soaks the beetle's coat.",
  },
  {
    lead: "Fewer gusts, more stars.",
    more: "Gather the floating lanterns on the way, and bring the leaf into the calm pool at the end of each reach.",
  },
];

function Guide({ play, step }: { play: Play; step: number }) {
  const g = GUIDE[step] ?? GUIDE[0];
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  if (!g) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-start sm:p-5">
      <div
        key={step}
        className="guide panel pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 text-sm leading-snug"
        role="note"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
            How to sail · {step + 1} of {GUIDE_STEPS}
          </p>
          <span className="flex gap-1" aria-hidden="true">
            {GUIDE.map((s, i) => (
              <span
                key={s.lead}
                className={`h-1.5 w-4 rounded-full ${i <= step ? "bg-[var(--moss)]" : "bg-[var(--wash)]"}`}
              />
            ))}
          </span>
        </div>
        <p className="title mt-1.5 text-lg leading-tight">{g.lead}</p>
        <p className="mt-1">{g.more}</p>
        {g.keys && !touch && <p className="mt-1 text-xs opacity-75">{g.keys}</p>}
        <button
          type="button"
          className="mt-2 text-xs font-semibold underline"
          onClick={play.hideHint}
        >
          Skip the guide
        </button>
      </div>
    </div>
  );
}

/**
 * The opening title, over the camera's crane shot up the brook: the story in two lines, and
 * the one thing to do.
 */
function TitleCard({ play, muted }: { play: Play; muted: boolean }) {
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    go.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="title-card pointer-events-auto fixed inset-0 z-20 flex items-end sm:items-center">
      <div className="title-shade pointer-events-none absolute inset-0" />
      <section
        aria-labelledby="intro-title"
        className="relative flex max-w-[36rem] flex-col gap-4 px-6 pb-10 sm:pb-0 sm:pl-14"
      >
        <p className="rise text-[11px] font-semibold uppercase tracking-[0.3em] opacity-75">
          A brook in three reaches
        </p>
        <h1 id="intro-title" className="rise title text-5xl leading-[1.02] sm:text-7xl">
          Leaf It To Me
        </h1>
        <p className="rise max-w-[30rem] text-base leading-relaxed sm:text-lg">
          A small beetle in a good coat is late for the lantern gathering downstream. Its boat is a
          curled leaf with a twig mast. You are the wind.
        </p>
        <p className="rise max-w-[30rem] text-sm opacity-80">
          Read the current, pick your passage, and use as few gusts as you dare. Three reaches:{" "}
          {REACHES.join(", ")}.
        </p>
        <div className="rise flex flex-wrap items-center gap-3">
          <button ref={go} type="button" className="btn text-base" onClick={play.start}>
            Set sail
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={play.toggleMute}
            aria-pressed={!muted}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <span className="hidden text-xs opacity-70 sm:inline">or press Enter</span>
        </div>
      </section>
    </div>
  );
}

export function App({ play }: { play: Play }) {
  const s = useSyncExternalStore(play.store.subscribe, play.store.get);
  const sailing = s.status === "sailing" || s.status === "stranded";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none text-[var(--ink)]">
      <header className="flex items-start justify-between gap-3 p-3 sm:p-5">
        {sailing ? (
          <div className="chip pointer-events-auto rounded-2xl px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
              Reach {s.reach + 1} of 3
            </p>
            <p className="title text-lg leading-tight sm:text-xl">{s.reachName}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="whitespace-nowrap">
                <span className="font-semibold tabular-nums">{s.gustsByReach[s.reach] ?? 0}</span>{" "}
                gust{(s.gustsByReach[s.reach] ?? 0) === 1 ? "" : "s"}
                <span className="opacity-70"> · par {s.par[s.reach]}</span>
              </span>
              <span
                className="flex items-center gap-0.5"
                role="img"
                aria-label={`${s.lanterns} of ${s.totalLanterns} lanterns gathered`}
              >
                {Array.from({ length: s.totalLanterns }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative row
                  <Lantern key={i} lit={i < s.lanterns} />
                ))}
              </span>
            </div>
          </div>
        ) : (
          <span />
        )}
        <nav className="pointer-events-auto flex gap-2" aria-label="Game">
          <button
            type="button"
            className="btn-round"
            onClick={play.toggleMute}
            aria-label={s.muted ? "Unmute sound (M)" : "Mute sound (M)"}
            aria-pressed={s.muted}
          >
            <SpeakerIcon muted={s.muted} />
          </button>
          {sailing && (
            <>
              <button
                type="button"
                className="btn-round"
                onClick={play.showHint}
                aria-label="How to play"
              >
                ?
              </button>
              <button
                type="button"
                className="btn-round"
                onClick={play.restart}
                aria-label="Restart from the first reach"
              >
                ↺
              </button>
            </>
          )}
        </nav>
      </header>

      {s.aim && (
        <div className="absolute inset-x-0 top-[22%] flex justify-center" aria-hidden="true">
          <div className="chip rounded-full px-4 py-1.5 text-sm font-medium">
            Gust {Math.round(s.aim.strength * 100)}%{s.aim.spill ? " · spilling" : ""} · sail
            catches {Math.round(s.aim.efficiency * 100)}%
          </div>
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {s.toast?.text}
      </div>
      {s.toast && sailing && (
        <p
          key={s.toast.id}
          className="toast chip absolute inset-x-0 mx-auto top-28 w-fit max-w-[90vw] rounded-full px-4 py-2 text-center text-sm sm:top-32"
          aria-hidden="true"
        >
          {s.toast.text}
        </p>
      )}

      {s.hint && s.status === "sailing" && <Guide play={play} step={s.guide} />}

      {s.status === "intro" && <TitleCard play={play} muted={s.muted} />}

      {s.status === "finished" && (
        <Panel title="The lanterns are lit" labelledBy="end-title">
          <p className="mt-3 leading-relaxed">
            The beetle steps off at the gathering, shakes out its coat and hangs up{" "}
            {s.lanterns === 0
              ? "nothing at all, but is welcomed anyway"
              : `${s.lanterns} lantern${s.lanterns === 1 ? "" : "s"}`}
            .
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {REACHES.map((name, i) => (
              <div key={name} className="rounded-xl bg-[var(--wash)] px-2 py-2">
                <dt className="text-[11px] leading-tight opacity-70">{name}</dt>
                <dd>
                  <StarRow n={s.stars[i] ?? 0} label={`${s.stars[i] ?? 0} of 3 stars`} />
                  <span className="block text-xs">
                    {s.gustsByReach[i] ?? 0} gust{(s.gustsByReach[i] ?? 0) === 1 ? "" : "s"}, par{" "}
                    {s.par[i]}
                    {(s.rescuesByReach[i] ?? 0) > 0 ? ` · ${s.rescuesByReach[i]} duck` : ""}
                  </span>
                  <span className="block text-[11px] opacity-70">
                    best {"★".repeat(s.best[i] ?? 0) || "–"}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm">
            {s.gusts} gust{s.gusts === 1 ? "" : "s"} · {s.lanterns}/{s.totalLanterns} lanterns ·{" "}
            {s.rescues === 0
              ? "no ducks needed"
              : `${s.rescues} duck rescue${s.rescues === 1 ? "" : "s"}`}
          </p>
          <button type="button" className="btn mt-5 text-base" onClick={play.restart}>
            Sail again
          </button>
        </Panel>
      )}
    </div>
  );
}
