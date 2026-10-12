import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionAdvice } from '../server/composition.mjs';
const box = { x: .3, y: .2, width: .3, height: .5 };
const analysis = changes => ({ comparable: true, confidence: .95, reference: box, current: box, perspective: 'none', perspectiveConfidence: 0, ...changes });
test('matched framing; no fabricated camera-height instruction', () => assert.equal(compositionAdvice(analysis({})).action, 'matched'));
test('screen-relative horizontal directions', () => {
  assert.equal(compositionAdvice(analysis({ current: { ...box, x: .5 } })).action, 'subject_left');
  assert.equal(compositionAdvice(analysis({ current: { ...box, x: .1 } })).action, 'subject_right');
});
test('vertical box mismatch is framing, not camera height', () => {
  assert.equal(compositionAdvice(analysis({ current: { ...box, y: .4 } })).action, 'subject_up');
  assert.equal(compositionAdvice(analysis({ current: { ...box, y: .05 } })).action, 'subject_down');
});
test('scale directions and deadband', () => {
  assert.equal(compositionAdvice(analysis({ current: { x: .24, y: .1, width: .42, height: .7 } })).action, 'step_back');
  assert.equal(compositionAdvice(analysis({ current: { x: .36, y: .3, width: .18, height: .3 } })).action, 'step_closer');
  assert.equal(compositionAdvice(analysis({ current: { ...box, x: .33 } })).action, 'matched');
});
test('pose changes are not a distance estimate', () => assert.equal(compositionAdvice(analysis({ current: { ...box, width: .5 } })).action === 'step_back', false));
test('uncertain, absent, malformed and out-of-bounds detections produce no direction', () => {
  for (const value of [null, {}, analysis({ confidence: .4 }), analysis({ confidence: NaN }), analysis({ reference: null }), analysis({ comparable: false }), analysis({ current: { ...box, x: -1 } })]) assert.equal(compositionAdvice(value).action, 'uncertain');
});
test('camera-height advice requires explicit high-confidence perspective evidence', () => {
  assert.equal(compositionAdvice(analysis({ perspective: 'lower_camera', perspectiveConfidence: .95 })).action, 'lower_camera');
  assert.equal(compositionAdvice(analysis({ perspective: 'raise_camera', perspectiveConfidence: .5 })).action, 'matched');
});
