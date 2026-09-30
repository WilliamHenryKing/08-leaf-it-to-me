import { useEffect, useLayoutEffect, useRef } from "react";
import type { Play } from "../play";
import { GUIDE_STEPS, type GuidePrompt } from "./guidePrompt";
import { REACHES } from "./icons";
import { SoundButton } from "./SoundButton";

/** Keep the scroll surface mounted so advancing the guide does not drop keyboard focus. */
export function Guide({ play, step, prompt }: { play: Play; step: number; prompt: GuidePrompt }) {
  const scroll = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (prompt.key) scroll.current?.scrollTo({ top: 0 });
  }, [prompt.key]);
  return (
    <aside className="guide panel" aria-label="How to sail" data-step={step}>
      <section
        ref={scroll}
        className="guide-scroll"
        aria-label="Sailing instructions"
        data-keyboard-scroll
        // biome-ignore lint/a11y/noNoninteractiveTabindex: bounded instructions need native keyboard scrolling.
        tabIndex={0}
      >
        <div className="guide-step">
          <p>
            How to sail · {step + 1} of {GUIDE_STEPS}
          </p>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: GUIDE_STEPS }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative progress markers.
                key={i}
                className={`h-1.5 w-4 rounded-full ${i <= step ? "bg-[var(--moss)]" : "bg-[var(--wash)]"}`}
              />
            ))}
          </span>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <p className="guide-lead title">{prompt.lead}</p>
          <p className="guide-body">{prompt.more}</p>
          {prompt.keys && <p className="guide-keys">{prompt.keys}</p>}
        </div>
      </section>
      <button type="button" className="guide-skip" onClick={play.hideHint}>
        Skip the guide
      </button>
    </aside>
  );
}

/** Paper light on the title, with a separate native Sound control. */
export function TitleCard({ play, muted, ready }: { play: Play; muted: boolean; ready: boolean }) {
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ready) go.current?.focus({ preventScroll: true });
  }, [ready]);
  return (
    <div className="title-card">
      <div className="title-shade" />
      <section aria-labelledby="intro-title" className="title-content">
        <p className="rise text-[11px] font-semibold uppercase tracking-[0.3em] opacity-75">
          A brook in three reaches
        </p>
        <h1 id="intro-title" className="rise title text-5xl leading-[1.02] sm:text-7xl">
          Leaf It To Me
        </h1>
        <p className="title-premise rise max-w-[30rem] text-base leading-relaxed sm:text-lg">
          A small beetle in a good coat is late for the lantern gathering downstream. Its boat is a
          curled leaf with a twig mast. You are the wind.
        </p>
        <p className="title-reaches rise max-w-[30rem] text-sm opacity-80">
          Read the current, pick your passage, and use as few gusts as you dare. Three reaches:{" "}
          {REACHES.join(", ")}.
        </p>
        <div className="rise flex flex-wrap items-center gap-3">
          <button
            ref={go}
            type="button"
            className="btn text-base"
            onClick={play.start}
            disabled={!ready}
          >
            {ready ? "Set sail" : "Preparing the brook…"}
          </button>
          <SoundButton text muted={muted} onClick={play.toggleMute} disabled={!ready} />
          <span className="hidden text-xs opacity-70 sm:inline">or press Enter</span>
        </div>
      </section>
    </div>
  );
}
