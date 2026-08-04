import { required } from './env.mjs';

function extractText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  return (payload.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('\n');
}

function parseJson(text) {
  const trimmed = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed); } catch { throw new Error(`Model did not return valid JSON: ${trimmed.slice(0, 300)}`); }
}

async function askJson(instructions, input) {
  const key = required('OPENAI_API_KEY');
  const model = required('OPENAI_MODEL');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: instructions }] },
        { role: 'user', content: [{ type: 'input_text', text: input }] },
      ],
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return parseJson(extractText(await response.json()));
}

export async function draftReply(tweet, voice) {
  const instructions = `You draft replies to X posts for a real person. Return JSON only: {"shouldReply":boolean,"draft":string,"rationale":string}.

The person is ${voice.bio}. Their style: ${voice.style}. Interests: ${voice.interests.join(', ') || 'none listed'}.

Only set shouldReply true if the reply adds a specific observation, a causal/non-obvious inference, a disagreement with a reason, a falsifiable question, or post-specific humor. Do not restate the post, say generic agreement, use engagement bait, or manufacture expertise. Skip announcements, memes, low-information posts, and anything the person could not naturally have an opinion on. If replying, write one or two natural sentences under 280 characters. Never claim personal experience not provided.`;
  const value = await askJson(instructions, `Author: @${tweet.author.username}\nPost:\n${tweet.text}\nURL: ${tweet.url}`);
  const draft = String(value.draft || '').trim();
  return {
    shouldReply: Boolean(value.shouldReply) && draft.length > 0 && draft.length <= 280,
    draft,
    rationale: String(value.rationale || '').trim(),
  };
}

export async function draftDailyPost(evidence, voice) {
  const instructions = `You draft one original X post for a real person. Return JSON only: {"draft":string,"angle":string,"evidenceIndexes":number[]}.

The person is ${voice.bio}. Their style: ${voice.style}. Interests: ${voice.interests.join(', ') || 'none listed'}.

Use only the supplied evidence. Write one compact original thought under 280 characters: a firsthand field report, a sharp earned opinion, or a concrete founder observation. Do not invent metrics, customers, launches, outcomes, chronology, or personal experience. Make it sound naturally spoken, not like a brand account. evidenceIndexes must point only to evidence items that support the draft.`;
  const numbered = evidence.map((item, index) => `[${index}] ${item.text}`).join('\n');
  const value = await askJson(instructions, `Evidence:\n${numbered}`);
  const draft = String(value.draft || '').trim();
  if (!draft || draft.length > 280) throw new Error('Model returned an empty or overlong daily draft.');
  return {
    draft,
    angle: String(value.angle || '').trim(),
    evidenceIndexes: Array.isArray(value.evidenceIndexes) ? value.evidenceIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < evidence.length) : [],
  };
}
