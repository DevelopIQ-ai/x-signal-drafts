import { required } from './env.mjs';

export function signalEmail(alert) {
  const tweet = alert.tweet;
  const text = [
    'X signal alert. Nothing has been posted to X.',
    '',
    `@${tweet.author.username}: ${tweet.url}`,
    tweet.text,
    alert.rationale ? `Why it matters: ${alert.rationale}` : '',
  ].join('\n');
  return { subject: `X signal — @${tweet.author.username} posted`, text };
}

export function dailyEmail({ date, draft, evidence }) {
  const sourceLines = draft.evidenceIndexes.map((index) => evidence[index]).filter(Boolean).map((item) => `- ${item.text}`);
  return {
    subject: `Your X draft — ${date}`,
    text: ['Draft only. Nothing has been posted to X.', '', draft.draft, '', `Angle: ${draft.angle || '—'}`, '', 'Grounding:', ...(sourceLines.length ? sourceLines : ['- no source references returned'])].join('\n'),
  };
}

export async function deliverOrPrint(message) {
  const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
  const inboxId = process.env.AGENTMAIL_INBOX_ID?.trim();
  const recipient = process.env.EMAIL_TO?.trim();
  if (!apiKey || !inboxId || !recipient) {
    process.stdout.write(`\n--- ${message.subject} ---\n${message.text}\n`);
    return { mode: 'stdout' };
  }
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: recipient, subject: message.subject, text: message.text }),
  });
  if (!response.ok) throw new Error(`AgentMail API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return { mode: 'agentmail', response: await response.json() };
}
