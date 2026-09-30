import { SceneResources } from "./resources";

export const aborted = () => new DOMException("World disposed", "AbortError");

/** Assets, shader jobs and their late results share one world lifetime. */
export class SceneLifetime {
  readonly resources = new SceneResources();
  private controller = new AbortController();
  private external: AbortSignal | undefined;
  constructor(signal?: AbortSignal) {
    this.external = signal;
    if (signal?.aborted) this.dispose();
    else signal?.addEventListener("abort", this.dispose, { once: true });
  }
  get signal() {
    return this.controller.signal;
  }
  assertAlive() {
    if (this.signal.aborted) throw aborted();
  }
  wait<T>(job: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const cancel = () => reject(aborted());
      if (this.signal.aborted) cancel();
      else this.signal.addEventListener("abort", cancel, { once: true });
      job.then(
        (value) => {
          this.signal.removeEventListener("abort", cancel);
          if (this.signal.aborted) reject(aborted());
          else resolve(value);
        },
        (error: unknown) => {
          this.signal.removeEventListener("abort", cancel);
          reject(error);
        },
      );
    });
  }
  dispose = () => {
    if (this.signal.aborted) return;
    this.external?.removeEventListener("abort", this.dispose);
    this.external = undefined;
    this.controller.abort();
    this.resources.dispose();
  };
}
