import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, validateStory, estimateDuration } from '../lib.mjs';

test('timeline is contiguous and words fill each shot', () => {
  const tl = buildTimeline([{ text: 'satu dua tiga' }, { text: 'empat' }], [2, 1.5]);
  assert.equal(tl[0].start, 0);
  assert.equal(tl[1].start, 2);
  assert.equal(tl[0].words.length, 3);
  assert.ok(Math.abs(tl[0].words.at(-1).end - 2) < 1e-9);
  assert.ok(Math.abs(tl[1].words[0].end - 3.5) < 1e-9);
  for (let i = 1; i < 3; i++) assert.equal(tl[0].words[i].start, tl[0].words[i - 1].end);
});

test('estimateDuration follows narration pace with a floor', () => {
  assert.equal(estimateDuration('hi'), 1.2);
  assert.ok(Math.abs(estimateDuration(Array(11).fill('kata').join(' ')) - (11 / 3.67 + 0.25)) < 1e-9);
});

test('validateStory rejects bad references', () => {
  const ok = { cast: { a: {} }, shots: [{ text: 'x', actors: [{ id: 'a', face: ['happy'] }], speaker: 'a' }] };
  assert.equal(validateStory(ok), ok);
  assert.throws(() => validateStory({ shots: [] }), /non-empty/);
  assert.throws(() => validateStory({ shots: [{ text: 'x', actors: [{ id: 'b' }] }] }), /not in "cast"/);
  assert.throws(() => validateStory({ cast: { a: {} }, shots: [{ text: 'x', actors: [{ id: 'a', face: 'meh' }] }] }), /unknown face/);
  assert.throws(() => validateStory({ shots: [{ text: 'x', camera: 'zoom' }] }), /unknown camera/);
});
