import gsap from "gsap";

/** Only this world's tweens; replay must not clear React/other worlds' GSAP timelines. */
export class SceneMotions {
  private active = new Set<gsap.core.Animation>();
  to(target: gsap.TweenTarget, vars: gsap.TweenVars) {
    const complete = vars.onComplete;
    const tween = gsap.to(target, {
      ...vars,
      onComplete: () => {
        this.active.delete(tween);
        complete?.();
      },
    });
    this.active.add(tween);
    return tween;
  }
  later(delay: number, callback: () => void) {
    const job = gsap.delayedCall(delay, () => {
      this.active.delete(job);
      callback();
    });
    this.active.add(job);
    return job;
  }
  finish() {
    for (const animation of [...this.active]) animation.totalProgress(1, false);
  }
  cancel() {
    for (const animation of this.active) animation.kill();
    this.active.clear();
  }
}
