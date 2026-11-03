/* Kakvo → Open Food Facts contribution relay (Cloudflare Worker).
 *
 * Why a server: writing to Open Food Facts needs an account password, which must not be in the
 * public app code. The app sends a form { code, text, uuid, image (JPEG file) } here; this worker checks it and
 * forwards it to Open Food Facts with Kakvo's app account, as their API documentation asks:
 * one global app account + app_name / app_version / app_uuid on every write.
 *
 * Rules:
 * - Only existing products (the app only offers sharing after a barcode scan found the product).
 * - The photo is added as the Bulgarian ingredients photo, or as an extra photo if one is already selected.
 * - The Bulgarian ingredient text is written only if the product has none. Existing data is never replaced.
 * - Text may be empty: then only the photo is sent (the app does this when the text was not read clearly).
 *
 * Settings (wrangler.toml [vars] and secrets):
 *   OFF_BASE         https://world.openfoodfacts.net (test server, default) or https://world.openfoodfacts.org (live)
 *   OFF_USER         secret: the app account user name (not the e-mail)
 *   OFF_PASSWORD     secret: its password
 *   ALLOWED_ORIGINS  comma-separated, e.g. https://diomedeast.github.io
 *   APP_VERSION      shown to Open Food Facts moderators
 */

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const recent = new Map(); // best-effort limit per phone id and per IP, per worker instance

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return { ok, headers: ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {} };
}
/* Diagnostics in the Cloudflare log (Observability): what Open Food Facts answered. Never logs the password. */
const short = s => {
  let t = String(s || '');
  if (/<html|<!doctype/i.test(t)) { // an HTML error page: keep only the readable error text
    t = t.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
    t = t.replace(/\s+/g, ' ');
    const i = t.search(/error|invalid|incorrect|forbidden|not allowed|permission|log ?in|password|blocked|banned/i);
    return 'HTML: ' + t.slice(Math.max(0, i - 80), Math.max(0, i - 80) + 500).trim();
  }
  return t.replace(/\s+/g, ' ').slice(0, 400);
};
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });

function limited(key, max, ms) {
  const now = Date.now(); const list = (recent.get(key) || []).filter(t => now - t < ms);
  if (list.length >= max) return true;
  list.push(now); recent.set(key, list); return false;
}

/* What a real Bulgarian ingredient list looks like, roughly: mostly Cyrillic letters, a reasonable length. */
export function checkInput(body) {
  if (!body || typeof body !== 'object') return 'bad body';
  const { code, text, uuid } = body;
  if (typeof code !== 'string' || !/^\d{8,14}$/.test(code)) return 'bad code';
  if (typeof uuid !== 'string' || !/^[0-9a-f-]{36}$/i.test(uuid)) return 'bad uuid';
  if (typeof text !== 'string' || text.length > 3000) return 'bad text length';
  if (text === '') return null; // photo only
  if (text.length < 10) return 'bad text length';
  const letters = text.replace(/[^\p{L}]/gu, ''); const cyr = text.replace(/[^Ѐ-ӿ]/g, '');
  if (letters.length < 10 || cyr.length / letters.length < 0.6) return 'text is not Bulgarian';
  return null;
}

