// main.ts — build the Neon Harbor dossier for make.fun.
//
// This is a small Node 22 program, standard library only. It copies
// the static game folder into the output directory, copies the
// screenshots beside it, and writes dossier.json using the vendored
// makefun-game library. The output directory comes from the
// MAKEFUN_OUTPUT_DIR environment variable, or /output by default.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory that holds this file (the repo root).
const here = fileURLToPath(new URL('.', import.meta.url));

// Where the finished bundle goes.
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Make sure the output directory exists.
mkdirSync(out, { recursive: true });

// Copy the whole game folder (index.html + src modules) into the
// output directory, overwriting any previous build.
const gameSource = join(here, 'game');
const gameDestination = join(out, 'game');
cpSync(gameSource, gameDestination, { recursive: true, force: true });

// The screenshots folder holds the four staged renders.
const screenshotsDestination = join(out, 'screenshots');
mkdirSync(screenshotsDestination, { recursive: true });

// If the repo has screenshots, copy them into the bundle too.
const screenshotsSource = join(here, 'screenshots');
if (existsSync(screenshotsSource)) {
  cpSync(screenshotsSource, screenshotsDestination, { recursive: true, force: true });
}

// Build the dossier the platform checks: text limits, screenshot
// limits, and game file limits. buildDossier returns the dossier as
// a Uint8Array of JSON bytes, so write those bytes directly.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// Write the dossier next to the game and screenshots.
writeFileSync(join(out, 'dossier.json'), dossier);

console.log('Neon Harbor dossier written to ' + join(out, 'dossier.json'));
