import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readAlerts, appendAlert } from './lib/feed.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function text(response, status, body, type = 'text/plain') {
  response.writeHead(status, { 'content-type': type });
  response.end(body);
}

async function serveUi(response) {
  try {
    const html = await readFile(path.join(__dirname, 'ui', 'index.html'), 'utf8');
    text(response, 200, html, 'text/html');
  } catch (error) {
    json(response, 500, { error: 'Could not load UI.' });
  }
}

export function createServer({ onScan } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === 'GET' && url.pathname === '/') {
        await serveUi(response);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/health') {
        json(response, 200, { status: 'ok' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        const config = await loadConfig();
        json(response, 200, { targets: config.targets, reply: config.reply, daily: config.daily, voice: config.voice });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/feed') {
        const limit = Math.min(100, Number(url.searchParams.get('limit')) || 50);
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        const alerts = await readAlerts({ limit, offset });
        json(response, 200, { alerts });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/scan') {
        if (onScan) {
          onScan().catch((error) => console.error(JSON.stringify({ at: new Date().toISOString(), event: 'scan-error', error: error.message })));
          json(response, 202, { status: 'started' });
        } else {
          json(response, 503, { error: 'Scan handler not configured.' });
        }
        return;
      }
      json(response, 404, { error: 'Not found.' });
    } catch (error) {
      json(response, 500, { error: error.message });
    }
  });
  return server;
}

export function startServer({ port = process.env.PORT || 3210, onScan } = {}) {
  const server = createServer({ onScan });
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(JSON.stringify({ at: new Date().toISOString(), event: 'server-started', port }));
      resolve(server);
    });
  });
}
