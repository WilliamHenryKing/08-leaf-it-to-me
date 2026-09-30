// Keep the brook covered until its first prepared draw; a timer cannot establish readiness.
let revealed = false;
let failed = false;
let revealTimer = 0;
let slowTimer = 0;
function veil() {
  let element = document.getElementById("arrival");
  if (!element) {
    element = document.createElement("div");
    element.id = "arrival";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    document.body.append(element);
  }
  return element;
}
function recovery(message: string) {
  const element = veil();
  element.classList.remove("is-done");
  const label = document.createElement("span");
  label.textContent = message;
  label.style.cssText =
    "max-width: min(90vw, 32rem); text-align:center; line-height:1.6; letter-spacing:.08em";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Reload";
  button.style.cssText =
    "padding:12px 24px;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer";
  button.addEventListener("click", () => location.reload(), { once: true });
  element.replaceChildren(label, button);
  return button;
}
export function worldReady() {
  if (revealed || failed) return;
  revealed = true;
  clearTimeout(slowTimer);
  const element = document.getElementById("arrival");
  if (!element) return;
  element.classList.add("is-done");
  revealTimer = window.setTimeout(() => element.remove(), 700);
}
export function worldFailed() {
  if (failed) return;
  failed = true;
  clearTimeout(slowTimer);
  clearTimeout(revealTimer);
  recovery("The brook could not load. Please try again.").focus({ preventScroll: true });
}
if (typeof window !== "undefined") {
  slowTimer = window.setTimeout(() => {
    if (!revealed && !failed) recovery("Still preparing the brook. You can wait or reload.");
  }, 30_000);
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearTimeout(slowTimer);
    clearTimeout(revealTimer);
  });
