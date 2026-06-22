import type { PetPackManifest, PetState } from "@kimi-pet/shared-types";

export class PetRenderer {
  private el: HTMLElement;
  private manifest: PetPackManifest;
  private spritesheetUrl: string;
  private currentState: PetState = "idle";
  private currentFrame = 0;
  private startTime = 0;
  private rafId: number | null = null;

  constructor(el: HTMLElement, manifest: PetPackManifest, spritesheetUrl: string) {
    this.el = el;
    this.manifest = manifest;
    this.spritesheetUrl = spritesheetUrl;
    this.el.style.backgroundImage = `url("${spritesheetUrl}")`;
    this.startTime = performance.now();
    this.tick();
  }

  setState(state: PetState): void {
    if (this.manifest.animations[state]) {
      this.currentState = state;
      this.currentFrame = 0;
      this.startTime = performance.now();
    }
  }

  getState(): PetState {
    return this.currentState;
  }

  private tick = (): void => {
    const anim = this.manifest.animations[this.currentState];
    if (!anim) return;

    const elapsedMs = performance.now() - this.startTime;
    const frame = Math.floor((elapsedMs / 1000) * anim.fps);

    if (anim.loop) {
      this.currentFrame = frame % anim.frames;
    } else {
      this.currentFrame = Math.min(frame, anim.frames - 1);
      if (frame >= anim.frames && anim.next) {
        this.setState(anim.next);
      }
    }

    const x = -this.currentFrame * this.manifest.asset.cellWidth;
    const y = -anim.row * this.manifest.asset.cellHeight;

    this.el.style.backgroundPosition = `${x}px ${y}px`;

    this.rafId = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
