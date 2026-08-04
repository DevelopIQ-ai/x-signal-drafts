import { readFile } from 'node:fs/promises';

export async function loadContext(file, { maxItems = 20, now = new Date() } = {}) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (typeof item.text !== 'string' || !item.text.trim()) continue;
      if (item.at && new Date(item.at).getTime() < cutoff) continue;
      items.push({ at: item.at || null, text: item.text.trim(), source: item.source || 'context file' });
    } catch {
      throw new Error(`Invalid JSONL line in ${file}`);
    }
  }
  return items.slice(-maxItems);
}
