// input.js — keyboard state for the game.
//
// Tracks which keys are currently held down and which keys were just
// pressed on this frame. The game loop calls update() once per frame
// to clear the "just pressed" set, so a single key press only fires
// one action even if the key is held for many frames.

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.enabled = true;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  onKeyDown(event) {
    if (!this.enabled) {
      return;
    }
    // Stop the page from scrolling when the player uses arrows or space.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!this.keys.has(key)) {
      this.justPressed.add(key);
    }
    this.keys.add(key);
  }

  onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    this.keys.delete(key);
  }

  onBlur() {
    // If the window loses focus, forget every held key so the player
    // does not keep driving after alt-tabbing away.
    this.keys.clear();
    this.justPressed.clear();
  }

  // True while the key is held down.
  isDown(key) {
    return this.keys.has(key);
  }

  // True only on the frame the key was first pressed.
  wasPressed(key) {
    return this.justPressed.has(key);
  }

  // Any of the given keys held down.
  anyDown(keys) {
    for (const key of keys) {
      if (this.keys.has(key)) {
        return true;
      }
    }
    return false;
  }

  // Any of the given keys pressed this frame.
  anyPressed(keys) {
    for (const key of keys) {
      if (this.justPressed.has(key)) {
        return true;
      }
    }
    return false;
  }

  // Call once per frame, after the game has read the input.
  update() {
    this.justPressed.clear();
  }

  // Simulate a key press (used by the autopilot in shots.js and by
  // automated playtests). Mirrors a real keydown + keyup pair.
  simulatePress(key) {
    this.justPressed.add(key);
    this.keys.add(key);
  }

  simulateRelease(key) {
    this.keys.delete(key);
  }

  simulateHold(key) {
    this.keys.add(key);
  }
}
