import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/lib/config.mjs';

test('normalizes handles and fills safe reply limits', () => {
  const config = validateConfig({ targets: ['@swyx', 'swyx', 'mitsuhiko'], voice: { interests: ['agents'] } });
  assert.deepEqual(config.targets, ['swyx', 'mitsuhiko']);
  assert.equal(config.reply.maxDraftsPerDay, 4);
});

test('rejects an invalid handle', () => {
  assert.throws(() => validateConfig({ targets: ['not-valid!'] }), /valid X handles/);
});
