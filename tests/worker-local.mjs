// Local test setup: a fake Open Food Facts server and the contribution worker served over HTTP.
// Used by tests/worker.test.mjs and tests/bad-off-e2e.js. Nothing here talks to the real Open Food Facts.
import http from 'node:http';
import worker from '../worker/contribute.js';

/* products: { [code]: { ingredients_text_bg?, selected_images? } } — calls are recorded in `log`. */
export function fakeOff(port, products) {
  const log = [];
  const toRequest = (req, body) => new Request('http://x' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined });
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://x'); const send = (o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const m = /^\/api\/v2\/product\/(\d+)\.json$/.exec(url.pathname);
    if (m) { log.push({ read: m[1] }); const p = products[m[1]]; return send(p ? { status: 1, product: Object.assign({ code: m[1] }, p) } : { status: 0 }); }
    if (req.method === 'POST' && /product_image_upload|product_jqm2/.test(url.pathname)) {
      const fd = await toRequest(req, body).formData(); const fields = {};
      for (const [k, v] of fd.entries()) fields[k] = typeof v === 'string' ? v : { file: v.name, type: v.type, size: v.size };
      log.push({ path: url.pathname, fields });
      if (url.pathname.includes('image_upload')) return send({ status: 'status ok', imagefield: fields.imagefield, imgid: 7 });
      if (!products[fields.code] && fields.product_name_bg) products[fields.code] = { product_name_bg: fields.product_name_bg, created: true };
      const p = products[fields.code]; if (p && fields.ingredients_text_bg) p.ingredients_text_bg = fields.ingredients_text_bg;
      return send({ status: 1, status_verbose: 'fields saved' });
    }
    send({ error: 'not found' }, 404);
  });
  return new Promise(ok => server.listen(port, () => ok({ server, log })));
}

/* The worker as a plain HTTP server (what Cloudflare runs). */
export function serveWorker(port, env) {
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = new Request('http://localhost:' + port + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const out = await worker.fetch(r, env);
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer()));
  });
  return new Promise(ok => server.listen(port, () => ok(server)));
}
