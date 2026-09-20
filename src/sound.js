// ===== WebAudio 合成音效（零素材）=====
const MAT_FREQ = {
  stone: 720, grass: 380, wood: 480, sand: 1500, glass: 2400,
  wool: 260, water: 900,
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noiseBuf = null;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { this.enabled = false; return false; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  noise(dur, freq, q, vol, type = 'bandpass', slide = 0) {
    if (!this.enabled || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.02);
  }

  tone(freq, dur, vol, wave = 'square', slide = 0) {
    if (!this.enabled || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(type, opts = {}) {
    if (!this.enabled) return;
    const vol = (opts.vol || 1);
    const mat = MAT_FREQ[opts.mat] || 600;
    switch (type) {
      case 'dig': this.noise(0.09, mat * (0.8 + Math.random() * 0.4), 1.6, 0.16 * vol); break;
      case 'break': this.noise(0.22, mat * 0.8, 1.1, 0.34 * vol); this.noise(0.14, mat * 1.7, 2.2, 0.2 * vol); break;
      case 'step': this.noise(0.07, mat * (0.75 + Math.random() * 0.5), 1.3, 0.09 * vol); break;
      case 'place': this.noise(0.11, mat, 1.6, 0.26 * vol); this.tone(mat * 0.5, 0.06, 0.05 * vol, 'triangle'); break;
      case 'pop': this.tone(520, 0.09, 0.16, 'sine', 420); break;
      case 'hurt': this.tone(340, 0.18, 0.22, 'sawtooth', -160); break;
      case 'eat':
        this.noise(0.07, 900, 1.2, 0.2);
        setTimeout(() => this.noise(0.07, 700, 1.2, 0.2), 140);
        setTimeout(() => this.noise(0.07, 500, 1.2, 0.2), 300);
        break;
      case 'fuse': this.noise(0.5, 3400, 0.6, 0.12, 'highpass'); break;
      case 'explode':
        this.noise(0.9, 90, 0.5, 0.9, 'lowpass', 260);
        this.tone(60, 0.5, 0.5, 'sine', -30);
        break;
      case 'splash': this.noise(0.3, 1400, 0.8, 0.25, 'highpass'); break;
      case 'zombie': this.tone(110 + Math.random() * 30, 0.35, 0.14, 'sawtooth', -40); break;
    }
  }
}
