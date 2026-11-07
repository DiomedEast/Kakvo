// Run: node tests/worker.test.mjs — checks the contribution worker against a fake Open Food Facts.
import assert from 'node:assert';
import fs from 'node:fs';
import worker, { checkInput, checkNew } from '../worker/contribute.js';
import { fakeOff } from './worker-local.mjs';

const products = {
  '4056489999990': {},                                                                   // no Bulgarian list, no photo
  '4056489999991': { ingredients_text_bg: 'брашно, захар', selected_images: { ingredients: { display: { bg: 'x.jpg' } } } }
};
const { server, log } = await fakeOff(8790, products);
const env = { OFF_BASE: 'http://localhost:8790', OFF_USER: 'kakvo-app', OFF_PASSWORD: 'secret', ALLOWED_ORIGINS: 'https://diomedeast.github.io', APP_VERSION: '0.2.0' };
const image = new Blob([fs.readFileSync(new URL('./photos/sondey-biscuits-ingredients.jpg', import.meta.url))], { type: 'image/jpeg' });
const text = 'пшенично брашно, захар, растителни масла (от палма, соя), какао на прах, емулгатор: лецитини (соеви)';
const uuid = '3f1c2b9e-1111-4a2b-9c3d-123456789abc';
const call = (body, origin = 'https://diomedeast.github.io') => { const fd = new FormData(); Object.entries(body).forEach(([k, v]) => fd.set(k, v)); return worker.fetch(new Request('https://w/', { method: 'POST', headers: { Origin: origin }, body: fd }), env); };
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

