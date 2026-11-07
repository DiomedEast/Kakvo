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
 * - New products (mode=new), only if the barcode is NOT on Open Food Facts yet: name + front photo + ingredients photo
 *   are required; ingredient text and nutrition values (checked by the person in the app) are optional. Stricter limits.
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

/* A new product: a real name and only the nutrition numbers we know, in sensible ranges. */
const NUT_LIMITS = { kcal: 900, fat: 100, sat: 100, carbs: 100, sugar: 100, fibre: 100, protein: 100, salt: 100 };
export function checkNew(body) {
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 100 || !/\p{L}{2}/u.test(name) || /https?:|www\.|<|>/i.test(name)) return 'bad name';
  let nut = {};
  if (body.nut) { try { nut = JSON.parse(body.nut); } catch (e) { return 'bad nutrition'; } }
  if (typeof nut !== 'object' || Array.isArray(nut) || nut === null) return 'bad nutrition';
  for (const [k, v] of Object.entries(nut)) if (!(k in NUT_LIMITS) || typeof v !== 'number' || !(v >= 0 && v <= NUT_LIMITS[k])) return 'bad nutrition';
  if (nut.sat != null && nut.fat != null && nut.sat > nut.fat) return 'bad nutrition';
  if (nut.sugar != null && nut.carbs != null && nut.sugar > nut.carbs) return 'bad nutrition';
  return null;
}
const OFF_NUT = { kcal: ['energy-kcal', 'kcal'], fat: ['fat', 'g'], sat: ['saturated-fat', 'g'], carbs: ['carbohydrates', 'g'], sugar: ['sugars', 'g'], fibre: ['fiber', 'g'], protein: ['proteins', 'g'], salt: ['salt', 'g'] };

/* The photo is passed through untouched (no decoding: the free plan allows 10 ms of CPU per request). */
async function checkJpeg(file) {
  if (!file || typeof file === 'string' || file.size < 1000 || file.size > MAX_IMAGE_BYTES) return false;
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0xFF && head[1] === 0xD8;
}

/* Upload one photo; returns true if Open Food Facts accepted it. */
async function upload(base, headers, user, pass, code, app, field, file) {
  const fd = new FormData();
  fd.set('user_id', user); fd.set('password', pass); fd.set('code', code); fd.set('imagefield', field);
  Object.entries(app).forEach(([k, v]) => fd.set(k, v));
  fd.set('imgupload_' + field, new Blob([file], { type: 'image/jpeg' }), `kakvo-${code}-${field}.jpg`);
  const up = await fetch(`${base}/cgi/product_image_upload.pl`, { method: 'POST', body: fd, headers });
  const t = await up.text(); let b = null; try { b = JSON.parse(t); } catch (e) { /* not JSON */ }
  console.log('OFF photo', code, field, up.status, short(t));
  return up.ok && b && /^status ok$/i.test(b.status || '');
}

