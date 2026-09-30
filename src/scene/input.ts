// Input reports intent; the play loop decides whether a gust can be accepted.
import { clamp } from "../game/vec";

export interface AimHandlers {
  toGame: (clientX: number, clientY: number) => { x: number; y: number } | null;
  aim: (angle: number, strength: number) => void;
  release: () => void;
  cancel: () => void;
  active?: () => boolean;
}

const TURN = Math.PI / 16;
const EDITING =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='slider'], [role='spinbutton'], [role='combobox']";
const ACTION_CONTROL = "button, a[href], summary, [role='button']";

function element(target: EventTarget | null): Element | null {
  return target && "closest" in target ? (target as Element) : null;
}

/** Global commands must leave text entry and native directional widgets alone. */
export function isEditingTarget(target: EventTarget | null) {
  return Boolean(element(target)?.closest(EDITING));
}

export function attachInput(canvas: HTMLCanvasElement, h: AimHandlers) {
  let drag: { id: number; sx: number; sy: number } | null = null;
  let key: { angle: number; strength: number } | null = null;
  let disposed = false;
  const held = new Set<string>();
  const active = () => !disposed && (h.active?.() ?? true);

  const releaseCapture = (id: number) => {
    try {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    } catch {
      // The browser can already have canceled capture on a visibility change.
    }
  };
  const clear = () => {
    const id = drag?.id;
    drag = null;
    key = null;
    held.clear();
    if (id !== undefined) releaseCapture(id);
    h.cancel();
  };

  const updateDrag = (e: PointerEvent) => {
    if (!drag) return false;
    const px = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    const start = h.toGame(drag.sx, drag.sy);
    const end = h.toGame(e.clientX, e.clientY);
    if (px < 10 || !start || !end || ![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
      h.cancel();
      return false;
    }
    // Reproject both screen points now: following the boat must not rotate the drag.
    const reach = 0.3 * Math.min(canvas.clientWidth, canvas.clientHeight);
    if (reach <= 0) return false;
    h.aim(Math.atan2(end.x - start.x, end.y - start.y), clamp(px / reach, 0.05, 1));
    return true;
  };
  const onDown = (e: PointerEvent) => {
    if (!active() || drag || e.isPrimary === false || e.button !== 0) return;
    if (!h.toGame(e.clientX, e.clientY)) return;
    clear();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      clear();
      return;
    }
    canvas.focus({ preventScroll: true });
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!active()) {
      clear();
      return;
    }
    updateDrag(e);
    e.preventDefault();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const rect = canvas.getBoundingClientRect();
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const overCanvas =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom &&
      hit === canvas;
    const accepted = active() && overCanvas && updateDrag(e);
    const id = drag.id;
    drag = null;
    releaseCapture(id);
    if (accepted) h.release();
    else h.cancel();
    e.preventDefault();
  };
  const onCancel = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) clear();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isEditingTarget(e.target))
      return;
    const target = element(e.target);
    const scroll = target?.matches("[data-keyboard-scroll]");
    const activation = e.key === " " || e.key === "Enter";
    if (activation && e.repeat && !scroll) {
      // Keep native button activation on the first press without repeat clicks or gusts.
      e.preventDefault();
      return;
    }
    if (!active() || target?.closest("dialog, [role='dialog']") || scroll) return;
    const code = e.code || e.key;
    if (e.key === "Escape" && (drag || key)) {
      e.preventDefault();
      clear();
      return;
    }
    if (drag) return;
    const left = e.key === "ArrowLeft" || code === "KeyA" || e.key === "a";
    const right = e.key === "ArrowRight" || code === "KeyD" || e.key === "d";
    const up = e.key === "ArrowUp" || code === "KeyW" || e.key === "w";
    const down = e.key === "ArrowDown" || code === "KeyS" || e.key === "s";
    if (left || right || up || down) {
      if (e.repeat && !held.has(code)) return;
      held.add(code);
      e.preventDefault();
      key ??= { angle: 0, strength: 0.5 };
      if (left) key.angle -= TURN;
      if (right) key.angle += TURN;
      if (up) key.strength = clamp(key.strength + 0.1, 0.1, 1);
      if (down) key.strength = clamp(key.strength - 0.1, 0.1, 1);
      h.aim(key.angle, key.strength);
    } else if (activation && key && !target?.closest(ACTION_CONTROL)) {
      e.preventDefault();
      if (held.has(code)) return;
      held.add(code);
      h.aim(key.angle, key.strength);
      h.release();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code || e.key);
  const onHidden = () => {
    if (document.hidden) clear();
  };
  const onFocus = (e: FocusEvent) => {
    if (e.target !== canvas && (key || drag)) clear();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("lostpointercapture", onCancel);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clear);
  window.addEventListener("resize", clear);
  document.addEventListener("visibilitychange", onHidden);
  document.addEventListener("focusin", onFocus);

  const detach = () => {
    if (disposed) return;
    disposed = true;
    clear();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onCancel);
    canvas.removeEventListener("lostpointercapture", onCancel);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clear);
    window.removeEventListener("resize", clear);
    document.removeEventListener("visibilitychange", onHidden);
    document.removeEventListener("focusin", onFocus);
  };
  return { clear, detach, dispose: detach };
}
