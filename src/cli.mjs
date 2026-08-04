import { loadEnv } from './lib/env.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadState, saveState, zonedDay, canDraftReply, recordSignal } from './lib/state.mjs';
import { searchRecentPosts } from './lib/x.mjs';
import { classifyPost, draftDailyPost } from './lib/model.mjs';
import { dailyEmail, deliverOrPrint, signalEmail } from './lib/mail.mjs';
import { loadContext } from './lib/context.mjs';
import { appendAlert } from './lib/feed.mjs';
import { startServer } from './server.mjs';

await loadEnv();

const stateFile = process.env.X_SIGNAL_STATE || './data/state.json';
const contextFile = process.env.X_SIGNAL_CONTEXT || './data/context.jsonl';

function log(event, fields = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...fields })}\n`);
}

async function signalScan({ now = new Date() } = {}) {
  const config = await loadConfig();
  if (!config.targets.length) throw new Error('config.targets must contain at least one X handle for scanning.');
  const state = await loadState(stateFile);
  const date = zonedDay(now, config.daily.timezone);
  if (!canDraftReply(state, { date, maxDraftsPerDay: config.reply.maxDraftsPerDay })) {
    log('signal-scan-skipped', { reason: 'daily-cap', date, count: state.replyDays[date].count });
    return;
  }
  const since = new Date(now.getTime() - config.reply.lookbackMinutes * 60_000);
  const candidates = (await searchRecentPosts(config.targets, { since, maxResults: 10 })).filter((tweet) => !state.seenTweetIds[tweet.id]);
  const capacity = Math.min(config.reply.maxDraftsPerRun, config.reply.maxDraftsPerDay - (state.replyDays[date]?.count || 0));
  let alertCount = 0;
  for (const tweet of candidates) {
    if ((state.replyDays[date]?.count || 0) >= capacity) break;
    const signal = await classifyPost(tweet, config.voice);
    if (signal.isSignal) {
      const alert = { tweet, rationale: signal.rationale };
      alertCount += 1;
      await appendAlert(alert);
      await deliverOrPrint(signalEmail(alert));
      recordSignal(state, { date, tweetId: tweet.id, sentAt: now.toISOString() });
    } else {
      state.seenTweetIds[tweet.id] = now.toISOString();
    }
  }
  await saveState(stateFile, state);
  log('signal-scan-complete', { candidates: candidates.length, alerts: alertCount, dailyCount: state.replyDays[date]?.count || 0 });
}

async function dailyDraft({ now = new Date(), force = false } = {}) {
  const config = await loadConfig();
  const state = await loadState(stateFile);
  const date = zonedDay(now, config.daily.timezone);
  if (state.daily[date]?.status === 'sent' && !force) {
    log('daily-draft-skipped', { reason: 'already-sent', date });
    return;
  }
  const evidence = await loadContext(contextFile, { now });
  if (!evidence.length) throw new Error(`No fresh context in ${contextFile}. Add JSONL evidence before drafting instead of making a post up.`);
  const draft = state.daily[date]?.draft || await draftDailyPost(evidence, config.voice);
  const delivery = await deliverOrPrint(dailyEmail({ date, draft, evidence }));
  state.daily[date] = { status: 'sent', draftedAt: now.toISOString(), sentAt: now.toISOString(), draft, deliveryMode: delivery.mode };
  await saveState(stateFile, state);
  log('daily-draft-complete', { date, deliveryMode: delivery.mode });
}

function zonedTime(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { hour: values.hour, minute: values.minute };
}

async function daemon() {
  const config = await loadConfig();
  const runScan = async () => { try { await signalScan(); } catch (error) { log('signal-scan-failed', { error: error.message }); } };
  const runDaily = async () => {
    const time = zonedTime(new Date(), config.daily.timezone);
    if (time.hour !== config.daily.hour || time.minute !== config.daily.minute) return;
    try { await dailyDraft(); } catch (error) { log('daily-draft-failed', { error: error.message }); }
  };
  await runScan();
  await runDaily();
  setInterval(runScan, config.reply.pollEveryMinutes * 60_000);
  setInterval(runDaily, 60_000);
  log('daemon-started', { pollEveryMinutes: config.reply.pollEveryMinutes, timezone: config.daily.timezone });
}

async function serve() {
  await startServer({
    port: process.env.PORT || 3210,
    onScan: signalScan,
  });
}

async function run() {
  await startServer({
    port: process.env.PORT || 3210,
    onScan: signalScan,
  });
  await daemon();
}

const command = process.argv[2] || 'help';
if (command === 'scan' || command === 'reply-scan') await signalScan();
else if (command === 'daily-draft') await dailyDraft({ force: process.argv.includes('--force') });
else if (command === 'serve') await serve();
else if (command === 'run') await run();
else if (command === 'help' || command === '--help' || command === '-h') {
  process.stdout.write(`Usage: x-signal-drafts <scan|daily-draft|serve|run>\n`);
} else {
  throw new Error(`Unknown command: ${command}`);
}
