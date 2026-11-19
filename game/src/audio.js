// audio.js — procedural WebAudio sound for Neon Harbor.
//
// Every sound is synthesized with the Web Audio API: no audio files,
// no network. The engine hum follows the car's speed, the siren is a
// two-tone oscillator, and the chimes and jingles are short sequences
// of notes. M toggles mute; the audio context is created lazily on
// the first user gesture so browsers allow it.

export class AudioSys {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  // Create the AudioContext on demand. Browsers block audio before a
  // user gesture, so this is called from the first key press.
  ensure() {
    if (this.context) {
      return true;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return false;
      }
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      return true;
    } catch (error) {
      return false;
    }
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // A single short tone. Used as the building block for chimes.
  tone(frequency, duration, type, volume, when) {
    if (!this.ensure() || this.muted) {
      return;
    }
    try {
      const startAt = this.context.currentTime + (when || 0);
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(volume || 0.2, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
    } catch (error) {
      // Audio is best-effort; a failure here must never break the game.
    }
  }

  // A burst of filtered noise, for crashes and thuds.
  noise(duration, volume, lowFrequency) {
    if (!this.ensure() || this.muted) {
      return;
    }
    try {
      const length = Math.floor(this.context.sampleRate * duration);
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFrequency || 800;
      const gain = this.context.createGain();
      gain.gain.value = volume || 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start();
    } catch (error) {
      // Best-effort only.
    }
  }

  // Engine hum: a sawtooth oscillator whose pitch follows speed.
  engineStart() {
    if (!this.ensure() || this.engineOsc) {
      return;
    }
    try {
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.04;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (error) {
      // Best-effort only.
    }
  }

  engineUpdate(speedRatio) {
    if (!this.engineOsc) {
      return;
    }
    try {
      const frequency = 55 + speedRatio * 140;
      this.engineOsc.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(0.03 + speedRatio * 0.05, this.context.currentTime, 0.1);
    } catch (error) {
      // Best-effort only.
    }
  }

  engineStop() {
    if (!this.engineOsc) {
      return;
    }
    try {
      this.engineOsc.stop();
    } catch (error) {
      // Already stopped.
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  // Two-tone police siren, alternating while the player is wanted.
  sirenStart() {
    if (!this.ensure() || this.sirenOsc) {
      return;
    }
    try {
      this.sirenOsc = this.context.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.context.createGain();
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (error) {
      // Best-effort only.
    }
  }

  sirenUpdate(dt) {
    if (!this.sirenOsc) {
      return;
    }
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.45) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      try {
        this.sirenOsc.frequency.setValueAtTime(this.sirenHigh ? 950 : 700, this.context.currentTime);
      } catch (error) {
        // Best-effort only.
      }
    }
  }

  sirenStop() {
    if (!this.sirenOsc) {
      return;
    }
    try {
      this.sirenOsc.stop();
    } catch (error) {
      // Already stopped.
    }
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  // Short melodic sounds for game events.
  chime() {
    this.tone(880, 0.18, 'sine', 0.22, 0);
    this.tone(1318, 0.22, 'sine', 0.18, 0.09);
  }

  thud() {
    this.noise(0.12, 0.35, 300);
    this.tone(90, 0.12, 'sine', 0.25, 0);
  }

  crash() {
    this.noise(0.35, 0.4, 600);
    this.tone(70, 0.3, 'sine', 0.3, 0);
  }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.22, 'triangle', 0.2, index * 0.11);
    });
  }

  pickup() {
    this.tone(1046, 0.15, 'sine', 0.2, 0);
    this.tone(1568, 0.2, 'sine', 0.16, 0.08);
  }
}