/* The photo is passed through untouched (no decoding: the free plan allows 10 ms of CPU per request). */
async function checkJpeg(file) {
  if (!file || typeof file === 'string' || file.size < 1000 || file.size > MAX_IMAGE_BYTES) return false;
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0xFF && head[1] === 0xD8;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const c = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only' }, c.headers);
    if (!c.ok) return json(403, { ok: false, error: 'origin not allowed' });
    if (!env.OFF_USER || !env.OFF_PASSWORD) return json(503, { ok: false, error: 'not configured' }, c.headers);

    let form; try { form = await request.formData(); } catch (e) { return json(400, { ok: false, error: 'bad form' }, c.headers); }
    const body = { code: form.get('code'), text: form.get('text'), uuid: form.get('uuid') }; const image = form.get('image');
    const bad = checkInput(body); if (bad) return json(400, { ok: false, error: bad }, c.headers);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (limited('u:' + body.uuid, 10, 3600e3) || limited('ip:' + ip, 30, 3600e3)) return json(429, { ok: false, error: 'too many' }, c.headers);
    if (!(await checkJpeg(image))) return json(400, { ok: false, error: 'image must be a JPEG under 3 MB' }, c.headers);

    const base = (env.OFF_BASE || 'https://world.openfoodfacts.net').replace(/\/$/, '');
    const testServer = /openfoodfacts\.net$/.test(new URL(base).hostname);
    const headers = { 'User-Agent': `Kakvo/${env.APP_VERSION || '0'} (github.com/DiomedEast/Kakvo)` };
    if (testServer) headers.Authorization = 'Basic ' + btoa('off:off'); // the test server is behind off/off
    const app = { app_name: 'Kakvo', app_version: env.APP_VERSION || '0', app_uuid: body.uuid };

    // 1. The product must exist; read what it already has.
    const r = await fetch(`${base}/api/v2/product/${body.code}.json?fields=code,ingredients_text_bg,selected_images`, { headers });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('OFF read failed', r.status, short(t)); return json(502, { ok: false, error: 'open food facts read failed', status: r.status }, c.headers); }
    const p = await r.json();
    if (p.status !== 1 || !p.product) return json(404, { ok: false, error: 'product not found' }, c.headers);
    const hasText = !!(p.product.ingredients_text_bg || '').trim();
    const sel = p.product.selected_images && p.product.selected_images.ingredients && p.product.selected_images.ingredients.display;
    const hasPhoto = !!(sel && sel.bg);

    // 2. The photo: proof for the text, and Open Food Facts reads it too.
    const field = hasPhoto ? 'other' : 'ingredients_bg';
    const fd = new FormData();
    fd.set('user_id', env.OFF_USER); fd.set('password', env.OFF_PASSWORD); fd.set('code', body.code); fd.set('imagefield', field);
    Object.entries(app).forEach(([k, v]) => fd.set(k, v));
    fd.set('imgupload_' + field, new Blob([image], { type: 'image/jpeg' }), `kakvo-${body.code}-ingredients.jpg`);
    const up = await fetch(`${base}/cgi/product_image_upload.pl`, { method: 'POST', body: fd, headers });
    const upText = await up.text(); let upBody = null; try { upBody = JSON.parse(upText); } catch (e) { /* not JSON */ }
    const photo = up.ok && upBody && /^status ok$/i.test(upBody.status || '') ? field : 'failed (' + up.status + ')';
    console.log('OFF photo', body.code, field, up.status, short(upText));

    // 3. The text, only if the product has none.
    let text = body.text ? 'kept existing' : 'not sent';
    if (!hasText && body.text) {
      const f2 = new FormData();
      f2.set('user_id', env.OFF_USER); f2.set('password', env.OFF_PASSWORD); f2.set('code', body.code);
      f2.set('ingredients_text_bg', body.text.trim());
      f2.set('comment', 'Kakvo: Bulgarian ingredients read from a label photo and checked by the user');
      Object.entries(app).forEach(([k, v]) => f2.set(k, v));
      const w = await fetch(`${base}/cgi/product_jqm2.pl`, { method: 'POST', body: f2, headers });
      const wText = await w.text(); let wb = null; try { wb = JSON.parse(wText); } catch (e) { /* not JSON */ }
      text = w.ok && wb && wb.status === 1 ? 'saved' : 'failed (' + w.status + ')';
      console.log('OFF text', body.code, w.status, short(wText));
    }
    const ok = photo === field && !text.startsWith('failed');
    if (!ok) console.error('contribution failed', body.code, JSON.stringify({ photo, text }));
    return json(ok ? 200 : 502, { ok, photo, text, server: testServer ? 'test' : 'live' }, c.headers);
  }
};
