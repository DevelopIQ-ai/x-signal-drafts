import test from 'node:test';
import assert from 'node:assert/strict';
import { canDraftReply, emptyState, recordReplyBatch } from '../src/lib/state.mjs';

test('daily reply cap is enforced after a batch', () => {
  const state = emptyState();
  recordReplyBatch(state, { date: '2026-08-04', tweetIds: ['1', '2'] });
  assert.equal(canDraftReply(state, { date: '2026-08-04', maxDraftsPerDay: 2 }), false);
  assert.equal(canDraftReply(state, { date: '2026-08-04', maxDraftsPerDay: 3 }), true);
});
