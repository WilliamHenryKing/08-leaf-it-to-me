export const REACHES = ["The Flooded Flowerpot", "The Root Tunnel", "The Lantern Pond"];

export function Lantern({ lit }: { lit: boolean }) {
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

export function StarRow({ n, label }: { n: number; label: string }) {
  const stars = Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 0;
  return (
    <span className="star-row" role="img" aria-label={label}>
      {"★".repeat(stars)}
      <span className="opacity-30">{"★".repeat(3 - stars)}</span>
    </span>
  );
}

export function SpeakerIcon({ muted }: { muted: boolean }) {
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
