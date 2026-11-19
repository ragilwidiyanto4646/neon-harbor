// save.js — localStorage save and load for Neon Harbor.
//
// The save holds cash, job progress, the player position and health,
// and the best cash total. Everything is wrapped in try/catch because
// localStorage can be unavailable (private mode, disabled storage,
// or a sandboxed iframe). Same-origin JSON only; nothing is fetched
// from the network.

export const SAVE_KEY = 'neon-harbor-save-v1';

// Build the save object from the live game state.
export function buildSave(game) {
  const player = game.player;
  return {
    version: 1,
    savedAt: Date.now(),
    cash: player.cash,
    bestCash: Math.max(game.bestCash || 0, player.cash),
    jobIndex: game.mission.jobIndex,
    completedJobs: game.mission.completed,
    playerX: player.x,
    playerY: player.y,
    health: player.health,
    playSeconds: game.playSeconds || 0,
  };
}

// Write the save. Returns true on success, false when storage is
// unavailable or the write fails.
export function saveGame(game) {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const data = buildSave(game);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.saveData = data;
    game.bestCash = data.bestCash;
    return true;
  } catch (error) {
    // Storage full, blocked, or otherwise unavailable: the game keeps
    // running, it just cannot persist progress right now.
    return false;
  }
}

// Read the save, or null when there is none or it is unreadable.
export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== 1) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
}

// Remove the save entirely.
export function clearSave() {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

// Apply a loaded save to a fresh game state.
export function applySave(game, data) {
  if (!data) {
    return false;
  }
  const player = game.player;
  player.cash = typeof data.cash === 'number' ? data.cash : player.cash;
  player.health = typeof data.health === 'number' ? data.health : player.health;
  player.x = typeof data.playerX === 'number' ? data.playerX : player.x;
  player.y = typeof data.playerY === 'number' ? data.playerY : player.y;
  game.mission.jobIndex = typeof data.jobIndex === 'number' ? data.jobIndex : 0;
  game.mission.completed = typeof data.completedJobs === 'number' ? data.completedJobs : 0;
  game.bestCash = typeof data.bestCash === 'number' ? data.bestCash : 0;
  game.playSeconds = typeof data.playSeconds === 'number' ? data.playSeconds : 0;
  game.saveData = data;
  return true;
}

// A short human-readable summary of a save for the title screen.
export function saveSummary(data) {
  if (!data) {
    return 'No save yet';
  }
  const date = new Date(data.savedAt || 0);
  const day = date.toLocaleDateString();
  return 'Continue — $' + (data.cash || 0) + ', ' + (data.completedJobs || 0) + '/15 jobs, saved ' + day;
}
