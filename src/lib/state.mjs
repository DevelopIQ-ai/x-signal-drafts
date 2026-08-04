import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const emptyState = () => ({ version: 1, seenTweetIds: {}, replyDays: {}, daily: {} });

export function trimState(state, now = new Date()) {
  state.version = 1;
  state.seenTweetIds ||= {};
  state.replyDays ||= {};
  state.daily ||= {};
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  for (const [tweetId, seenAt] of Object.entries(state.seenTweetIds)) {
    if (Number(new Date(seenAt)) < cutoff) delete state.seenTweetIds[tweetId];
  }
  const days = Object.keys(state.replyDays).sort().reverse().slice(30);
  for (const day of days) delete state.replyDays[day];
  const dailyDays = Object.keys(state.daily).sort().reverse().slice(30);
  for (const day of dailyDays) delete state.daily[day];
  return state;
}

export async function loadState(file) {
  try { return trimState(JSON.parse(await readFile(file, 'utf8'))); } catch (error) {
    if (error?.code === 'ENOENT') return emptyState();
    throw new Error(`Could not parse state at ${file}: ${error.message}`);
  }
}

export async function saveState(file, state) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(trimState(state), null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

export function zonedDay(date, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function canDraftReply(state, { date, maxDraftsPerDay }) {
  return (state.replyDays?.[date]?.count || 0) < maxDraftsPerDay;
}

export function recordReplyBatch(state, { date, tweetIds, sentAt = new Date().toISOString() }) {
  state.replyDays ||= {};
  state.replyDays[date] ||= { count: 0, sentAt: [] };
  state.replyDays[date].count += tweetIds.length;
  state.replyDays[date].sentAt.push(sentAt);
  for (const tweetId of tweetIds) state.seenTweetIds[tweetId] = sentAt;
}

export function recordSignal(state, { date, tweetId, sentAt = new Date().toISOString() }) {
  recordReplyBatch(state, { date, tweetIds: [tweetId], sentAt });
}
