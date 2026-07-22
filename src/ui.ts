/** Thin DOM glue for the HUD declared in index.html. */
export class UI {
  onSoundChange: (on: boolean) => void = () => {};
  onReset: () => void = () => {};

  private captionEl = document.getElementById('caption')!;
  private hintEl = document.getElementById('hint')!;
  private cordsEl = document.getElementById('stat-cords')!;
  private logsEl = document.getElementById('stat-logs')!;
  private captionTimer: number | null = null;

  constructor() {
    const gear = document.getElementById('gear')!;
    const panel = document.getElementById('panel')!;
    gear.addEventListener('click', () => panel.classList.toggle('open'));

    const sound = document.getElementById('opt-sound') as HTMLInputElement;
    sound.addEventListener('change', () => this.onSoundChange(sound.checked));
    document.getElementById('btn-reset')!.addEventListener('click', () => this.onReset());
  }

  applySettings(sound: boolean): void {
    (document.getElementById('opt-sound') as HTMLInputElement).checked = sound;
  }

  /** brief center-top text, e.g. the species card when a round lands */
  caption(text: string, holdMs = 2600): void {
    this.captionEl.textContent = text;
    this.captionEl.style.opacity = '0.7';
    if (this.captionTimer !== null) window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => {
      this.captionEl.style.opacity = '0';
    }, holdMs);
  }

  hint(text: string): void {
    this.hintEl.textContent = text;
    this.hintEl.style.opacity = text ? '0.55' : '0';
  }

  stats(cords: number, logsSplit: number): void {
    this.cordsEl.textContent = cords.toFixed(2);
    this.logsEl.textContent = String(logsSplit);
  }
}
