import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Play } from "../play";

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
            <div className="mt-1.5 flex items-center gap-3 text-sm">
              <span>
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

      {s.hint && s.status === "sailing" && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-start sm:p-5">
          <div
            className="panel pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm leading-snug"
            role="note"
          >
            <p className="font-semibold">Steer with the wind, not the rudder.</p>
            <p className="mt-1">
              <strong>Drag anywhere</strong> to aim a gust (longer drag, stronger gust) and{" "}
              <strong>let go</strong> to blow. Time slows while you aim; the dotted line shows where
              the leaf will go.
            </p>
            <p className="mt-1 opacity-80">
              Keys: <kbd>←</kbd> <kbd>→</kbd> turn · <kbd>↑</kbd> <kbd>↓</kbd> strength ·{" "}
              <kbd>Space</kbd> blow · <kbd>Esc</kbd> cancel · <kbd>M</kbd> mute
            </p>
            <button type="button" className="btn mt-2" onClick={play.hideHint}>
              Got it
            </button>
          </div>
        </div>
      )}

      {s.status === "intro" && (
        <Panel title="Leaf It To Me" labelledBy="intro-title">
          <p className="mt-3 leading-relaxed">
            A small beetle in a good coat is late for the lantern gathering downstream. Its boat is
            a curled leaf with a twig mast. You are the wind.
          </p>
          <p className="mt-2 text-sm opacity-80">
            Read the current, pick your passage, and use as few gusts as you dare. Three reaches:{" "}
            {REACHES.join(", ")}.
          </p>
          <button type="button" className="btn mt-5 text-base" onClick={play.start}>
            Set sail
          </button>
        </Panel>
      )}

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
