import { useSyncExternalStore } from "react";
import type { Play } from "../play";
import { Ending } from "./Ending";
import { guidePrompt } from "./guidePrompt";
import { Lantern } from "./icons";
import { Guide, TitleCard } from "./Opening";
import { SoundButton } from "./SoundButton";

export function App({ play }: { play: Play }) {
  const s = useSyncExternalStore(play.store.subscribe, play.store.get);
  const sailing = s.status === "sailing" || s.status === "stranded";
  const visible = s.ready && !s.opening && sailing;

  return (
    <div className="game-ui" data-reduced={s.reduced} data-opening={s.opening}>
      <div
        className="play-hud"
        data-visible={visible}
        data-guide-active={s.hint}
        inert={!visible}
        aria-hidden={!visible}
      >
        <header className="hud-top">
          <section className="reach-card chip" aria-label="Current reach">
            <p className="reach-number">Reach {s.reach + 1} of 3</p>
            <h2 className="reach-name title">{s.reachName}</h2>
            <div className="reach-stats">
              <span className="whitespace-nowrap">
                <span className="font-semibold tabular-nums">{s.gustsByReach[s.reach] ?? 0}</span>{" "}
                gust{(s.gustsByReach[s.reach] ?? 0) === 1 ? "" : "s"}
                <span className="opacity-70"> · par {s.par[s.reach]}</span>
              </span>
              <span
                className="lantern-row"
                role="img"
                aria-label={`${s.lanterns} of ${s.totalLanterns} lanterns gathered`}
              >
                {Array.from({ length: s.totalLanterns }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative lantern row.
                  <Lantern key={i} lit={i < s.lanterns} />
                ))}
              </span>
            </div>
          </section>
          <nav className="game-nav" aria-label="Game">
            <SoundButton muted={s.muted} onClick={play.toggleMute} />
            <button
              type="button"
              className="btn-round"
              onClick={play.showHint}
              aria-label="How to play"
              disabled={s.status !== "sailing"}
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
          </nav>
          {s.aim && (
            <p className="aim-gauge chip">
              Gust {Math.round(s.aim.strength * 100)}%{s.aim.spill ? " · spilling" : ""} · sail
              catches {Math.round(s.aim.efficiency * 100)}%
            </p>
          )}
          {s.toast && !s.hint && !s.aim && (
            <p key={s.toast.id} className="toast feedback chip" aria-hidden="true">
              {s.toast.text}
            </p>
          )}
        </header>
        {s.hint && (
          <div className="hud-bottom">
            <Guide play={play} step={s.guide} prompt={s.guidePrompt ?? guidePrompt(s)} />
          </div>
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {s.toast?.text}
      </div>
      {s.status === "intro" && <TitleCard play={play} muted={s.muted} ready={s.ready} />}
      {s.status === "finished" && <Ending play={play} state={s} />}
    </div>
  );
}
