// Drag (mouse or touch) and keyboard aiming. Reports intent; the play loop owns the rules.
import { clamp } from "../game/vec";

export interface AimHandlers {
  toGame: (clientX: number, clientY: number) => { x: number; y: number } | null;
  aim: (angle: number, strength: number) => void;
  release: () => void;
  cancel: () => void;
}

const TURN = Math.PI / 16;

export function attachInput(canvas: HTMLCanvasElement, h: AimHandlers) {
  let drag: { id: number; sx: number; sy: number; start: { x: number; y: number } } | null = null;
  let key: { angle: number; strength: number } | null = null;

  const onDown = (e: PointerEvent) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const start = h.toGame(e.clientX, e.clientY);
    if (!start) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start };
    key = null;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const px = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    if (px < 10) {
      h.cancel();
      return;
    }
    const p = h.toGame(e.clientX, e.clientY);
    if (!p) return;
    const reach = 0.3 * Math.min(canvas.clientWidth, canvas.clientHeight);
    h.aim(Math.atan2(p.x - drag.start.x, p.y - drag.start.y), clamp(px / reach, 0.05, 1));
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    h.release();
  };
  const onCancel = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    h.cancel();
  };

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const onControl = target?.closest("button, a, input, [role=dialog]");
    const k = e.key;
    const aimKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s"];
    if (aimKeys.includes(k)) {
      if (target?.closest("[role=dialog], input")) return;
      e.preventDefault();
      key ??= { angle: 0, strength: 0.5 };
      if (k === "ArrowLeft" || k === "a") key.angle -= TURN;
      if (k === "ArrowRight" || k === "d") key.angle += TURN;
      if (k === "ArrowUp" || k === "w") key.strength = clamp(key.strength + 0.1, 0.1, 1);
      if (k === "ArrowDown" || k === "s") key.strength = clamp(key.strength - 0.1, 0.1, 1);
      h.aim(key.angle, key.strength);
    } else if ((k === " " || k === "Enter") && key && !onControl) {
      // The last keyboard heading is remembered, so a repeat gust is one key away.
      e.preventDefault();
      h.aim(key.angle, key.strength);
      h.release();
    } else if (k === "Escape" && key) {
      key = null;
      h.cancel();
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
  return {
    /** Forget any keyboard aim, e.g. after a restart. */
    clear() {
      key = null;
      drag = null;
    },
    detach() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
    },
  };
}
