// serve.ts — a tiny static server for the Neon Harbor game.
//
// Node standard library only. Serves files under the game/ folder on
// 127.0.0.1, with the port from --port (default 8080). Paths that try
// to escape the game folder are refused.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = join(here, 'game');

// Read the port from --port, falling back to 8080.
let port = 8080;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Resolve the path and refuse anything outside game/. The check
    // must include the path separator: a plain startsWith(gameRoot)
    // would also accept a sibling directory named "game-evil".
    const resolved = normalize(join(gameRoot, pathname));
    if (resolved !== gameRoot && !resolved.startsWith(gameRoot + sep)) {
      response.writeHead(403, { 'Content-Type': 'text/plain' });
      response.end('Forbidden\n');
      return;
    }

    const info = await stat(resolved);
    if (!info.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found\n');
      return;
    }

    const body = await readFile(resolved);
    const type = MIME_TYPES[extname(resolved)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found\n');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('Neon Harbor serving at http://127.0.0.1:' + port + '/');
});
