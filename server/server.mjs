import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analysisSchema, compositionAdvice, instructions } from './composition.mjs';

const configPath = fileURLToPath(new URL('./.config.local.json', import.meta.url));
function readConfig() { try { return JSON.parse(readFileSync(configPath, 'utf8')); } catch { return {}; } }
export function ensureConfig() {
  const config = readConfig();
  if (!config.token) { config.token = randomBytes(32).toString('hex'); writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 }); }
  return config;
}
function send(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function readBody(req, limit) {
  let size = 0; const parts = [];
  for await (const part of req) { size += part.length; if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 }); parts.push(part); }
  return Buffer.concat(parts).toString('utf8');
}
function validImage(value) {
  if (typeof value !== 'string' || value.length > 900000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  return bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
}
function sameToken(actual, expected) {
  if (typeof actual !== 'string' || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createCoachServer({ config = readConfig, provider = fetch, now = Date.now } = {}) {
  let inFlight = false, lastStarted = -Infinity;
  let budgetStart = now(), requests = 0;
  return http.createServer(async (req, res) => {
    // This personal MVP serves native clients only; no browser CORS access.
    try {
      const settings = config();
      if (!sameToken(req.headers.authorization, `Bearer ${settings.token}`) || !settings.token) return send(res, 401, { error: 'PAIRING_REQUIRED' });
      const key = process.env.OPENAI_API_KEY || settings.apiKey;
      if (req.url === '/health' && req.method === 'GET') return send(res, 200, { ready: !!key });
      if (req.url !== '/compare' || req.method !== 'POST') return send(res, 404, { error: 'NOT_FOUND' });
      if (!key) return send(res, 503, { error: 'SETUP_REQUIRED' });
      if (req.headers['content-type'] !== 'application/json') return send(res, 415, { error: 'INVALID_REQUEST' });
      if (inFlight || now() - lastStarted < 4000) return send(res, 429, { error: 'SLOW_DOWN' });
      if (now() - budgetStart > 3600000) { budgetStart = now(); requests = 0; }
      if (requests >= 120) return send(res, 429, { error: 'HOURLY_LIMIT' });
      const body = JSON.parse(await readBody(req, 1900000));
      if (!body || typeof body !== 'object') return send(res, 400, { error: 'INVALID_IMAGES' });
      if (!validImage(body.reference) || !validImage(body.current)) return send(res, 400, { error: 'INVALID_IMAGES' });
      if (inFlight || now() - lastStarted < 4000) return send(res, 429, { error: 'SLOW_DOWN' });
      inFlight = true; lastStarted = now(); requests++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const abort = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', abort);
      try {
        const upstream = await provider('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', store: false,
            instructions, max_output_tokens: 400,
            input: [{ role: 'user', content: [
              { type: 'input_text', text: 'Desired reference placement:' }, { type: 'input_image', image_url: body.reference, detail: 'low' },
              { type: 'input_text', text: 'Current live framing:' }, { type: 'input_image', image_url: body.current, detail: 'low' },
            ] }], text: { format: { type: 'json_schema', name: 'composition', strict: true, schema: analysisSchema } },
          }),
        });
        if (!upstream.ok) return send(res, 502, { error: upstream.status === 401 ? 'API_KEY_REJECTED' : upstream.status === 429 ? 'PROVIDER_LIMIT' : 'AI_UNAVAILABLE' });
        const result = await upstream.json();
        const output = result.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
        if (result.status !== 'completed' || !output) return send(res, 200, compositionAdvice(null));
        let analysis; try { analysis = JSON.parse(output); } catch { analysis = null; }
        send(res, 200, compositionAdvice(analysis));
      } finally { clearTimeout(timer); res.off('close', abort); inFlight = false; }
    } catch (error) {
      if (!res.destroyed && !res.writableEnded) send(res, error.status || (error instanceof SyntaxError ? 400 : 502), { error: error.name === 'AbortError' ? 'TIMEOUT' : 'REQUEST_FAILED' });
    }
  });
}
function createSetupServer() {
  const nonce = randomBytes(24).toString('hex');
  return http.createServer(async (req, res) => {
    const host = '127.0.0.1:8788';
    if (req.headers.host !== host) return send(res, 403, { error: 'LOCAL_ONLY' });
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" });
      return res.end(`<!doctype html><html><meta name="viewport" content="width=device-width"><title>Malka · Connect live coach</title><style>body{font:18px system-ui;background:#f7f2eb;color:#292222;max-width:520px;margin:80px auto;padding:24px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:16px;margin:12px 0;border-radius:12px;border:1px solid #a89589}button{background:#e9ad98;cursor:pointer}p{line-height:1.5}small{color:#715d56}</style><h1>Malka live coach</h1><p>Connect your OpenAI API account to compare the reference with occasional live camera images.</p><p>${readConfig().apiKey || process.env.OPENAI_API_KEY ? 'An API key is configured. You can replace it below.' : 'An API key is needed before live coaching can start.'}</p><form method="post" action="/connect"><input type="hidden" name="nonce" value="${nonce}"><label for="key">OpenAI API key</label><input id="key" name="key" type="password" autocomplete="off" required placeholder="sk-…"><button>Connect coach</button></form><small>The key stays in a private file on this Mac and is never included in the iPhone app. API usage is billed to your OpenAI account. This setup page is accessible only on this Mac.</small><p><a href="https://platform.openai.com/api-keys">Create or manage an API key</a></p></html>`);
    }
    if (req.method !== 'POST' || req.url !== '/connect' || req.headers.origin !== `http://${host}`) return send(res, 403, { error: 'LOCAL_ONLY' });
    try {
      const form = new URLSearchParams(await readBody(req, 3000));
      const key = form.get('key')?.trim();
      if (form.get('nonce') !== nonce || !key || !/^sk-[A-Za-z0-9_-]{15,}$/.test(key)) return send(res, 400, { error: 'Enter a valid API key. It has not been saved.' });
      writeFileSync(configPath, JSON.stringify({ ...ensureConfig(), apiKey: key }), { mode: 0o600 });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<h1>Connected</h1><p>Return to Malka on your iPhone and tap Start AI coach. The first request will verify your API access.</p>');
    } catch { send(res, 400, { error: 'Could not save the key.' }); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureConfig();
  createCoachServer().listen(8787, '0.0.0.0', () => console.log('Malka private development coach is listening on port 8787.'));
  createSetupServer().listen(8788, '127.0.0.1', () => console.log('Private setup page: http://127.0.0.1:8788'));
}
