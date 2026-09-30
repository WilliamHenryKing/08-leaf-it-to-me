import { useEffect, useRef } from "react";
import type { Play } from "../play";
import { REACHES, StarRow } from "./icons";
import { SoundButton } from "./SoundButton";
import type { HudState } from "./store";

/** Native modal containment, with initial focus at the readable top of the verdict. */
export function Ending({ play, state: s }: { play: Play; state: HudState }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="ending-dialog panel"
      aria-labelledby="end-title"
      data-keyboard-scroll
      tabIndex={-1}
      onCancel={(event) => event.preventDefault()}
    >
      <h1 id="end-title" className="title text-3xl sm:text-4xl">
        The lanterns are lit
      </h1>
      <p className="mt-3 leading-relaxed">
        The beetle steps off at the gathering, shakes out its coat and hangs up{" "}
        {s.lanterns === 0
          ? "nothing at all, but is welcomed anyway"
          : `${s.lanterns} lantern${s.lanterns === 1 ? "" : "s"}`}
        .
      </p>
      <dl className="ending-reaches">
        {REACHES.map((name, i) => (
          <div key={name} className="ending-reach">
            <dt>{name}</dt>
            <dd>
              <StarRow n={s.stars[i] ?? 0} label={`${s.stars[i] ?? 0} of 3 stars`} />
              <span className="block text-xs">
                {s.gustsByReach[i] ?? 0} gust{(s.gustsByReach[i] ?? 0) === 1 ? "" : "s"}, par{" "}
                {s.par[i]}
                {(s.rescuesByReach[i] ?? 0) > 0
                  ? ` · ${s.rescuesByReach[i]} rescue${s.rescuesByReach[i] === 1 ? "" : "s"}`
                  : ""}
              </span>
              <span className="block text-[11px] opacity-70">best {s.best[i] ?? 0}/3 stars</span>
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
      <div className="ending-actions">
        <SoundButton text muted={s.muted} onClick={play.toggleMute} />
        <button type="button" className="btn text-base" onClick={play.restart}>
          Sail again
        </button>
      </div>
    </dialog>
  );
}
