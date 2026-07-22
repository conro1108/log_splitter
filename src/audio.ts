/**
 * All sound is synthesized — no assets. Thunks are filtered noise over a low
 * sine knock; the split "pop" adds fiber-tear crackle; ambience is wind
 * (slow-breathing filtered noise) and occasional far-off birds.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private birdTimer: number | null = null;
  enabled = true;

  /** call from a user gesture; safe to call repeatedly */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.startWind();
    this.scheduleBird();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.1);
    }
  }

  private burst(
    filterType: BiquadFilterType, freq: number, dur: number, gain: number, when = 0,
  ): void {
    if (!this.ctx || !this.noise || !this.master) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random(), dur + 0.05);
  }

  private knock(freq: number, dur: number, gain: number, when = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** blade bites, wood holds */
  thunk(weight = 1): void {
    this.burst('lowpass', 300, 0.14, 0.5 * weight);
    this.knock(85, 0.16, 0.4 * weight);
  }

  /** dead knot hit — all knock, no bite */
  knot(): void {
    this.burst('lowpass', 180, 0.1, 0.45);
    this.knock(60, 0.22, 0.5);
  }

  /** the payoff: clean split */
  pop(big = 1): void {
    this.burst('bandpass', 1900, 0.07, 0.55 * big);
    this.burst('lowpass', 350, 0.16, 0.5 * big);
    this.knock(110, 0.12, 0.35 * big);
    // fibers letting go
    for (let i = 0; i < 4; i++) {
      this.burst('highpass', 2600, 0.03, 0.16 * big, 0.03 + i * 0.035 + Math.random() * 0.02);
    }
  }

  glance(): void {
    this.burst('bandpass', 900, 0.18, 0.3);
    this.knock(140, 0.06, 0.12, 0.02);
  }

  stuck(): void {
    this.burst('lowpass', 220, 0.2, 0.55);
    this.knock(70, 0.3, 0.5);
  }

  wiggle(): void {
    this.burst('bandpass', 500, 0.1, 0.25);
    this.knock(120, 0.08, 0.15);
  }

  private startWind(): void {
    if (!this.ctx || !this.noise || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(f).connect(this.windGain).connect(this.master);
    src.start();

    // slow breathing gusts
    const gust = () => {
      if (!this.ctx || !this.windGain) return;
      const target = 0.03 + Math.random() * 0.07;
      this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 2.5);
      window.setTimeout(gust, 4000 + Math.random() * 6000);
    };
    gust();
  }

  private scheduleBird(): void {
    const call = () => {
      if (this.ctx && this.master && this.enabled) {
        const chirps = 2 + Math.floor(Math.random() * 3);
        const base = 2300 + Math.random() * 900;
        for (let i = 0; i < chirps; i++) {
          const t = this.ctx.currentTime + i * (0.14 + Math.random() * 0.08);
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.05);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.09);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.04, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          o.connect(g).connect(this.master);
          o.start(t);
          o.stop(t + 0.12);
        }
      }
      this.birdTimer = window.setTimeout(call, 7000 + Math.random() * 16000);
    };
    this.birdTimer = window.setTimeout(call, 4000);
  }

  dispose(): void {
    if (this.birdTimer !== null) window.clearTimeout(this.birdTimer);
    void this.ctx?.close();
  }
}
