import { readFile } from 'node:fs/promises';

const defaults = {
  targets: [],
  reply: { pollEveryMinutes: 10, lookbackMinutes: 20, maxDraftsPerRun: 2, maxDraftsPerDay: 4 },
  daily: { hour: 8, minute: 15, timezone: 'America/Los_Angeles' },
  voice: { bio: 'a technical founder', style: 'direct and conversational', interests: [] },
};

function number(value, fallback, name, { min = 0, max = Infinity } = {}) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < min || resolved > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return resolved;
}

export function validateConfig(input = {}) {
  const targets = [...new Set((input.targets || defaults.targets).map((target) => String(target).replace(/^@/, '').trim()).filter(Boolean))];
  if (targets.some((target) => !/^[A-Za-z0-9_]{1,15}$/.test(target))) {
    throw new Error('targets must be valid X handles without @.');
  }
  const replyInput = { ...defaults.reply, ...(input.reply || {}) };
  const dailyInput = { ...defaults.daily, ...(input.daily || {}) };
  const voice = { ...defaults.voice, ...(input.voice || {}) };
  if (!Array.isArray(voice.interests)) throw new Error('voice.interests must be an array.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: dailyInput.timezone }); } catch { throw new Error(`Invalid timezone: ${dailyInput.timezone}`); }
  return {
    targets,
    reply: {
      pollEveryMinutes: number(replyInput.pollEveryMinutes, 10, 'reply.pollEveryMinutes', { min: 1, max: 1440 }),
      lookbackMinutes: number(replyInput.lookbackMinutes, 20, 'reply.lookbackMinutes', { min: 1, max: 10080 }),
      maxDraftsPerRun: number(replyInput.maxDraftsPerRun, 2, 'reply.maxDraftsPerRun', { min: 0, max: 25 }),
      maxDraftsPerDay: number(replyInput.maxDraftsPerDay, 4, 'reply.maxDraftsPerDay', { min: 0, max: 100 }),
    },
    daily: {
      hour: number(dailyInput.hour, 8, 'daily.hour', { min: 0, max: 23 }),
      minute: number(dailyInput.minute, 15, 'daily.minute', { min: 0, max: 59 }),
      timezone: dailyInput.timezone,
    },
    voice: {
      bio: String(voice.bio || defaults.voice.bio).trim(),
      style: String(voice.style || defaults.voice.style).trim(),
      interests: voice.interests.map(String).map((value) => value.trim()).filter(Boolean),
    },
  };
}

export async function loadConfig(file = process.env.X_SIGNAL_CONFIG || './config.json') {
  let source;
  try { source = JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`Config not found at ${file}. Copy config.example.json to config.json.`);
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
  return validateConfig(source);
}
