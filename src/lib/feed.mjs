import { readFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const feedFile = process.env.X_SIGNAL_FEED || './data/feed.jsonl';

export async function appendAlert(alert) {
  const file = feedFile;
  await mkdir(path.dirname(file), { recursive: true });
  const line = JSON.stringify({ ...alert, createdAt: new Date().toISOString() }) + '\n';
  await appendFile(file, line, { mode: 0o600 });
}

export async function readAlerts({ limit = 100, offset = 0 } = {}) {
  let text;
  try { text = await readFile(feedFile, 'utf8'); } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { items.push(JSON.parse(line)); } catch { /* ignore malformed lines */ }
  }
  return items.reverse().slice(offset, offset + limit);
}
