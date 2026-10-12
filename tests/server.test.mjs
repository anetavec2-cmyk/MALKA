import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCoachServer } from '../server/server.mjs';
const image = 'data:image/jpeg;base64,/9gAAP/Z';
const box = { x: .3, y: .2, width: .3, height: .5 };
const output = { comparable: true, confidence: .9, reference: box, current: box, perspective: 'none', perspectiveConfidence: 0 };
async function withServer(options, run) {
  const server = createCoachServer(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const config = () => ({ token: 'private-test-token', apiKey: 'test-key' });
const headers = { Authorization: 'Bearer private-test-token', 'Content-Type': 'application/json' };
const request = { method: 'POST', headers, body: JSON.stringify({ reference: image, current: image }) };
test('rejects unauthenticated callers before any provider invocation', async () => {
  await withServer({ config, provider: () => { throw Error('must not call'); } }, async url => {
    const response = await fetch(`${url}/compare`, { ...request, headers: {} }); assert.equal(response.status, 401);
  });
});
test('health reports unconfigured state without exposing credentials', async () => {
  await withServer({ config: () => ({ token: 'private-test-token' }) }, async url => {
    const response = await fetch(`${url}/health`, { headers }); assert.deepEqual(await response.json(), { ready: false });
    const comparison = await fetch(`${url}/compare`, request); assert.equal(comparison.status, 503);
  });
});
test('rejects remote URLs and oversized or malformed images', async () => {
  await withServer({ config, provider: () => { throw Error('must not call'); } }, async url => {
    for (const reference of ['https://example.com/photo.jpg', 'not-image', 'data:image/jpeg;base64,' + 'A'.repeat(900001)]) {
      assert.equal((await fetch(`${url}/compare`, { ...request, body: JSON.stringify({ reference, current: image }) })).status, 400);
    }
  });
});
test('valid request uses private key, two images, stateless structured output, then enforces cadence', async () => {
  let calls = 0;
  await withServer({ config, provider: async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal(body.input[0].content.filter(item => item.type === 'input_image').length, 2);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
  } }, async url => {
    const response = await fetch(`${url}/compare`, request); assert.equal(response.status, 200);
    assert.equal((await response.json()).action, 'matched');
    assert.equal((await fetch(`${url}/compare`, request)).status, 429); assert.equal(calls, 1);
  });
});
test('provider refusal and malformed output stay uncertain', async () => {
  for (const content of [[{ type: 'refusal', refusal: 'no' }], [{ type: 'output_text', text: '{broken' }]]) {
    await withServer({ config, provider: async () => Response.json({ status: 'completed', output: [{ content }] }) }, async url => {
      const response = await fetch(`${url}/compare`, request); assert.equal((await response.json()).action, 'uncertain');
    });
  }
});
test('provider errors are sanitized', async () => {
  await withServer({ config, provider: async () => new Response('private provider detail', { status: 401 }) }, async url => {
    const response = await fetch(`${url}/compare`, request); assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'API_KEY_REJECTED' });
  });
});