await t('new Bulgarian list: photo selected as ingredients_bg and text saved, with app name and phone id', async () => {
  const r = await call({ code: '4056489999990', text, image, uuid }); const b = await r.json();
  assert.strictEqual(r.status, 200, JSON.stringify(b)); assert.deepStrictEqual([b.photo, b.text], ['ingredients_bg', 'saved']);
  const up = log.find(x => x.path && x.path.includes('image_upload') && x.fields.code === '4056489999990');
  assert.strictEqual(up.fields.imagefield, 'ingredients_bg'); assert.strictEqual(up.fields.imgupload_ingredients_bg.type, 'image/jpeg');
  assert.strictEqual(up.fields.user_id, 'kakvo-app'); assert.strictEqual(up.fields.app_name, 'Kakvo'); assert.strictEqual(up.fields.app_uuid, uuid);
  assert.strictEqual(products['4056489999990'].ingredients_text_bg, text);
});
await t('existing list and photo are never replaced: extra photo only', async () => {
  const before = log.length;
  const r = await call({ code: '4056489999991', text, image, uuid }); const b = await r.json();
  assert.deepStrictEqual([b.photo, b.text], ['other', 'kept existing']);
  assert.ok(!log.slice(before).some(x => x.path && x.path.includes('jqm2')));
  assert.strictEqual(products['4056489999991'].ingredients_text_bg, 'брашно, захар');
});
await t('refuses other websites, non-Bulgarian text, unknown products, non-JPEG', async () => {
  assert.strictEqual((await call({ code: '4056489999990', text, image, uuid }, 'https://evil.example')).status, 403);
  assert.strictEqual((await call({ code: '4056489999990', text: 'farine de blé, sucre, sel de table', image, uuid })).status, 400);
  assert.strictEqual((await call({ code: '1234567890123', text, image, uuid })).status, 404);
  assert.strictEqual((await call({ code: '4056489999990', text, image: new Blob(['x'.repeat(2000)], { type: 'image/jpeg' }), uuid })).status, 400);
  assert.strictEqual(checkInput({ code: '12', text, image, uuid }), 'bad code');
});
await t('photo only (text not clear enough): photo sent, text untouched', async () => {
  products['4056489999992'] = {}; const before = log.length;
  const r = await call({ code: '4056489999992', text: '', image, uuid: '3f1c2b9e-2222-4a2b-9c3d-123456789abc' }); const b = await r.json();
  assert.deepStrictEqual([r.status, b.photo, b.text], [200, 'ingredients_bg', 'not sent']);
  assert.ok(!log.slice(before).some(x => x.path && x.path.includes('jqm2'))); assert.ok(!products['4056489999992'].ingredients_text_bg);
});
await t('password never appears in a response', async () => {
  const r = await call({ code: '4056489999990', text, image, uuid }); assert.ok(!(await r.text()).includes('secret'));
});
await t('CORS preflight only for the app', async () => {
  const ok = await worker.fetch(new Request('https://w/', { method: 'OPTIONS', headers: { Origin: 'https://diomedeast.github.io' } }), env);
  assert.strictEqual(ok.headers.get('Access-Control-Allow-Origin'), 'https://diomedeast.github.io');
  const no = await worker.fetch(new Request('https://w/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.strictEqual(no.status, 403);
});
const front = image; const nutrition = image;
await t('new product: created with name, checked text and numbers, then front, ingredients and table photos', async () => {
  const before = log.length; const nut = { kcal: 432.7, fat: 17.5, sat: 8.9, carbs: 64.7, sugar: 32.8, protein: 4.1, salt: 0.1 };
  const r = await call({ mode: 'new', code: '3800000000017', name: 'Насладки с мармалад от смокини', text, nut: JSON.stringify(nut), image, front, nutrition, uuid: '3f1c2b9e-3333-4a2b-9c3d-123456789abc' }); const b = await r.json();
  assert.strictEqual(r.status, 200, JSON.stringify(b)); assert.ok(b.created && b.photos.front && b.photos.ingredients && b.photos.nutrition);
  const w = log.slice(before).find(x => x.path && x.path.includes('jqm2'));
  assert.strictEqual(w.fields.product_name_bg, 'Насладки с мармалад от смокини'); assert.strictEqual(w.fields.lang, 'bg'); assert.strictEqual(w.fields.add_countries, 'Bulgaria');
  assert.strictEqual(w.fields['nutriment_energy-kcal'], '432.7'); assert.strictEqual(w.fields['nutriment_energy-kcal_unit'], 'kcal');
  assert.strictEqual(w.fields['nutriment_saturated-fat'], '8.9'); assert.strictEqual(w.fields.nutrition_data_per, '100g'); assert.strictEqual(w.fields.app_name, 'Kakvo');
  const fields = log.slice(before).filter(x => x.path && x.path.includes('image_upload')).map(x => x.fields.imagefield);
  assert.deepStrictEqual(fields, ['front_bg', 'ingredients_bg', 'nutrition_bg']);
  assert.strictEqual(products['3800000000017'].ingredients_text_bg, text);
});
await t('new product refused if it already exists (never overwritten), or without name or front photo, or with impossible numbers', async () => {
  const u = '3f1c2b9e-4444-4a2b-9c3d-123456789abc';
  assert.strictEqual((await call({ mode: 'new', code: '4056489999990', name: 'Бисквити', text: '', image, front, uuid: u })).status, 409);
  assert.strictEqual((await call({ mode: 'new', code: '3800000000024', name: '', text: '', image, front, uuid: u })).status, 400);
  assert.strictEqual((await call({ mode: 'new', code: '3800000000024', name: 'Бисквити', text: '', image, uuid: u })).status, 400);
  assert.strictEqual((await call({ mode: 'new', code: '3800000000024', name: 'Бисквити', text: '', nut: '{"sat":9,"fat":2}', image, front, uuid: u })).status, 400);
  assert.strictEqual(checkNew({ name: 'виж www.example.com' }), 'bad name');
  assert.ok(!products['3800000000024']);
});
await t('new product: at most 5 per phone per day', async () => {
  const u = '3f1c2b9e-5555-4a2b-9c3d-123456789abc'; const st = [];
  for (let i = 0; i < 6; i++) st.push((await call({ mode: 'new', code: '38000000001' + (10 + i), name: 'Продукт ' + i, text: '', image, front, uuid: u })).status);
  assert.deepStrictEqual(st, [200, 200, 200, 200, 200, 429]);
});
server.close(); console.log(n + ' worker tests passed');
