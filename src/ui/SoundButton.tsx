import { SpeakerIcon } from "./icons";

export function SoundButton({
  muted,
  onClick,
  text = false,
  disabled = false,
}: {
  muted: boolean;
  onClick: () => void;
  text?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={text ? "btn-ghost sound-button" : "btn-round"}
      onClick={onClick}
      aria-label={muted ? "Unmute sound (M)" : "Mute sound (M)"}
      aria-keyshortcuts="M"
      aria-pressed={muted}
      disabled={disabled}
    >
      <SpeakerIcon muted={muted} />
      {text && <span>{muted ? "Sound off" : "Sound on"}</span>}
    </button>
  );
}