/* A product Open Food Facts does not have yet: create it with the name (and the checked text and numbers), then the photos. */
async function createProduct({ base, headers, app, user, pass, body, image, front, nutImg, testServer, cors }) {
  const code = body.code, nut = body.nut ? JSON.parse(body.nut) : {};
  const fd = new FormData();
  fd.set('user_id', user); fd.set('password', pass); fd.set('code', code);
  fd.set('lang', 'bg'); fd.set('product_name_bg', String(body.name).trim()); fd.set('add_countries', 'Bulgaria');
  if (body.text) fd.set('ingredients_text_bg', body.text.trim());
  const keys = Object.keys(nut).filter(k => OFF_NUT[k]);
  if (keys.length) { fd.set('nutrition_data_per', '100g'); keys.forEach(k => { fd.set('nutriment_' + OFF_NUT[k][0], String(nut[k])); fd.set('nutriment_' + OFF_NUT[k][0] + '_unit', OFF_NUT[k][1]); }); }
  fd.set('comment', 'Kakvo: new product from label photos, name, text and numbers checked by the user');
  Object.entries(app).forEach(([k, v]) => fd.set(k, v));
  const w = await fetch(`${base}/cgi/product_jqm2.pl`, { method: 'POST', body: fd, headers });
  const wText = await w.text(); let wb = null; try { wb = JSON.parse(wText); } catch (e) { /* not JSON */ }
  console.log('OFF new product', code, w.status, short(wText));
  if (!(w.ok && wb && wb.status === 1)) return json(502, { ok: false, error: 'open food facts refused the product', status: w.status }, cors);
  const photos = {
    front: await upload(base, headers, user, pass, code, app, 'front_bg', front),
    ingredients: await upload(base, headers, user, pass, code, app, 'ingredients_bg', image),
    nutrition: nutImg ? await upload(base, headers, user, pass, code, app, 'nutrition_bg', nutImg) : null
  };
  const ok = photos.front && photos.ingredients && photos.nutrition !== false;
  if (!ok) console.error('new product photos failed', code, JSON.stringify(photos));
  return json(ok ? 200 : 502, { ok, created: true, photos, text: body.text ? 'saved' : 'not sent', nutrition: keys.length, server: testServer ? 'test' : 'live' }, cors);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const c = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only' }, c.headers);
    if (!c.ok) return json(403, { ok: false, error: 'origin not allowed' });
    /* Pasted secrets often end with a space or line break: Open Food Facts then answers "Incorrect user name or password". */
    const user = String(env.OFF_USER || '').trim(), pass = String(env.OFF_PASSWORD || '').trim();
    if (!user || !pass) return json(503, { ok: false, error: 'not configured' }, c.headers);

    let form; try { form = await request.formData(); } catch (e) { return json(400, { ok: false, error: 'bad form' }, c.headers); }
    const body = { code: form.get('code'), text: form.get('text'), uuid: form.get('uuid'), mode: form.get('mode'), name: form.get('name'), nut: form.get('nut') }; const image = form.get('image');
    const isNew = body.mode === 'new';
    let bad = checkInput(body);
    /* New product: a text that does not look like a Bulgarian list is left out; the photo still goes. */
    if (bad && isNew && /text/.test(bad)) { body.text = ''; bad = checkInput(body); }
    if (bad) return json(400, { ok: false, error: bad }, c.headers);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (isNew) { const badNew = checkNew(body); if (badNew) return json(400, { ok: false, error: badNew }, c.headers); }
    if (!(await checkJpeg(image))) return json(400, { ok: false, error: 'image must be a JPEG under 3 MB' }, c.headers);
    const front = form.get('front'), nutImg = form.get('nutrition');
    if (isNew && !(await checkJpeg(front))) return json(400, { ok: false, error: 'front photo must be a JPEG under 3 MB' }, c.headers);
    if (isNew && nutImg && !(await checkJpeg(nutImg))) return json(400, { ok: false, error: 'nutrition photo must be a JPEG under 3 MB' }, c.headers);
    if (limited('u:' + body.uuid, 10, 3600e3) || limited('ip:' + ip, 30, 3600e3)) return json(429, { ok: false, error: 'too many' }, c.headers);
    if (isNew && (limited('new:u:' + body.uuid, 5, 86400e3) || limited('new:ip:' + ip, 15, 86400e3))) return json(429, { ok: false, error: 'too many new products' }, c.headers);

    const base = (env.OFF_BASE || 'https://world.openfoodfacts.net').replace(/\/$/, '');
    const testServer = /openfoodfacts\.net$/.test(new URL(base).hostname);
    const headers = { 'User-Agent': `Kakvo/${env.APP_VERSION || '0'} (github.com/DiomedEast/Kakvo)` };
    if (testServer) headers.Authorization = 'Basic ' + btoa('off:off'); // the test server is behind off/off
    const app = { app_name: 'Kakvo', app_version: env.APP_VERSION || '0', app_uuid: body.uuid };

    // 1. The product must exist; read what it already has.
    const r = await fetch(`${base}/api/v2/product/${body.code}.json?fields=code,ingredients_text_bg,selected_images`, { headers });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('OFF read failed', r.status, short(t)); return json(502, { ok: false, error: 'open food facts read failed', status: r.status }, c.headers); }
    const p = await r.json();
    const exists = p.status === 1 && !!p.product;
    if (isNew && exists) return json(409, { ok: false, error: 'product exists' }, c.headers); /* someone added it meanwhile: the app re-scans */
    if (isNew) return createProduct({ base, headers, app, user, pass, body, image, front, nutImg, testServer, cors: c.headers });
    if (!exists) return json(404, { ok: false, error: 'product not found' }, c.headers);
    const hasText = !!(p.product.ingredients_text_bg || '').trim();
    const sel = p.product.selected_images && p.product.selected_images.ingredients && p.product.selected_images.ingredients.display;
    const hasPhoto = !!(sel && sel.bg);

    // 2. The photo: proof for the text, and Open Food Facts reads it too.
    const field = hasPhoto ? 'other' : 'ingredients_bg';
    const fd = new FormData();
    fd.set('user_id', user); fd.set('password', pass); fd.set('code', body.code); fd.set('imagefield', field);
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
      f2.set('user_id', user); f2.set('password', pass); f2.set('code', body.code);
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
