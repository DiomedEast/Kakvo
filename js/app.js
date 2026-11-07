/* Kakvo web app. Plain JavaScript, no build step. Routes live in the URL hash. */
(function () {
  'use strict';
  const CFG = window.KAKVO_CONFIG || {};
  const app = document.getElementById('app');
  let DB = null, E = null;

  /* ---------- small helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('kakvo_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kakvo_' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const session = {
    get(k) { try { return JSON.parse(sessionStorage.getItem('kakvo_' + k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem('kakvo_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  const fmt = n => String(n > 0 && n < 1 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10).replace('.', ',');
  const go = h => { location.hash = h; };

  /* Supporter status. Payments are not live yet: SUPPORT_URL in config.js turns them on.
     Until then ?supporter=1 in the URL previews the paid features on this device only. */
  if (/[?&]supporter=1/.test(location.search)) store.set('supporter', true);
  if (/[?&]supporter=0/.test(location.search)) store.set('supporter', false);
  const isSupporter = () => store.get('supporter', false) === true;

  const IC = {
    back: '<path d="M15 5l-7 7 7 7"/>', share: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', chev: '<path d="M9 5l7 7-7 7"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', story: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>', check: '<path d="M7 12.5l3.2 3.2L17 9"/>'
  };
  const icon = (n, s = 20, sw = 2.3) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const LOGO = '<a class="logo" href="#/">Kakvo<i>.</i></a>';
  const LEAF = '<svg class="leaf" width="170" height="170" viewBox="0 0 170 170" aria-hidden="true"><path d="M150 20C70 20 20 70 20 150c80 0 130-50 130-130z" fill="#2F7D36"/><path d="M30 140L140 30" stroke="#246B2A" stroke-width="6" stroke-linecap="round"/></svg>';
  const SUP = `<span class="sup">${icon('lock', 11, 2.6)}Подкрепа</span>`;
  const CUBE = w => `<svg width="${w}" height="${Math.round(w * 1.04)}" viewBox="0 0 50 52" aria-hidden="true"><path d="M25 4L46 15 25 26 4 15z" fill="#FFFFFF" stroke="#C9B9A6" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 15L25 26V48L4 37z" fill="#EFE6DA" stroke="#C9B9A6" stroke-width="1.6" stroke-linejoin="round"/><path d="M46 15L25 26V48L46 37z" fill="#DDCFBE" stroke="#C9B9A6" stroke-width="1.6" stroke-linejoin="round"/><circle cx="20" cy="14" r="1.1" fill="#D8CBBB"/><circle cx="29" cy="12" r="1" fill="#D8CBBB"/><circle cx="27" cy="18" r="1.1" fill="#D8CBBB"/><circle cx="12" cy="30" r="1" fill="#D2C3B0"/><circle cx="17" cy="38" r="1.1" fill="#D2C3B0"/><circle cx="36" cy="31" r="1" fill="#C6B5A0"/><circle cx="34" cy="40" r="1.1" fill="#C6B5A0"/></svg>`;
  function cubesHtml(n, w = 44, max = 12) {
    const whole = Math.floor(Math.min(n, max)); const half = n % 1 && n < max;
    const halfCube = `<span style="display:inline-block;width:${w / 2}px;overflow:hidden">${CUBE(w)}</span>`;
    return `<div class="cubes" aria-hidden="true">${CUBE(w).repeat(whole)}${half ? halfCube : ''}${n > max ? `<span class="more">+${fmt(n - max)}</span>` : ''}</div>`;
  }
  const FOOT = (code) => `<div class="foot">Данни: <a href="${code ? 'https://world.openfoodfacts.org/product/' + esc(code) : 'https://world.openfoodfacts.org'}" target="_blank" rel="noopener">Open Food Facts</a> (лиценз ODbL)${code ? ' · <a href="https://world.openfoodfacts.org/product/' + esc(code) + '" target="_blank" rel="noopener">Поправи данните</a>' : ''}. Kakvo обяснява, не лекува. Информацията не е медицински съвет. При алергия винаги чети етикета.</div>`;
  const srcLinks = list => `<div class="src">Източник: ${list.map(s => `<a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join(' · ')}</div>`;
  const flagHtml = f => `<div class="flag ${f.level === 'warn' ? 'warn' : ''}"><h3>${esc(f.title)}${f.codes && f.codes.length > 1 ? ' (' + f.codes.join(', ') + ')' : ''}</h3><p>${esc(f.text)}</p>${srcLinks(f.src)}</div>`;

  function setDark(on) { document.body.classList.toggle('dark', !!on); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = on ? '#0E1411' : '#246B2A'; }
  function view(html, dark) { stopCamera(); setDark(dark); app.innerHTML = html; window.scrollTo(0, 0); }

  /* ---------- data ---------- */
  const OFF_FIELDS = 'code,product_name,product_name_bg,brands,quantity,ingredients_text_bg,ingredients_text_en,ingredients_text_fr,ingredients,additives_tags,nutriments,serving_quantity,serving_size,categories_tags,image_front_small_url,allergens_tags,traces_tags';
  async function fetchProduct(code) {
    const cached = session.get('p_' + code); if (cached) return cached;
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}&app_name=Kakvo&app_version=${encodeURIComponent(CFG.VERSION || '0.1')}`;
    const r = await fetch(url, { headers: { 'X-User-Agent': `Kakvo/${CFG.VERSION || '0.1'} (${CFG.CONTACT || 'kakvo'})` } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j || j.status === 0 || !j.product) return null;
    session.set('p_' + code, j.product);
    return j.product;
  }
  const ALLERGEN_BG = { 'en:gluten': 'глутен', 'en:milk': 'мляко', 'en:eggs': 'яйца', 'en:nuts': 'ядки', 'en:peanuts': 'фъстъци', 'en:soybeans': 'соя', 'en:sesame-seeds': 'сусам', 'en:mustard': 'синап', 'en:celery': 'целина', 'en:fish': 'риба', 'en:crustaceans': 'ракообразни', 'en:molluscs': 'мекотели', 'en:lupin': 'лупина', 'en:sulphur-dioxide-and-sulphites': 'сулфити' };
  const allergens = tags => (tags || []).map(t => ALLERGEN_BG[t]).filter(Boolean);
  const isDrink = p => (p.categories_tags || []).includes('en:beverages');
  function nutOf(p) {
    const n = p.nutriments || {}; const num = v => (v === '' || v == null || !isFinite(+v)) ? null : +v;
    return { sugar: num(n.sugars_100g), sat: num(n['saturated-fat_100g']), salt: num(n.salt_100g) };
  }

  /* ---------- history & profiles ---------- */
  const FREE_HISTORY = 20;
  /* Ingredient text the person photographed for a barcode, kept on this phone (last 50 products). */
  const savedLabel = code => (store.get('labels', {})[code] || null);
  function saveLabel(code, text, nut, kind) {
    const all = store.get('labels', {}); all[code] = { t: text, at: Date.now(), nut: nut && Object.values(nut).some(v => v != null) ? nut : null, kind };
    const keep = Object.keys(all).sort((x, y) => all[y].at - all[x].at).slice(0, 50);
    store.set('labels', Object.fromEntries(keep.map(k => [k, all[k]])));
  }
  /* ---------- sharing with Open Food Facts (through worker/contribute.js) ---------- */
  const deviceId = () => { let id = store.get('uuid', null); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => ((Math.random() * 16 | 0) & (ch === 'x' ? 15 : 3 | 8)).toString(16))); store.set('uuid', id); } return id; };
  const canShare = () => !!CFG.CONTRIBUTE_URL;
  /* The framed part of the label photo, as a JPEG Open Food Facts accepts (at least 640×160, at most 2000 px wide). */
  function labelJpeg(src, box) {
    let b = box ? Object.assign({}, box) : { x: 0, y: 0, w: src.width, h: src.height };
    const pad = Math.round(Math.max(b.w, b.h) * 0.03); b = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
    if (b.w < 640) { b.x -= (640 - b.w) / 2; b.w = 640; } if (b.h < 160) { b.y -= (160 - b.h) / 2; b.h = 160; }
    b.x = Math.max(0, Math.round(b.x)); b.y = Math.max(0, Math.round(b.y)); b.w = Math.min(src.width - b.x, Math.round(b.w)); b.h = Math.min(src.height - b.y, Math.round(b.h));
    const sc = Math.min(1, 2000 / b.w); const c = document.createElement('canvas'); c.width = Math.round(b.w * sc); c.height = Math.round(b.h * sc);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
    if (c.width < 640 || c.height < 160) return null;
    return c.toDataURL('image/jpeg', 0.88).split(',')[1];
  }
  /* The camera reads the label's footnote stars as quote marks ("палма”"); don't send those to the shared database. */
  /* Only the ingredient list itself: stop before footnotes, "may contain" and best-before lines. */
  const OFF_END = /(^|[.;\s])[*”“"'„-]*\s*(сертифицира|яйца от кокошки|от устойчиво|може да съдържа|може да има следи|неотворен|годен за|партида|произход на|да се съхранява)/i;
  const cutForOff = s => { const m = OFF_END.exec(s); return (m ? s.slice(0, m.index + m[1].length) : s).replace(/[\s,;:]+$/, '').replace(/([^.])$/, '$1.'); };
  /* The text is shared only when it was read clearly or the person corrected it; otherwise only the photo goes. */
  function offText(d, sh) {
    const text = cleanForOff(cutForOff(d.text));
    if (sh.original != null && d.text.trim() !== sh.original.trim()) return text;
    const unsure = (sh.unsure || []).filter(w => w.length > 1 && text.includes(w.replace(/[.,:;]+$/, ''))).length;
    return unsure <= 2 ? text : '';
  }
  const cleanForOff = s => s.replace(/(\p{L})[”“"]+/gu, '$1').replace(/(^|[\s.;])[”“"]+(?=\p{L})/gu, '$1').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
  async function sendContribution(item) {
    const fd = new FormData(); fd.set('code', item.code); fd.set('text', item.text); fd.set('uuid', item.uuid);
    fd.set('image', await (await fetch('data:image/jpeg;base64,' + item.image)).blob(), 'ingredients.jpg');
    const r = await fetch(CFG.CONTRIBUTE_URL, { method: 'POST', body: fd });
    const b = await r.json().catch(() => ({}));
    if (r.ok && b.ok) return 'ok';
    item.lastError = r.status + (b.error ? ' ' + b.error : '') + (b.photo ? ' photo:' + b.photo : '') + (b.text ? ' text:' + b.text : '');
    return r.status === 400 || r.status === 404 ? 'drop' : 'retry';
  }
  /* Send now; if offline or the server is busy, keep it (max 5) and try again on the next start. */
  async function contribute(item) {
    try {
      const res = await sendContribution(item);
      if (res === 'ok') return toast(item.text ? 'Благодарим! Съставът вече е в Open Food Facts и ще помогне и на другите.' : 'Благодарим! Снимката на състава е изпратена в Open Food Facts.');
      toast('Не успяхме да изпратим снимката (' + (item.lastError || 'грешка') + '). Ще опитаме пак по-късно.');
      if (res === 'retry') queue(item);
    } catch (e) { toast('Няма връзка със сървъра за споделяне. Ще опитаме пак по-късно.'); queue(item); }
  }
  function queue(item) { const q = store.get('outbox', []).filter(x => x.code !== item.code); q.push(item); try { store.set('outbox', q.slice(-5)); } catch (e) { /* storage full */ } }
  async function flushOutbox() {
    if (!canShare()) return; const q = store.get('outbox', []); if (!q.length) return;
    const left = [];
    for (const item of q) { try { const r = await sendContribution(item); if (r === 'retry') left.push(item); } catch (e) { left.push(item); } }
    store.set('outbox', left);
  }

  const photoFor = () => { const pf = session.get('photoFor'); return pf && Date.now() - pf.at < 3600e3 ? pf : null; };

  function remember(item) {
    let h = store.get('history', []).filter(x => x.key !== item.key);
    h.unshift(Object.assign({ ts: Date.now() }, item));
    h = h.slice(0, isSupporter() ? 500 : FREE_HISTORY);
    store.set('history', h);
  }
  const profiles = () => store.get('profiles', [{ id: 'me', name: 'Аз', kid: false, avoid: [] }]);
  const activeProfile = () => { const ps = profiles(); return ps.find(p => p.id === store.get('activeProfile', 'me')) || ps[0]; };

  /* ---------- product rendering (shared by barcode and text results) ---------- */
  function tilesHtml(nut, kind, fromText) {
    const unit = kind === 'drink' ? 'мл' : 'г';
    const rows = [['sugar', 'Захари'], ['sat', 'Наситени'], ['salt', 'Сол']];
    if (rows.every(([k]) => nut[k] == null)) return `<div class="note">Няма данни за хранителната стойност. ${fromText ? '<a href="#/photo?m=nut&pair=t">Снимай таблицата с хранителни стойности</a>, за да видиш бучките захар.' : 'Можеш да ги добавиш в Open Food Facts от линка най-долу.'}</div>`;
    return '<div class="tiles">' + rows.map(([k, name]) => {
      const v = nut[k]; const lv = E.level(kind, k, v);
      return `<div class="tile lv-${lv || 'none'}"><span class="k">${name}</span><span class="v">${v == null ? '–' : fmt(v) + ' г'}</span><span class="bar"></span><span class="lv">${lv ? E.LEVEL_WORD[lv] : 'няма данни'}</span></div>`;
    }).join('') + `</div><div class="src" style="margin-top:-8px">На 100 ${unit}. Оценка по <a href="${E.SRC.fsa.u}" target="_blank" rel="noopener">британските критерии за цветно етикетиране</a>.</div>`;
  }

  function sugarHtml(nut, kind, serving) {
    if (nut.sugar == null) return '';
    const c = E.cubes(nut.sugar); const unit = kind === 'drink' ? 'мл' : 'г';
    let portion = '';
    if (serving && serving > 0 && serving !== 100) {
      const ps = nut.sugar * serving / 100;
      portion = `<div class="split"><span><span style="display:block;font-size:13px;color:var(--org);font-weight:700">В 1 порция (${fmt(serving)} ${unit})</span>` +
        (isSupporter() ? `<span style="font-family:var(--display);font-weight:800;font-size:20px">≈ ${fmt(E.cubes(ps))} ${E.cubes(ps) === 1 ? 'бучка' : 'бучки'} (${fmt(ps)} г)</span>` : `<span style="font-size:14px;color:var(--muted)">Виж колко захар има в една порция</span>`) +
        `</span>${isSupporter() ? '' : `<a href="#/support" style="text-decoration:none">${SUP}</a>`}</div>`;
    }
    return `<div class="sugar"><div class="top"><b>Захар в 100 ${unit}</b><span>1 бучка ≈ 4 г</span></div>${cubesHtml(c)}<span class="big">≈ ${fmt(c)} ${c === 1 ? 'бучка' : 'бучки'} захар</span>${portion}</div>`;
  }

  function calcHtml(nut, kind) {
    if (nut.sugar == null && nut.sat == null) return '';
    const unit = kind === 'drink' ? 'мл' : 'г';
    if (!isSupporter()) return `<a class="card" href="#/support" style="text-decoration:none;color:var(--ink)"><h2>Колко изяде? ${SUP}</h2><span style="font-size:15px;color:var(--muted)">Напиши колко ${kind === 'drink' ? 'изпи' : 'изяде'} и виж захарта и наситените мазнини за точното количество.</span></a>`;
    return `<div class="card"><h2>Колко ${kind === 'drink' ? 'изпи' : 'изяде'}?</h2>
      <div class="field"><label for="amt">Количество в ${unit}</label><input id="amt" inputmode="decimal" placeholder="напр. 48" data-sugar="${nut.sugar ?? ''}" data-sat="${nut.sat ?? ''}"></div>
      <div class="grid2"><div class="calcbox" style="background:var(--orgbg)"><span style="font-size:13px;color:var(--org);font-weight:700">Захар</span><b id="c-sugar">–</b><span id="c-cubes" style="font-size:13px;color:var(--org)"></span></div>
      <div class="calcbox" style="background:var(--redbg)"><span style="font-size:13px;color:var(--red);font-weight:700">Наситени мазнини</span><b id="c-sat">–</b></div></div></div>`;
  }
  function wireCalc() {
    const el = document.getElementById('amt'); if (!el) return;
    el.addEventListener('input', () => {
      const g = parseFloat(el.value.replace(',', '.'));
      const s = parseFloat(el.dataset.sugar), f = parseFloat(el.dataset.sat);
      const ok = isFinite(g) && g > 0;
      document.getElementById('c-sugar').textContent = ok && isFinite(s) ? fmt(s * g / 100) + ' г' : '–';
      document.getElementById('c-cubes').textContent = ok && isFinite(s) ? '≈ ' + fmt(E.cubes(s * g / 100)) + ' бучки' : '';
      document.getElementById('c-sat').textContent = ok && isFinite(f) ? fmt(f * g / 100) + ' г' : '–';
    });
  }

  function groupsHtml(res) {
    const LABEL = { grain: 'Зърно', sugar: 'Захари', fat: 'Мазнини', palm: 'Мазнини', trans: 'Мазнини', cocoa: 'Какао', dairy: 'Мляко', other: 'Други' };
    const groups = {};
    for (const x of res.ing.values()) { const g = x.g === 'palm' || x.g === 'trans' ? 'fat' : x.g; (groups[g] = groups[g] || []).push(E.ingredientInfo(x.t).name); }
    const order = ['grain', 'sugar', 'fat', 'cocoa', 'dairy', 'other'];
    const chips = order.filter(g => groups[g]).map(g => `<span class="chip g-${g}"><span class="dot"></span>${LABEL[g]}: ${esc(groups[g].slice(0, 4).join(', '))}${groups[g].length > 4 ? ' и още ' + (groups[g].length - 4) : ''}</span>`).join('');
    const unk = res.unk.length ? `<span class="chip g-unk">Още ${res.unk.length} без обяснение</span>` : '';
    return chips || unk ? `<div style="display:flex;flex-direction:column;gap:10px"><h2>Съставът по групи</h2><div class="chips">${chips}${unk}</div></div>` : '';
  }

  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const firstSentence = s => (s || '').split(/(?<=[.!?])\s+(?=[А-ЯA-Z„])/)[0];
  const roleLine = a => a.roles[0] ? (a.roles[0].split(':').slice(1).join(':').trim() || a.roles[0]) : (a.known ? 'Ролята ѝ още не е описана в Kakvo.' : 'Тази добавка още не е в нашата база.');

  /* Every ingredient and additive in label order, each with one plain line; tap for the full explanation. */
  function itemsHtml(res, back) {
    const list = E.items(res);
    if (!list.length) return '';
    const from = encodeURIComponent(back || '#/');
    const rows = list.map(x => {
      if (x.k === 'unk') return `<div class="addrow unk"><span class="code">?</span><span><b>${esc(cap(x.name))}</b><small>Още нямаме обяснение за тази съставка.</small></span><span></span></div>`;
      const al = (x.allergen ? `<small class="al">Алерген: ${esc(x.allergen)}</small>` : '') + (x.label ? `<small class="lab">✱ ${esc(x.label)}</small>` : '') + (x.of ? `<small>Част от „растителни масла“</small>` : '');
      const lq = x.label ? '&l=' + encodeURIComponent(x.label) : '';
      if (x.k === 'add') {
        const c = x.code;
        return `<a class="addrow ${x.flag && x.flag.level === 'warn' ? 'warn' : ''}" href="#/a/${encodeURIComponent(c)}?from=${from}${x.ctx ? '&c=' + encodeURIComponent(x.ctx) : ''}${lq}"><span class="code">${c === 'E14X' ? 'E14xx' : c}</span><span><b>${esc(cap(x.name))}</b><small>${esc(cap(roleLine(x)))}</small>${al}</span>${icon('chev', 18, 2)}</a>`;
      }
      return `<a class="addrow" href="#/i/${encodeURIComponent(x.t)}?from=${from}${lq}"><span class="code grp g-${x.g}">${esc(x.group)}</span><span><b>${esc(cap(x.name))}</b><small>${esc(x.what ? firstSentence(x.what) : 'Още нямаме подробно обяснение.')}</small>${al}</span>${icon('chev', 18, 2)}</a>`;
    }).join('');
    const als = E.allergens(res);
    const alNote = als.length ? `<div class="note">Разпознахме алергени: <b>${esc(als.join(', '))}</b>. На етикета те трябва да са откроени, например с удебелен шрифт. При алергия винаги проверявай етикета.</div>` : '';
    const notes = (res.labelNotes || []).map(n => { const g = E.glossFor(n); return `<div class="flag info"><h3>Етикетът пише: „${esc(n)}“</h3>${g ? `<p>${esc(g.text)}</p>${g.src.length ? srcLinks(g.src) : ''}` : ''}</div>`; }).join('');
    return `<div style="display:flex;flex-direction:column;gap:6px"><h2>Какво ядеш: съставка по съставка</h2>
      <span style="font-size:14px;color:var(--muted)">По реда на етикета: първата съставка е най-много. Докосни, за да видиш повече.</span>${alNote}<div style="display:flex;flex-direction:column">${rows}</div>${notes ? '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">' + notes + '</div>' : ''}</div>`;
  }

  function labelHtml(text, res) {
    if (!text) return '';
    let html = '', pos = 0;
    for (const s of res.spans.slice().sort((a, b) => a.start - b.start)) { html += esc(text.slice(pos, s.start)) + `<span class="k-${s.kind}">${esc(text.slice(s.start, s.end))}</span>`; pos = s.end; }
    html += esc(text.slice(pos));
    return `<div style="display:flex;flex-direction:column;gap:10px"><h2>Целият състав</h2><p class="label" translate="no">${html}</p></div>`;
  }

  function avoidHtml(res, text) {
    const prof = activeProfile();
    if (!isSupporter() || !prof || !prof.avoid.length) return '';
    const hits = E.avoidHits(res, prof.avoid, text);
    return hits.length ? `<div class="flag warn"><h3>${esc(prof.name)} избягва: ${esc(hits.join(', '))}</h3><p>Открихме ги в състава. При алергия винаги провери етикета сам.</p></div>`
      : `<div class="flag" style="background:var(--gbg)"><h3>Нищо от списъка на ${esc(prof.name)}</h3><p>Не открихме нищо от „избягвам“. Данните може да са непълни, затова провери етикета.</p></div>`;
  }

  function header({ title, meta, img, back, toggle }) {
    const t = toggle ? `<div class="seg" role="group" aria-label="За кого е обяснението"><a href="${toggle.me}" class="${toggle.on === 'me' ? 'on' : ''}">За мен</a><a href="${toggle.kid}" class="${toggle.on === 'kid' ? 'on' : ''}">За дете ${isSupporter() ? '' : icon('lock', 13, 2.6)}</a></div>` : '';
    return `<header class="head">${LEAF}<div class="row"><a class="rbtn" href="${back}" aria-label="Назад">${icon('back')}</a>${LOGO}<button class="rbtn" id="share" aria-label="Сподели">${icon('share')}</button></div>
      <div class="prod"><div class="img">${img ? `<img src="${esc(img)}" alt="">` : 'няма снимка'}</div><div><h1>${esc(title)}</h1>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div></div>${t}</header>`;
  }

  function productBody(res, nut, kind, opts) {
    const flags = E.flagsFor(res);
    const traces = opts.traces && opts.traces.length ? opts.traces : (res.traces || []);
    const al = opts.allergens || [];
    const all = al.length || traces.length ? `<div style="font-size:14px;color:var(--muted)">${al.length ? 'Алергени по данни: ' + esc(al.join(', ')) + '. ' : ''}${traces.length ? 'Може да съдържа следи от: ' + esc(traces.join(', ')) + '. ' : ''}Винаги проверявай етикета.</div>` : '';
    return `<div class="wrap">
      ${opts.badList ? `<div class="flag"><h3>Съставът в базата не е използваем</h3><p>За този продукт Open Food Facts няма четим списък със съставки (липсва или е въведен с грешки). Снимай състава на опаковката и ще го обясним съставка по съставка. Хранителните стойности от базата ще останат.</p><a class="btn green" id="photofor" href="#/photo" style="margin-top:6px">${icon('camera')}Снимай състава</a></div>` : ''}
      ${opts.fromPhoto ? `<div class="note">Съставът е от твоята снимка на опаковката. <a href="#/photo" id="rephoto">Снимай отново</a></div>` : ''}
      ${opts.lang && opts.lang !== 'bg' ? `<div class="note">Няма български състав в базата, затова обясняваме ${opts.lang === 'en' ? 'английския' : 'френския'}.</div>` : ''}
      ${opts.unreadable ? `<p class="lead">Не успяхме да разчетем достатъчно от състава.</p><div class="note">Разпознахме само ${res.ing.size + res.add.size} от прочетените думи, затова не можем да кажем какво има в продукта. Снимай отблизо само българския текст или го напиши.<div class="grid2" style="margin-top:10px"><a class="btn outline" href="#/photo" style="min-height:44px;font-size:14px">Снимай отново</a><a class="btn outline" href="#/type" style="min-height:44px;font-size:14px">Напиши сам</a></div></div>` : `<p class="lead">${esc(E.summary(res, nut, kind, opts.badList))}</p>`}
      <button class="pillbtn" id="listen">${icon('speaker', 18)}Слушай обяснението ${isSupporter() ? '' : SUP}</button>
      ${avoidHtml(res, opts.text)}
      ${tilesHtml(nut, kind, !opts.code)}
      ${sugarHtml(nut, kind, opts.serving)}
      ${calcHtml(nut, kind)}
      ${flags.length && !opts.badList ? '<div style="display:flex;flex-direction:column;gap:10px"><h2>Важно да знаеш</h2>' + flags.map(flagHtml).join('') + '</div>' : ''}
      ${opts.badList ? '' : groupsHtml(res)}
      ${opts.badList ? '' : itemsHtml(res, opts.back)}
      ${labelHtml(opts.text, res)}
      ${all}
      <button class="btn dark" id="share2">${icon('share')}Сподели със семейството</button>
    </div>${FOOT(opts.code)}`;
  }

  function wireProduct(res, nut, kind, share) {
    wireCalc();
    const listen = document.getElementById('listen');
    if (listen) listen.addEventListener('click', () => {
      if (!isSupporter()) return go('#/support');
      speak(E.summary(res, nut, kind));
    });
    ['share', 'share2'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => shareSheet(share)); });
  }

  /* ---------- read aloud ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) return toast('Браузърът не може да чете на глас.');
    const voices = speechSynthesis.getVoices(); const v = voices.find(x => /^bg/i.test(x.lang));
    if (!v) return toast('Телефонът няма български глас. Добави го в настройките за говор.');
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.95; speechSynthesis.speak(u);
  }

  /* ---------- views ---------- */
  async function viewProduct(code, kidMode, dbOnly) {
    view(`<div class="center"><div class="spinner" aria-hidden="true"></div><p>Търсим продукта…</p></div>`);
    let p;
    try { p = await fetchProduct(code); } catch (e) {
      return view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Назад">${icon('back')}</a></div><div class="center"><h1 style="font-size:24px">Няма връзка</h1><p>Не успяхме да стигнем до базата с продукти. Провери интернета и опитай пак.</p><button class="btn green" onclick="location.reload()">Опитай пак</button><a class="btn ghost" href="#/type">Напиши състава ръчно</a></div>`);
    }
    if (!p) { session.set('pendingCode', code); return go('#/notfound/' + encodeURIComponent(code)); }
    const saved = !p.ingredients_text_bg && savedLabel(code);
    if (saved) {
      p = Object.assign({}, p, { ingredients_text_bg: saved.t, ingredients: [], additives_tags: [], fromPhoto: true });
      const db = nutOf(p);
      if (saved.nut && db.sugar == null && db.sat == null && db.salt == null) p.nutriments = { sugars_100g: saved.nut.sugar, 'saturated-fat_100g': saved.nut.sat, salt_100g: saved.nut.salt, _fromPhoto: true };
    }
    if (!p.ingredients_text_bg && !dbOnly) return viewAskPhoto(code, p, kidMode);
    const res = E.analyseProduct(p); const nut = nutOf(p); const kind = isDrink(p) ? 'drink' : 'food';
    const name = p.product_name_bg || p.product_name || 'Продукт ' + code;
    const meta = [p.brands, p.quantity].filter(Boolean).join(' · ');
    const shareData = { title: name, code, nut, kind, res, text: E.summary(res, nut, kind) };
    remember({ key: code, code, name, cubes: nut.sugar != null ? E.cubes(nut.sugar) : null, nAdd: res.add.size, warn: E.flagsFor(res).some(f => f.level === 'warn') });
    const top = header({ title: name, meta, img: p.image_front_small_url, back: '#/', toggle: { me: '#/p/' + code, kid: '#/k/' + code, on: kidMode ? 'kid' : 'me' } });
    if (kidMode) return renderKid(top, res, nut, kind, shareData);
    const usable = E.readable(res);
    view(top + productBody(res, nut, kind, { text: res.text, serving: +p.serving_quantity || null, code, back: '#/p/' + code, allergens: p.fromPhoto ? [] : allergens(p.allergens_tags), traces: p.fromPhoto ? [] : allergens(p.traces_tags), badList: !usable, lang: res.lang, fromPhoto: p.fromPhoto }));
    wireProduct(res, nut, kind, shareData);
    const ph = document.getElementById('photofor');
    if (ph) ph.addEventListener('click', () => session.set('photoFor', { name, nut, kind, serving: +p.serving_quantity || null, code, at: Date.now() }));
    const re = document.getElementById('rephoto');
    if (re) re.addEventListener('click', () => session.set('photoFor', { name, nut, kind, serving: +p.serving_quantity || null, code, at: Date.now() }));
  }

  function viewAskPhoto(code, p, kidMode) {
    const name = p.product_name_bg || p.product_name || 'Продукт ' + code; const nut = nutOf(p); const kind = isDrink(p) ? 'drink' : 'food';
    const meta = [p.brands, p.quantity].filter(Boolean).join(' · ');
    const pf = { name, nut, kind, serving: +p.serving_quantity || null, code, at: Date.now() };
    view(header({ title: name, meta, img: p.image_front_small_url, back: '#/' }) + `<div class="wrap">
      <h1 style="font-size:25px;font-weight:900">Снимай състава на опаковката</h1>
      <p style="margin:0;font-size:16px;line-height:1.5">Намерихме продукта, но в базата няма български списък със съставки. Снимай го и ще ти обясним всяка съставка.${nut.sugar != null ? ' Захарта и стойностите от базата ще бъдат включени.' : ''}</p>
      <div class="note">Снимай само българския текст след „Съставки:“. Телефонът ще го запомни: следващия път този баркод ще се обясни веднага.</div>
      <a class="btn green" href="#/photo" data-pf>${icon('camera')}Снимай състава</a>
      <a class="btn outline" href="#/type" data-pf>${icon('pen')}Напиши го сам</a>
      <a class="btn ghost" href="#/${kidMode ? 'k' : 'p'}/${esc(code)}?db=1">Виж само данните от базата</a>
      </div>${FOOT(code)}`);
    document.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => session.set('photoFor', pf)));
    const sh = document.getElementById('share'); if (sh) sh.addEventListener('click', () => shareSheet({ title: name, code, nut, kind, res: E.analyseText(''), text: '' }));
  }

  function renderKid(top, res, nut, kind, shareData) {
    if (!isSupporter()) { view(top + upsell('Обяснение за дете', 'Същите факти с думи, които едно дете разбира, и големи бучки захар.')); wireShareOnly(shareData); return; }
    const rows = [...res.add.keys()].map(c => E.additiveInfo(c)).map(a => `<div class="card" style="flex-direction:row;gap:12px;align-items:flex-start"><span style="width:44px;height:44px;border-radius:999px;background:var(--gbg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font:800 12px var(--body);color:var(--g)">${a.code === 'E14X' ? 'E14' : a.code}</span><p style="margin:0;font-size:16px;line-height:1.45"><b>${esc(a.name.charAt(0).toUpperCase() + a.name.slice(1))}</b> ${esc(a.kid || 'помага при направата на храната.')}</p></div>`).join('');
    const c = nut.sugar != null ? E.cubes(nut.sugar) : null;
    view(top + `<div class="wrap"><h2>Обяснено за дете</h2>
      ${c != null ? `<div class="sugar"><span class="big" style="font-size:24px">Колко захар има?</span>${cubesHtml(c, 50)}</div>` : ''}
      <p class="lead" style="font-size:19px">${esc(E.kidSummary(res, nut, kind))}</p>${rows}
      <button class="pillbtn" id="listen">${icon('speaker', 18)}Прочети на глас</button>
      <button class="btn dark" id="share2">${icon('share')}Сподели</button></div>${FOOT(shareData.code)}`);
    document.getElementById('listen').addEventListener('click', () => speak(E.kidSummary(res, nut, kind) + ' ' + [...res.add.keys()].map(k => { const a = E.additiveInfo(k); return a.name + ' ' + (a.kid || ''); }).join('. ')));
    wireShareOnly(shareData);
  }
  function wireShareOnly(shareData) { ['share', 'share2'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => shareSheet(Object.assign({ kid: true }, shareData))); }); }

  function upsell(title, text) {
    return `<div class="wrap"><div class="card" style="background:var(--supbg);border:0"><h2>${esc(title)} ${SUP}</h2><p style="margin:0;font-size:16px;line-height:1.5">${esc(text)}</p>
      <a class="btn dark" href="#/support">Виж какво получаваш</a></div></div>`;
  }

  const noteHtml = n => `<div class="flag ${n.allergen ? '' : 'info'}"><h3>${n.allergen ? 'Алерген' : 'Добре е да знаеш'}</h3><p>${esc(n.text)}</p>${n.src && n.src.length ? srcLinks(n.src) : ''}</div>`;

  /* What the label's own footnote says about this item, plus a plain explanation when we have one. */
  const labelHtml2 = label => {
    if (!label) return '';
    const g = E.glossFor ? E.glossFor(label) : null;
    return `<div class="flag info"><h3>Етикетът казва: „${esc(label)}“</h3>${g ? `<p>${esc(g.text)}</p>${g.src.length ? srcLinks(g.src) : ''}` : ''}</div>`;
  };

  function viewAdditive(code, back, ctx, label) {
    const a = E.additiveInfo(code, ctx || '');
    const roles = (a.what ? `<h2>Какво е</h2><p class="lead" style="margin:0">${esc(a.what)}</p>${a.variant ? `<p style="margin:0;font-weight:600">${esc(a.variant)}</p>` : ''}<h2>Какво прави в храната</h2>` : '')
      + (a.roles.length ? a.roles.map(r => `<p class="${a.what ? '' : 'lead'}" style="margin:0;${a.what ? 'font-size:16px;line-height:1.5' : ''}">${esc(r)}</p>`).join('') : `<p class="lead">${a.known ? 'Ролята ѝ още не е описана в Kakvo.' : 'Тази добавка още не е в нашата база.'}</p>`)
      + (a.why ? `<p style="margin:0;font-size:16px;line-height:1.5">${esc(a.why)}</p>` : '')
      + labelHtml2(label) + a.notes.map(noteHtml).join('');
    view(`<header class="head">${LEAF}<div class="row"><a class="rbtn" href="${esc(back || '#/')}" aria-label="Назад">${icon('back')}</a>${LOGO}<span style="width:44px"></span></div>
      <span style="align-self:flex-start;font-weight:800;font-size:15px;background:#FFFFFF;color:var(--g);padding:6px 12px;border-radius:10px">${code === 'E14X' ? 'E14xx' : esc(code)}</span>
      <h1 style="font-weight:900;font-size:30px;line-height:1.05">${esc(a.name.charAt(0).toUpperCase() + a.name.slice(1))}</h1>${a.en ? `<div class="meta">${esc(a.en)}</div>` : ''}</header>
      <div class="wrap">${roles}
      ${a.pct != null ? `<div class="card" style="flex-direction:row;align-items:baseline;gap:8px"><span style="font-family:var(--display);font-weight:900;font-size:24px">${a.pct >= 1 ? Math.round(a.pct) + '%' : '&lt;1%'}</span><span style="font-size:15px">от продуктите със състав в България я съдържат (данни Open Food Facts).</span></div>` : ''}
      ${a.flag ? flagHtml(a.flag) : ''}
      <div class="note">Всяка добавка с Е-номер е оценена и разрешена в ЕС за определени храни и количества. Kakvo показва предупреждения само когато има официален източник.</div>
      </div>${FOOT()}`);
  }

  function viewIngredient(tag, back, label) {
    const x = E.ingredientInfo(tag);
    if (!x) return go(back || '#/');
    view(`<header class="head">${LEAF}<div class="row"><a class="rbtn" href="${esc(back || '#/')}" aria-label="Назад">${icon('back')}</a>${LOGO}<span style="width:44px"></span></div>
      <span class="chip g-${x.g}" style="align-self:flex-start"><span class="dot"></span>${esc(x.group)}</span>
      <h1 style="font-weight:900;font-size:30px;line-height:1.05">${esc(cap(x.name))}</h1>${x.en ? `<div class="meta">${esc(x.en)}</div>` : ''}</header>
      <div class="wrap">
      ${x.what ? `<h2>Какво е</h2><p class="lead" style="margin:0">${esc(x.what)}</p>` : `<p class="lead">Още нямаме подробно обяснение за тази съставка. Тя е от групата „${esc(x.group.toLowerCase())}“.</p>`}
      ${x.why ? `<h2>Защо е в храната</h2><p style="margin:0;font-size:16px;line-height:1.5">${esc(x.why)}</p>` : ''}
      ${labelHtml2(label)}${x.notes.map(noteHtml).join('')}
      ${x.pct != null ? `<div class="card" style="flex-direction:row;align-items:baseline;gap:8px"><span style="font-family:var(--display);font-weight:900;font-size:24px">${x.pct >= 1 ? Math.round(x.pct) + '%' : '&lt;1%'}</span><span style="font-size:15px">от продуктите със състав в България я съдържат (данни Open Food Facts).</span></div>` : ''}
      <div class="note">Обясненията на Kakvo казват какво е съставката и защо е там. Предупреждения показваме само с официален източник.</div>
      </div>${FOOT()}`);
  }

  function viewNotFound(code) {
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>Не намерихме продукта</b></div>
      <div class="wrap"><h1 style="font-size:25px;font-weight:900">Този продукт още го няма в базата</h1>
      <p style="margin:0;color:var(--muted)">Баркод ${esc(code)}. Снимай състава на гърба и ще го обясним веднага.</p>
      <a class="btn green" href="#/photo">${icon('camera')}Снимай състава</a><a class="btn outline" href="#/type">${icon('pen')}Напиши съставките сам</a>
      <div class="note">Искаш да помогнеш на другите? Добави продукта в <a href="https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&code=${encodeURIComponent(code)}" target="_blank" rel="noopener">Open Food Facts</a>. Тогава следващият човек ще го намери веднага.</div></div>`);
  }

  /* ---------- text result (photo or typed) ---------- */
  function viewText() {
    const d = session.get('text');
    if (!d || !d.text) return go('#/type');
    const res = E.analyseText(d.text); const nut = d.nut || {}; const kind = d.kind || 'food';
    if (d.code && E.readable(res)) {
      saveLabel(d.code, d.text, d.nut, d.kind);
      const sh = session.get('share'); session.set('share', null);
      if (canShare() && sh && sh.code === d.code && sh.image) contribute({ code: d.code, text: offText(d, sh), image: sh.image, uuid: deviceId(), v: CFG.VERSION });
      session.set('text', null); return location.replace('#/p/' + d.code);
    }
    remember({ key: 't:' + d.text.slice(0, 60), name: d.name || 'Продукт от снимка', text: true, cubes: nut.sugar != null ? E.cubes(nut.sugar) : null, nAdd: res.add.size, warn: E.flagsFor(res).some(f => f.level === 'warn') });
    const shareData = { title: d.name || 'Продукт', nut, kind, res, text: E.summary(res, nut, kind) };
    view(header({ title: d.name || 'Твоят продукт', meta: 'От снимка или ръчно написан състав', back: '#/type' }) + productBody(res, nut, kind, { text: d.text, back: '#/t', serving: d.serving, unreadable: !E.readable(res) }) .replace('<div class="foot">', nutTableHtml(nut, kind) + '<div class="foot">'));
    wireProduct(res, nut, kind, shareData);
  }

  function nutFields(nut, kind) {
    nut = nut || {};
    return `<div class="card"><h2>Хранителна стойност (по желание)</h2><span style="font-size:14px;color:var(--muted)">Препиши от таблицата „на 100 г“, за да видиш бучките захар.</span>
      <div class="seg light" role="group" aria-label="Вид продукт"><button type="button" data-kind="food" class="${kind !== 'drink' ? 'on' : ''}">Храна</button><button type="button" data-kind="drink" class="${kind === 'drink' ? 'on' : ''}">Напитка</button></div>
      <div class="grid3"><div class="field"><label for="n-sugar">Захари, г</label><input id="n-sugar" inputmode="decimal" value="${nut.sugar ?? ''}"></div>
      <div class="field"><label for="n-sat">Наситени, г</label><input id="n-sat" inputmode="decimal" value="${nut.sat ?? ''}"></div>
      <div class="field"><label for="n-salt">Сол, г</label><input id="n-salt" inputmode="decimal" value="${nut.salt ?? ''}"></div></div></div>`;
  }
  function readNut() {
    const num = id => { const v = parseFloat((document.getElementById(id).value || '').replace(',', '.')); return isFinite(v) && v >= 0 ? v : null; };
    const k = document.querySelector('[data-kind].on');
    return { nut: { sugar: num('n-sugar'), sat: num('n-sat'), salt: num('n-salt') }, kind: k ? k.dataset.kind : 'food' };
  }
  function wireKind() { document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); })); }

  function viewType(prefill) {
    const pfx = photoFor(); const prev = pfx ? { name: pfx.name } : (session.get('text') || {});
    const text = prefill != null ? prefill : (pfx ? '' : (prev.text || ''));
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>Напиши съставките</b></div>
      <div class="wrap"><p style="margin:0;color:var(--muted)">Препиши ги от опаковката. Не е нужно да са перфектни: разпознаваме и Е-номера.</p>
      <div class="field"><label for="pname">Име на продукта (по желание)</label><input id="pname" value="${esc(prev.name || '')}" placeholder="напр. бисквити"></div>
      <div class="field"><label for="typed">Съставки</label><textarea id="typed" class="box" translate="no" placeholder="напр. брашно, захар, палмово масло, Е322…">${esc(text)}</textarea></div>
      <span id="count" class="src"></span><div id="live" class="chips"></div>
      ${nutFields(prev.nut, prev.kind)}
      <button class="btn green" id="explain">Обясни състава</button><a class="btn ghost" href="#/photo">${icon('camera')}Снимай вместо това</a></div><div class="foot"></div>`);
    wireKind();
    const ta = document.getElementById('typed');
    const live = () => {
      const r = E.analyseText(ta.value); const found = r.ing.size + r.add.size;
      document.getElementById('count').textContent = ta.value.trim() ? `Разпознахме ${found} ${found === 1 ? 'съставка' : 'съставки'}${r.unk.length ? ', ' + r.unk.length + ' без обяснение' : ''}` : '';
      document.getElementById('live').innerHTML = [...r.ing.values()].slice(0, 12).map(x => `<span class="chip g-${x.g === 'palm' || x.g === 'trans' ? 'fat' : x.g}"><span class="dot"></span>${esc(x.bg)}</span>`).join('') + [...r.add.keys()].map(c => `<span class="chip g-other" style="background:var(--gbg)"><span class="dot" style="background:var(--g)"></span>${c}</span>`).join('');
    };
    ta.addEventListener('input', live); live();
    document.getElementById('explain').addEventListener('click', () => {
      if (!ta.value.trim()) { ta.focus(); return toast('Напиши поне една съставка.'); }
      const n = readNut(); const pf = photoFor(); const typedNut = Object.values(n.nut).some(v => v != null);
      session.set('text', { text: ta.value, name: document.getElementById('pname').value.trim() || (pf ? pf.name : ''), nut: !typedNut && pf ? pf.nut : n.nut, kind: !typedNut && pf ? pf.kind : n.kind, serving: pf ? pf.serving : null, code: pf ? pf.code : null });
      session.set('photoFor', null);
      go('#/t');
    });
  }

  /* ---------- photo + OCR ---------- */
  let photoMode = 'ing', lastBox = null;
  function viewPhoto(mode, pair) {
    photoMode = mode === 'nut' ? 'nut' : 'ing';
    if (pair) session.set('pair', pair);
    const nutM = photoMode === 'nut';
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>${nutM ? 'Снимай таблицата' : 'Снимай състава'}</b></div>
      <div class="wrap"><div class="seg light" role="group" aria-label="Какво снимаш"><a href="#/photo" class="${nutM ? '' : 'on'}">Съставки</a><a href="#/photo?m=nut" class="${nutM ? 'on' : ''}">Хранителни стойности</a></div>
      <h1 style="font-size:25px;font-weight:900">${nutM ? 'Снимай таблицата „Хранителни стойности“' : 'Снимай състава на гърба'}</h1>
      <p style="margin:0;color:var(--muted)">${nutM ? 'Числата са еднакви на всички езици, затова тук езикът няма значение. После ще оградиш числата и ще ги провериш.' : 'После ще оградиш българския текст. Ще ти покажем какво сме прочели, преди да го обясним.'}</p>
      <ol class="steps" style="padding:0"><li class="cur"><span></span>1 Снимка</li><li><span></span>2 Провери текста</li><li><span></span>3 Обяснение</li></ol>
      <label class="btn green" for="file">${icon('camera')}Отвори камерата</label>
      <input id="file" type="file" accept="image/*" capture="environment" class="sr">
      <div class="note">За ясна снимка: дръж телефона неподвижно на около 15 см, изправи опаковката и избягвай отблясъци.</div>
      <a class="btn outline" href="#/type">${icon('pen')}Напиши съставките сам</a></div>`);
    document.getElementById('file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) handlePhoto(f); });
  }

  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 3200 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    return c;
  }
  /* Sharpness = variance of the Laplacian on a small grey copy. Low = blurry. */
  function sharpness(src) {
    const w = 400, h = Math.round(src.height * w / src.width); const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, w, h); const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    let sum = 0, sq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; sum += l; sq += l * l; n++; }
    const m = sum / n; return sq / n - m * m;
  }
  function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }

  /* Grey, auto-invert light-on-dark labels, stretch contrast, enlarge. Tesseract reads dark text on light best. */
  /* Nutrition tables: erase long dark horizontal and vertical lines (the table grid). The reader often skips a row that touches a line. */
  function eraseGrid(d, W, H) {
    const g = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) g[i] = d[i * 4];
    const white = i => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; };
    const minH = Math.round(W * 0.25), minV = Math.round(H * 0.15);
    for (let y = 0; y < H; y++) { let s = -1; for (let x = 0; x <= W; x++) { const k = x < W && g[y * W + x] < 110; if (k && s < 0) s = x; if (!k && s >= 0) { if (x - s >= minH) for (let i = s; i < x; i++) for (let dy = -2; dy <= 2; dy++) if (y + dy >= 0 && y + dy < H) white((y + dy) * W + i); s = -1; } } }
    for (let x = 0; x < W; x++) { let s = -1; for (let y = 0; y <= H; y++) { const k = y < H && g[y * W + x] < 110; if (k && s < 0) s = y; if (!k && s >= 0) { if (y - s >= minV) for (let i = s; i < y; i++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < W) white(i * W + x + dx); s = -1; } } }
  }

  function prepare(src, box, grid) {
    const bx = box || { x: 0, y: 0, w: src.width, h: src.height };
    const scale = Math.max(0.5, Math.min(3, 2400 / bx.w));
    const c = document.createElement('canvas'); c.width = Math.round(bx.w * scale); c.height = Math.round(bx.h * scale);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, bx.x, bx.y, bx.w, bx.h, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height); const d = img.data; const n = d.length / 4;
    const g = new Uint8ClampedArray(n); let sum = 0;
    for (let i = 0; i < n; i++) { const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; g[i] = v; sum += v; }
    const invert = sum / n < 128;
    const hist = new Uint32Array(256); for (let i = 0; i < n; i++) hist[g[i]]++;
    let lo = 0, hi = 255, acc = 0; for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.02) break; }
    acc = 0; for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.02) break; }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < n; i++) { let v = (g[i] - lo) * 255 / span; if (invert) v = 255 - v; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    if (grid) eraseGrid(d, c.width, c.height);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  let lastPhoto = null;
  function rotateCanvas(src, deg) {
    const c = document.createElement('canvas'); const side = deg % 180 !== 0;
    c.width = side ? src.height : src.width; c.height = side ? src.width : src.height;
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  /* Is the text running up/down (photo taken sideways)? Text lines make the row profile of edges jumpy;
     sideways text makes the column profile jumpy instead. */
  function textIsVertical(src) {
    const s = Math.min(1, 600 / Math.max(src.width, src.height)); const w = Math.round(src.width * s), h = Math.round(src.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const rows = new Float32Array(h), cols = new Float32Array(w);
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx; if (Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]) > 60) { rows[y]++; cols[xx]++; } }
    const jumpy = a => { let m = 0; for (const v of a) m += v; m /= a.length; let t = 0; for (let i = 1; i < a.length; i++) t += Math.abs(a[i] - a[i - 1]); return t / a.length / (m || 1); };
    return jumpy(cols) > jumpy(rows) * 1.4;
  }
  async function handlePhoto(file) {
    view(`<div class="center"><div class="spinner" aria-hidden="true"></div><p>Отваряме снимката…</p></div>`);
    try { lastPhoto = await loadImage(file); } catch (e) { toast('Не успяхме да отворим снимката.'); return go('#/photo'); }
    if (textIsVertical(lastPhoto)) lastPhoto = rotateCanvas(lastPhoto, -90);
    viewCrop();
  }

  /* Step 2: the user frames the Bulgarian text by dragging a box over the photo. */
  function viewCrop() {
    if (!lastPhoto) return go('#/photo');
    view(`<div class="topbar"><a class="rbtn soft" href="#/photo" aria-label="Назад">${icon('back')}</a><b>${photoMode === 'nut' ? 'Огради числата' : 'Огради българския текст'}</b></div>
      <div class="wrap" style="gap:12px"><p style="margin:0;color:var(--muted)">${photoMode === 'nut' ? 'Плъзни пръст, за да оградиш <b>колоните с числата</b> (от „на 100 г“ надолу до солта). Надписите не са нужни.' : 'Плъзни пръст върху снимката, за да оградиш само <b>българския</b> състав (от „Съставки“ до края). Така четем по-точно.'}</p>
      <div id="cropwrap" style="position:relative;touch-action:none;border-radius:14px;overflow:hidden;background:#000"><canvas id="cropview" style="display:block;width:100%;height:auto"></canvas><div id="box" style="position:absolute;border:3px solid var(--amber);background:rgba(242,179,94,0.15);border-radius:6px;display:none;pointer-events:none"></div></div>
      <button class="btn green" id="readbox" disabled style="opacity:0.5">${photoMode === 'nut' ? 'Прочети оградените числа' : 'Прочети оградения текст'}</button>
      <div class="grid2"><button class="btn outline" id="readall" style="min-height:46px;font-size:14px">Прочети цялата снимка</button><button class="btn outline" id="rot" style="min-height:46px;font-size:14px">↻ Завърти снимката</button></div>
      <p style="margin:0;font-size:14px;color:var(--muted)">Текстът трябва да е изправен. Ако е настрани или наопаки, натисни „Завърти“.</p></div><div class="foot"></div>`);
    const cv = document.getElementById('cropview'); const wrap = document.getElementById('cropwrap'); const boxEl = document.getElementById('box');
    const maxW = 1000; const sc = Math.min(1, maxW / lastPhoto.width);
    cv.width = Math.round(lastPhoto.width * sc); cv.height = Math.round(lastPhoto.height * sc);
    cv.getContext('2d').drawImage(lastPhoto, 0, 0, cv.width, cv.height);
    let a = null, b = null, sel = null;
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)) }; };
    const draw = () => {
      if (!a || !b) return; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
      Object.assign(boxEl.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const r = cv.getBoundingClientRect(); const k = lastPhoto.width / r.width;
      sel = w > 20 && h > 12 ? { x: Math.round(x * k), y: Math.round(y * k), w: Math.round(w * k), h: Math.round(h * k) } : null;
      const btn = document.getElementById('readbox'); btn.disabled = !sel; btn.style.opacity = sel ? '1' : '0.5';
    };
    wrap.addEventListener('pointerdown', e => { wrap.setPointerCapture(e.pointerId); a = pt(e); b = a; draw(); });
    wrap.addEventListener('pointermove', e => { if (!a || !(e.buttons || e.pressure)) return; b = pt(e); draw(); });
    wrap.addEventListener('pointerup', e => { if (a) { b = pt(e); draw(); } });
    document.getElementById('readbox').addEventListener('click', () => sel && runOcr(sel));
    document.getElementById('readall').addEventListener('click', () => runOcr(null));
    document.getElementById('rot').addEventListener('click', () => { lastPhoto = rotateCanvas(lastPhoto, 90); viewCrop(); });
  }

  async function runOcr(box, lang) {
    lastBox = box; lang = lang || (photoMode === 'nut' ? 'eng' : 'bul');
    view(`<div class="center"><div class="spinner" aria-hidden="true"></div><p id="ocrmsg">Проверяваме снимката…</p></div>`);
    const canvas = prepare(lastPhoto, box);
    if (sharpness(canvas) < (CFG.BLUR_THRESHOLD || 60)) return viewBlur();
    const nut = photoMode === 'nut';
    try {
      const what = photoMode === 'nut' ? 'Четем числата…' : 'Четем състава…';
      document.getElementById('ocrmsg').textContent = what + ' Първия път отнема около минута.';
      if (!window.Tesseract) await loadScript(CFG.TESSERACT_URL);
      const worker = await Tesseract.createWorker(lang, 1, { logger: m => { const el = document.getElementById('ocrmsg'); if (el && m.status === 'recognizing text') el.textContent = what + ' ' + Math.round(m.progress * 100) + '%'; } });
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      let { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      // Upside-down photo: confidence collapses. Try once turned around and keep the better reading.
      const conf = dt => { const ws = []; (dt.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => l.words.forEach(w => { if (w.text.length > 1) ws.push(w.confidence); })))); return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0; };
      if (conf(data) < 60) {
        const msg = document.getElementById('ocrmsg'); if (msg) msg.textContent = 'Опитваме и обърната снимка…';
        const flip = await worker.recognize(rotateCanvas(canvas, 180), {}, { text: true, blocks: true });
        if (conf(flip.data) > conf(data) + 5) data = flip.data;
      }
      const linesOf = dt => { const ls = []; (dt.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => ls.push(l.words.map(w => w.text).join(' '))))); return ls; };
      if (nut) {
        /* Tables in several languages: read again with the grid erased, and in "columns" mode, and keep the reading that makes most sense. */
        const done = p => p.fat != null && p.carbs != null && p.protein != null && p.salt != null && p.sat != null && p.sugar != null && p.check && p.check.ok && !p.problems;
        let lines = linesOf(data); const reads = [E.parseNutrition(lines.join('\n'))]; let best = E.mergeNutrition(reads);
        for (const [grid, psm] of [[true, '6'], [true, '4'], [false, '4']]) {
          if (done(best)) break;
          const msg = document.getElementById('ocrmsg'); if (msg) msg.textContent = 'Таблицата е трудна. Четем я още веднъж…';
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          const r = await worker.recognize(grid ? prepare(lastPhoto, box, true) : canvas, {}, { text: true, blocks: true });
          const ls = linesOf(r.data); reads.push(E.parseNutrition(ls.join('\n'))); lines = lines.concat(['---'], ls);
          best = E.mergeNutrition(reads);
        }
        await worker.terminate();
        window.KAKVO_LAST_OCR = lines;
        if (!lines.join('').trim()) return viewBlur('Не намерихме текст на снимката.');
        return viewNutConfirm(best);
      }
      await worker.terminate();
      const words = []; const lines = [];
      (data.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => { lines.push(l.words.map(w => w.text).join(' ')); l.words.forEach(w => words.push({ t: w.text, c: w.confidence })); words.push({ t: '\n' }); })));
      if (!words.filter(w => w.t !== '\n').length) return viewBlur('Не намерихме текст на снимката.');
      window.KAKVO_LAST_OCR = lines;
      viewReview(words, !!box, false, lang);
    } catch (e) {
      console.error(e);
      view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a></div><div class="center"><h1 style="font-size:22px">Не успяхме да прочетем снимката</h1><p>Може да няма връзка за първото зареждане на четеца. Напиши състава ръчно.</p><a class="btn green" href="#/type">${icon('pen')}Напиши съставките сам</a></div>`);
    }
  }

  function viewBlur(msg) {
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>Не намерихме продукта</b></div>
      <div class="wrap"><h1 style="font-size:25px;font-weight:900">${esc(msg || 'Снимката е размазана')}</h1>
      <p style="margin:0;color:var(--muted)">Не можем да прочетем състава добре. Опитай отново или го напиши.</p>
      <div class="note"><b>За по-ясна снимка</b><br>Дръж телефона неподвижно, на около 15 см. Изправи опаковката, ако е огъната. Избягвай отблясъци от лампата.</div>
      <a class="btn green" href="#/photo">${icon('camera')}Снимай отново</a><a class="btn outline" href="#/type">${icon('pen')}Напиши съставките сам</a></div>`);
  }

  function viewReview(words, framed, showAll, lang) {
    const en = lang === 'eng';
    const LOW = CFG.UNSURE_CONFIDENCE || 70;
    let full = ''; const pos = [];
    words.forEach(w => { if (w.t === '\n') { full = full.replace(/ $/, '') + '\n'; pos.push(null); return; } pos.push([full.length, full.length + w.t.length]); full += w.t + ' '; });
    const ex = en ? E.extractEnglish(full) : E.extractBulgarian(full);
    const inPart = i => !ex.found || showAll || (pos[i] && pos[i][0] >= ex.start && pos[i][1] <= ex.end + 1);
    const fixes = []; const seen = new Set(); let unsureCount = 0;
    const html = words.map((w, i) => {
      if (w.t === '\n') return showAll || !ex.found ? '<br>' : ' ';
      if (!inPart(i)) return '';
      if (w.c < LOW) {
        unsureCount++;
        const sug = en ? null : E.suggest(w.t);
        if (sug && !seen.has(w.t) && fixes.length < 10) { seen.add(w.t); fixes.push({ i, from: w.t.replace(/[.,:;]+$/, ''), to: sug }); }
        return `<span class="unsure" data-i="${i}">${esc(w.t)}</span> `;
      }
      return esc(w.t) + ' ';
    }).join('');
    const editText = ex.found && !showAll ? ex.part : full.trim();
    view(`<div class="topbar"><a class="rbtn soft" href="#/crop" aria-label="Назад">${icon('back')}</a><b>Провери какво прочетохме</b></div>
      <div class="wrap"><ol class="steps" style="padding:0"><li class="done"><span></span>1 Снимка</li><li class="cur"><span></span>2 Провери текста</li><li><span></span>3 Обяснение</li></ol>
      ${ex.found && !showAll ? `<div class="flag" style="background:var(--gbg)"><h3>${en ? 'Намерихме английския състав' : 'Намерихме българския състав'}</h3><p>Показваме само частта от „${en ? 'Ingredients' : 'Съставки'}“ нататък. Текстът на другите езици е скрит.</p></div>` :
        `<div class="note">Не намерихме думата „${en ? 'Ingredients' : 'Съставки'}“. ${framed ? '' : 'Етикетът вероятно е на няколко езика. '}<a href="#/crop">Огради само ${en ? 'английския' : 'българския'} текст</a> или поправи текста отдолу.</div>
        ${en ? '' : `<button class="btn ghost" id="readen" style="min-height:42px;font-size:14px">Съставът е само на английски? Прочети на английски</button>`}`}
      <p style="margin:0;color:var(--muted)">Подчертаните думи са тези, в които не сме сигурни.</p>
      <p class="label" id="read" translate="no">${html}</p>
      ${ex.found ? `<button class="btn ghost" id="toggleall" style="min-height:40px;font-size:14px">${showAll ? 'Покажи само българската част' : 'Покажи целия прочетен текст'}</button>` : ''}
      ${unsureCount ? `<div style="font-size:14px;color:var(--org);font-weight:700">${unsureCount} ${unsureCount === 1 ? 'дума' : 'думи'} за проверка</div>` : ''}
      ${fixes.length ? `<div class="chips">${fixes.map((f, k) => `<button class="chip-btn pillbtn" style="border-color:var(--orgbar)" data-fix="${k}"><s style="color:var(--muted)">${esc(f.from)}</s> → <b>${esc(f.to)}</b></button>`).join('')}</div>` : ''}
      <div class="field"><label for="edit">Поправи, ако нещо е грешно</label><textarea id="edit" class="box" translate="no">${esc(editText)}</textarea></div>
      ${canShare() && photoFor() && photoMode === 'ing' && !en ? `<label class="share-off"><input type="checkbox" id="shareoff" ${store.get('shareOff', true) ? 'checked' : ''}><span><b>Сподели с Open Food Facts</b>Снимката на състава ще помогне на всеки, който сканира този продукт. Текстът се изпраща, ако е прочетен ясно или си го поправил. Отиват в отворената база Open Food Facts под свободен лиценз, без твоето име.</span></label>` : ''}
      <button class="btn green" id="explain">${pendingNut() || (photoFor() && photoFor().nut && photoFor().nut.sugar != null) ? 'Обясни състава' : 'Напред'}</button>
      <div class="grid2"><a class="btn outline" href="#/photo" style="min-height:46px;font-size:14px">Снимай отново</a><a class="btn outline" href="#/type" style="min-height:46px;font-size:14px">Напиши сам</a></div></div><div class="foot"></div>`);
    wireKind();
    const ta = document.getElementById('edit');
    const tg = document.getElementById('toggleall'); if (tg) tg.addEventListener('click', () => viewReview(words, framed, !showAll, lang));
    const re = document.getElementById('readen'); if (re) re.addEventListener('click', () => runOcr(lastBox, 'eng'));
    document.querySelectorAll('[data-fix]').forEach(b => b.addEventListener('click', () => {
      const f = fixes[+b.dataset.fix]; ta.value = ta.value.split(f.from).join(f.to);
      const span = document.querySelector(`[data-i="${f.i}"]`); if (span) { span.textContent = f.to; span.classList.remove('unsure'); }
      b.remove();
    }));
    document.getElementById('explain').addEventListener('click', () => {
      const pn = pendingNut();
      const pf = photoFor(); const forProduct = pf && pf.nut && pf.nut.sugar != null;
      const so = document.getElementById('shareoff');
      if (so) { store.set('shareOff', so.checked); session.set('share', so.checked ? { code: pf.code, image: labelJpeg(lastPhoto, lastBox), original: editText, unsure: words.filter(w => w.t !== '\n' && w.c < LOW).map(w => w.t) } : null); } else session.set('share', null);
      if (forProduct) { session.set('text', { text: ta.value, name: pf.name, nut: pf.nut, kind: pf.kind, serving: pf.serving, code: pf.code }); session.set('pair', null); session.set('photoFor', null); return go('#/t'); }
      session.set('text', { text: ta.value, name: pf ? pf.name : '', code: pf ? pf.code : null, nut: pn ? pn.nut : {}, kind: pn ? pn.kind : 'food', serving: pn ? pn.serving : null }); session.set('pair', null);
      go(pn ? '#/t' : '#/nutask');
    });
  }

  /* ---------- nutrition table (photo) ---------- */
  const NUT_FIELDS = [['kcal', 'Енергия', 'ккал'], ['fat', 'Мазнини', 'г'], ['sat', 'от тях наситени', 'г'], ['carbs', 'Въглехидрати', 'г'], ['sugar', 'от тях захари', 'г'], ['fibre', 'Фибри', 'г'], ['protein', 'Белтъци', 'г'], ['salt', 'Сол', 'г']];
  /* Nutrition read from a photo, waiting for the ingredients photo of the same product. */
  function pendingNut() { const d = session.get('nut'); return session.get('pair') === 'n' && d ? d : null; }

  function viewNutConfirm(p) {
    const read = NUT_FIELDS.filter(([k]) => p[k] != null).length;
    const doubt = new Set(p.doubt || []);
    view(`<div class="topbar"><a class="rbtn soft" href="#/crop" aria-label="Назад">${icon('back')}</a><b>Провери числата</b></div>
      <div class="wrap"><ol class="steps" style="padding:0"><li class="done"><span></span>1 Снимка</li><li class="cur"><span></span>2 Провери числата</li><li><span></span>3 Обяснение</li></ol>
      ${read >= 4 ? `<p style="margin:0;color:var(--muted)">Сравни с таблицата на опаковката (колоната „на 100 г“) и поправи, ако нещо е грешно.${doubt.size ? ' Числата в <b style="color:var(--org)">оранжево</b> не сме прочели сигурно.' : ''}</p>`
        : `<div class="note">Прочетохме само ${read} ${read === 1 ? 'число' : 'числа'}. Огради само колоните с числата и опитай пак, или ги препиши отдолу.</div>`}
      <div class="seg light" role="group" aria-label="Вид продукт"><button type="button" data-kind="food" class="on">Храна (на 100 г)</button><button type="button" data-kind="drink">Напитка (на 100 мл)</button></div>
      <div class="grid2">${NUT_FIELDS.map(([k, name, u]) => `<div class="field"><label for="f-${k}"${doubt.has(k) ? ' style="color:var(--org)"' : ''}>${name}, ${u}${doubt.has(k) ? ' · провери' : ''}</label><input id="f-${k}" inputmode="decimal" translate="no" value="${p[k] != null ? String(p[k]).replace('.', ',') : ''}"${doubt.has(k) ? ' style="border-color:var(--orgbar);background:var(--orgbg)"' : ''}></div>`).join('')}
        <div class="field"><label for="f-portion">Порция, г (ако има)</label><input id="f-portion" inputmode="decimal" value="${p.portion || ''}"></div></div>
      <div id="echeck"></div>
      <button class="btn green" id="nutgo">Покажи</button>
      <div class="grid2"><a class="btn outline" href="#/photo?m=nut" style="min-height:46px;font-size:14px">Снимай отново</a><a class="btn outline" href="#/crop" style="min-height:46px;font-size:14px">Огради отново</a></div></div><div class="foot"></div>`);
    wireKind();
    const val = id => { const v = parseFloat((document.getElementById(id).value || '').replace(',', '.')); return isFinite(v) && v >= 0 ? v : null; };
    const readAll = () => { const n = {}; NUT_FIELDS.forEach(([k]) => { n[k] = val('f-' + k); }); return n; };
    const check = () => {
      const n = readAll(); const c = E.energyCheck(n); const el = document.getElementById('echeck');
      const bad = (n.sat != null && n.fat != null && n.sat > n.fat) || (n.sugar != null && n.carbs != null && n.sugar > n.carbs);
      if (bad) el.innerHTML = `<div class="flag"><h3>Провери числата</h3><p>Наситените не може да са повече от мазнините, а захарите повече от въглехидратите.</p></div>`;
      else if (!c) el.innerHTML = '';
      else if (c.ok) el.innerHTML = `<div class="flag" style="background:var(--gbg)"><h3>Числата си пасват</h3><p>Енергията (${fmt(n.kcal)} ккал) отговаря на мазнините, въглехидратите и белтъците (≈ ${c.calc} ккал). Проверката хваща грешки в тези числа, не в наситените и захарите.</p></div>`;
      else el.innerHTML = `<div class="flag"><h3>Провери числата</h3><p>По мазнините, въглехидратите и белтъците се получават ≈ ${c.calc} ккал, а в таблицата пише ${fmt(n.kcal)}. Някое число вероятно е прочетено грешно.</p></div>`;
    };
    document.querySelectorAll('.wrap input').forEach(i => i.addEventListener('input', check)); check();
    document.getElementById('nutgo').addEventListener('click', () => {
      const nut = readAll(); const k = document.querySelector('[data-kind].on'); const kind = k ? k.dataset.kind : 'food';
      if (!NUT_FIELDS.some(([f]) => nut[f] != null)) return toast('Напиши поне едно число.');
      const d = { nut, kind, serving: val('f-portion') };
      const t = session.get('text');
      if (session.get('pair') === 't' && t && t.text) { session.set('text', Object.assign(t, d)); session.set('pair', null); return go('#/t'); }
      session.set('nut', d); session.set('pair', null); go('#/n');
    });
  }

  function nutTableHtml(nut, kind) {
    const have = NUT_FIELDS.filter(([k]) => nut[k] != null); if (have.length < 2) return '';
    return `<div class="wrap" style="padding-top:0"><div class="card"><h2>Хранителни стойности на 100 ${kind === 'drink' ? 'мл' : 'г'}</h2>${have.map(([k, name, u]) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)"><span>${name}</span><b>${fmt(nut[k])} ${u}</b></div>`).join('')}</div></div>`;
  }

  /* After the ingredients: ask for the nutrition table, the only place sugar, fat and salt amounts are. */
  function viewNutAsk() {
    const t = session.get('text'); if (!t || !t.text) return go('#/photo');
    view(`<div class="topbar"><a class="rbtn soft" href="#/crop" aria-label="Назад">${icon('back')}</a><b>Още една снимка</b></div>
      <div class="wrap"><ol class="steps" style="padding:0"><li class="done"><span></span>1 Състав</li><li class="cur"><span></span>2 Таблица</li><li><span></span>3 Обяснение</li></ol>
      <h1 style="font-size:25px;font-weight:900">Снимай и таблицата „Хранителни стойности“</h1>
      <p style="margin:0;color:var(--muted)">Съставът казва какви добавки има. Колко захар, наситени мазнини и сол има, пише само в таблицата. С нея ще видиш и бучките захар.</p>
      <div class="note">Таблицата обикновено е до състава, с колони „на 100 г“ и „на порция“. Езикът няма значение, четем само числата.</div>
      <a class="btn green" href="#/photo?m=nut&pair=t">${icon('camera')}Снимай таблицата</a>
      <a class="btn outline" href="#/t">Пропусни</a></div><div class="foot"></div>`);
  }

  function viewNut() {
    const d = session.get('nut'); if (!d) return go('#/photo?m=nut');
    const nut = d.nut, kind = d.kind || 'food'; const unit = kind === 'drink' ? 'мл' : 'г';
    const parts = [];
    [['sugar', 'захари'], ['sat', 'наситени мазнини'], ['salt', 'сол']].forEach(([k, w]) => { const lv = E.level(kind, k, nut[k]); if (lv) parts.push(`${E.LEVEL_WORD[lv]} съдържание на ${w}: ${fmt(nut[k])} г на 100 ${unit}.`); });
    view(header({ title: 'Хранителни стойности', meta: 'От снимка на таблицата', back: '#/photo?m=nut' }) + `<div class="wrap">
      <p class="lead">${esc(parts.join(' ') || 'Няма числа за захари, наситени мазнини и сол.')}</p>
      ${tilesHtml(nut, kind, true)}${sugarHtml(nut, kind, d.serving)}${calcHtml(nut, kind)}
      <a class="btn green" href="#/photo?pair=n">${icon('camera')}Добави и съставките</a>
      <div class="src">Съставките казват какви добавки има. Таблицата казва колко захар, мазнини и сол.</div></div>` + nutTableHtml(nut, kind) + FOOT());
    const sh = document.getElementById('share'); if (sh) sh.addEventListener('click', () => shareSheet({ title: 'Хранителни стойности', nut, kind, res: E.analyseText(''), text: parts.join(' ') }));
    wireCalc();
  }

  /* ---------- scanner ---------- */
  let stream = null, scanTimer = null, zxingControls = null;
  function stopCamera() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (zxingControls) { try { zxingControls.stop(); } catch (e) { /* ignore */ } zxingControls = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  function validCode(c) { return /^\d{8}$|^\d{12,14}$/.test(c); }
  function found(code) { if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* ignore */ } stopCamera(); go('#/p/' + code); }

  function viewScan() {
    session.set('photoFor', null);
    const recent = store.get('history', []).slice(0, 3);
    const pillFor = h => h.warn ? '<span class="pill p-r">за внимание</span>' : h.cubes != null ? `<span class="pill p-o">${fmt(h.cubes)} ${h.cubes === 1 ? 'бучка' : 'бучки'}</span>` : `<span class="pill p-g">${h.nAdd} добавки</span>`;
    view(`<div class="scan"><div class="top">${LOGO}<a class="rbtn darkbtn" href="#/history" aria-label="История">${icon('history')}</a></div>
      <div class="viewer" id="viewer"><video id="video" playsinline muted></video><div class="frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="line"></span></div><p class="hint" id="hint">Насочи камерата към баркода. Дръж телефона на 15–20 см. Докосни, за да фокусира.</p></div>
      <div class="sheet">
        <form class="manual" id="manual"><label for="code" class="sr">Баркод</label><input id="code" inputmode="numeric" autocomplete="off" placeholder="или въведи баркода"><button type="submit">Търси</button></form>
        <a class="btn outline" href="#/photo">${icon('camera')}Няма баркод? Снимай състава</a>
        ${recent.length ? `<div class="recent"><div style="font:700 13px var(--display);color:var(--muted)">Последно</div>${recent.map(h => `<a href="${h.code ? '#/p/' + esc(h.code) : '#/history'}"><span>${esc(h.name)}</span>${pillFor(h)}</a>`).join('')}</div>` : ''}
        <a class="banner" href="#/support"><span><b>Kakvo е 100% независим.</b> Без реклами и без пари от марки.</span><strong>Подкрепи</strong></a>
      </div></div>`, true);
    document.getElementById('manual').addEventListener('submit', e => {
      e.preventDefault(); const c = document.getElementById('code').value.replace(/\D/g, '');
      if (!validCode(c)) return toast('Баркодът трябва да е 8 или 13 цифри.'); found(c);
    });
    startCamera();
  }

  /* Ask for a sharp stream (browsers default to 640×480), continuous autofocus, and a little zoom
     so the phone can be held further away, where its lens can focus. */
  async function openCamera() {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    const track = st.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    const adv = {};
    if (caps.focusMode && caps.focusMode.includes('continuous')) adv.focusMode = 'continuous';
    if (caps.zoom && caps.zoom.max >= 1.5) adv.zoom = Math.min(caps.zoom.max, 2);
    if (Object.keys(adv).length) { try { await track.applyConstraints({ advanced: [adv] }); } catch (e) { /* not supported */ } }
    return { st, track, caps };
  }
  function wireCameraControls(track, caps) {
    const viewer = document.getElementById('viewer'); if (!viewer || !track) return;
    // Tap to refocus
    viewer.addEventListener('click', async e => {
      if (e.target.closest('button')) return;
      if (caps.focusMode && caps.focusMode.includes('single-shot')) { try { await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }); setTimeout(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 1200); } catch (err) { /* ignore */ } }
    });
    if (caps.torch) {
      const b = document.createElement('button'); b.className = 'rbtn darkbtn torch'; b.type = 'button'; b.setAttribute('aria-label', 'Фенерче'); b.textContent = '💡';
      let on = false; b.addEventListener('click', async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); b.classList.toggle('on', on); } catch (err) { /* ignore */ } });
      viewer.appendChild(b);
    }
  }

  async function startCamera() {
    const video = document.getElementById('video'); const hint = document.getElementById('hint');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hint.textContent = 'Камерата не е достъпна тук. Въведи баркода отдолу.'; return; }
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    let native = false;
    if ('BarcodeDetector' in window) { try { const sup = await BarcodeDetector.getSupportedFormats(); native = formats.some(f => sup.includes(f)); } catch (e) { native = false; } }
    try {
      if (native) {
        const cam = await openCamera(); stream = cam.st;
        if (!document.getElementById('video')) return stopCamera();
        video.srcObject = stream; await video.play(); wireCameraControls(cam.track, cam.caps);
        const det = new BarcodeDetector({ formats });
        scanTimer = setInterval(async () => {
          if (video.readyState < 2) return;
          try { const r = await det.detect(video); const hit = r.find(x => validCode(x.rawValue)); if (hit) found(hit.rawValue); } catch (e) { /* frame not ready */ }
        }, 250);
      } else {
        if (!window.ZXingBrowser) await loadScript('vendor/zxing-browser.min.js');
        if (!document.getElementById('video')) return;
        const reader = new ZXingBrowser.BrowserMultiFormatReader();
        const cam = await openCamera(); stream = cam.st;
        if (!document.getElementById('video')) return stopCamera();
        wireCameraControls(cam.track, cam.caps);
        zxingControls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) { const t = result.getText(); if (validCode(t)) found(t); }
        });
      }
    } catch (e) {
      hint.textContent = e && e.name === 'NotAllowedError' ? 'Нямаме достъп до камерата. Разреши го в настройките или въведи баркода.' : 'Камерата не се отвори. Въведи баркода отдолу.';
    }
  }

  /* ---------- history ---------- */
  function viewHistory() {
    const h = store.get('history', []);
    const items = h.map(x => `<a class="card" href="${x.code ? '#/p/' + esc(x.code) : '#/t'}" style="text-decoration:none;color:var(--ink);gap:8px"><b style="font-size:16px">${esc(x.name)}</b><span class="chips" style="gap:6px">${x.warn ? '<span class="pill p-r">Официално предупреждение</span>' : ''}${x.cubes != null ? `<span class="pill p-o">${fmt(x.cubes)} ${x.cubes === 1 ? 'бучка' : 'бучки'} захар</span>` : ''}<span class="pill p-g">${x.nAdd ? x.nAdd + ' добавки' : 'Без добавки'}</span></span></a>`).join('');
    view(`<header class="head">${LEAF}<div class="row"><a class="rbtn" href="#/" aria-label="Назад">${icon('back')}</a>${LOGO}<a class="rbtn" href="#/profiles" aria-label="Профили">${icon('user')}</a></div><h1 style="font-weight:900;font-size:28px">История</h1></header>
      <div class="wrap">${items || '<p style="color:var(--muted)">Още нищо. Сканирай първия си продукт.</p>'}
      ${isSupporter() ? '' : `<a class="banner" href="#/support" style="background:var(--supbg)"><span>Безплатно пазим последните ${FREE_HISTORY}. С подкрепата: цялата история.</span>${SUP}</a>`}
      ${h.length ? '<button class="btn ghost" id="clear">Изтрий историята</button>' : ''}</div><div class="foot">Историята се пази само на твоя телефон.</div>`);
    const c = document.getElementById('clear'); if (c) c.addEventListener('click', () => { store.set('history', []); viewHistory(); });
  }

  /* ---------- profiles & avoid list (supporters) ---------- */
  function viewProfiles() {
    if (!isSupporter()) return view(`<div class="topbar"><a class="rbtn soft" href="#/history" aria-label="Назад">${icon('back')}</a><b>Профили</b></div>` + upsell('Профили и списък „избягвам“', 'Профил за всеки в семейството. Всеки си прави списък с неща за избягване и Kakvo ги търси в състава.'));
    const ps = profiles(); const act = activeProfile();
    const PRESETS = Object.keys(E.AVOID_RULES);
    view(`<div class="topbar"><a class="rbtn soft" href="#/history" aria-label="Назад">${icon('back')}</a><b>Профили</b></div>
      <div class="wrap"><h2>Семейството</h2>
      <div class="chips">${ps.map(p => `<button class="pillbtn" data-p="${esc(p.id)}" style="${p.id === act.id ? 'background:var(--g);color:#FFFFFF;border-color:var(--g)' : ''}">${esc(p.name)}${p.kid ? ' · дете' : ''}</button>`).join('')}<button class="pillbtn" id="addp">+ Добави</button></div>
      <div class="card"><div class="field"><label for="pn">Име на профила</label><input id="pn" value="${esc(act.name)}" maxlength="24"></div></div>
      <div class="card"><h2>${esc(act.name)} избягва</h2>
        <div class="chips">${PRESETS.map(x => `<button class="pillbtn" data-av="${esc(x)}" style="${act.avoid.includes(x) ? 'background:var(--ink);color:#FFFFFF;border-color:var(--ink)' : ''}">${esc(x)}</button>`).join('')}
        ${act.avoid.filter(x => !PRESETS.includes(x)).map(x => `<button class="pillbtn" data-av="${esc(x)}" style="background:var(--ink);color:#FFFFFF;border-color:var(--ink)">${esc(x)} ✕</button>`).join('')}</div>
        <form class="manual" id="ownf"><label for="own" class="sr">Добави свое</label><input id="own" placeholder="напр. фъстъци, сусам, мед"><button type="submit">Добави</button></form>
        <div class="note"><b>При алергия винаги чети етикета.</b> Данните за продуктите се попълват от хора и може да има грешки. Kakvo помага, но не гарантира.</div></div>
      <div class="card"><h2>Как обясняваме на ${esc(act.name)}</h2><div class="seg light"><button data-kid="0" class="${act.kid ? '' : 'on'}">За възрастен</button><button data-kid="1" class="${act.kid ? 'on' : ''}">За дете</button></div></div>
      ${act.id !== 'me' ? '<button class="btn ghost" id="delp">Изтрий профила</button>' : ''}</div><div class="foot"></div>`);
    const save = list => { store.set('profiles', list); viewProfiles(); };
    document.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { store.set('activeProfile', b.dataset.p); viewProfiles(); }));
    document.getElementById('addp').addEventListener('click', () => {
      const id = 'p' + Date.now(); const list = profiles(); list.push({ id, name: 'Член ' + list.length, kid: true, avoid: [] }); store.set('activeProfile', id); save(list);
    });
    document.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      const list = profiles(); const p = list.find(x => x.id === act.id); const v = b.dataset.av;
      p.avoid = p.avoid.includes(v) ? p.avoid.filter(x => x !== v) : p.avoid.concat(v); save(list);
    }));
    document.getElementById('ownf').addEventListener('submit', e => { e.preventDefault(); const v = document.getElementById('own').value.trim(); if (!v) return; const list = profiles(); const p = list.find(x => x.id === act.id); v.split(',').map(s => s.trim()).filter(Boolean).forEach(s => { if (!p.avoid.includes(s)) p.avoid.push(s); }); save(list); });
    document.querySelectorAll('[data-kid]').forEach(b => b.addEventListener('click', () => { const list = profiles(); list.find(x => x.id === act.id).kid = b.dataset.kid === '1'; save(list); }));
    document.getElementById('pn').addEventListener('change', e => { const v = e.target.value.trim(); if (!v) return; const list = profiles(); list.find(x => x.id === act.id).name = v; save(list); });
    const d = document.getElementById('delp'); if (d) d.addEventListener('click', () => { store.set('activeProfile', 'me'); save(profiles().filter(x => x.id !== act.id)); });
  }

  /* ---------- support (paid plan) ---------- */
  function viewSupport() {
    const F = ['Профил за всеки в семейството + твой списък „избягвам“', 'Захар на порция, не само на 100 г', 'Обяснението, прочетено на глас', 'Режим „За дете“ с най-простите думи', 'Колко изяде или изпи: захар и наситени мазнини за точното количество', 'Цялата история, не само последните 20', 'Работи и без интернет за често сканирани продукти (скоро)', 'Първи пробваш скенера за козметика (скоро)', 'Лесни рецепти с по-малко захар (скоро)'];
    const tick = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#E6F1E7"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#246B2A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const promise = (svg, t) => `<div class="card promise">${svg}<span>${t}</span></div>`;
    view(`<div class="support"><div class="topbar" style="justify-content:space-between">${LOGO}<a class="rbtn" href="#/" aria-label="Затвори" style="background:var(--gdk);color:#FFFFFF">${icon('close')}</a></div>
      <div style="padding:16px 24px 20px;text-align:center;display:flex;flex-direction:column;gap:6px"><span style="font:700 22px var(--display)">Подкрепи проект, който е</span><span style="font:900 34px/1 var(--display);letter-spacing:-0.02em">100% НЕЗАВИСИМ</span></div>
      <div style="padding:0 18px;display:flex;flex-direction:column;gap:12px">
        ${promise('<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#FFF3E8"/><circle cx="25" cy="34" r="13" fill="#F2B35E" stroke="#9A4A0C" stroke-width="2"/><text x="25" y="39" text-anchor="middle" font-family="Geologica" font-weight="800" font-size="15" fill="#9A4A0C">€</text><path d="M37 20l14 14M51 20L37 34" stroke="#B02C1B" stroke-width="4" stroke-linecap="round"/></svg>', 'Без пари от марки и производители на храни')}
        ${promise('<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#E6F1E7"/><rect x="18" y="14" width="24" height="32" rx="3" fill="#FFF" stroke="#246B2A" stroke-width="2"/><path d="M23 22h14M23 28h14M23 34h9" stroke="#246B2A" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="40" r="8" fill="#FFF" stroke="#1D2A1F" stroke-width="3"/><path d="M46 46l6 6" stroke="#1D2A1F" stroke-width="4" stroke-linecap="round"/></svg>', 'Обясняваме само с официални източници: регламенти на ЕС, EFSA, СЗО')}
        ${promise('<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#FDF6D8"/><path d="M32 46s-14-8-14-18a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 18-14 18z" fill="#E8771E"/></svg>', 'Без реклами. Издържа се от хората, които го използват')}
        <div class="card"><span style="font:900 18px var(--display)">С подкрепата получаваш</span><ul>${F.map(f => `<li>${tick}<span>${esc(f)}</span></li>`).join('')}</ul>
          <span style="font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px">Безплатно завинаги: сканиране, обяснение, бучки захар на 100 г, споделяне.</span></div>
        ${isSupporter() ? '<div class="card" style="background:var(--gbg)"><b>Благодарим! Подкрепата е активна на този телефон.</b></div>' : `<button class="btn amber" id="pay">Подкрепи Kakvo · ${esc(CFG.PRICE_LABEL || '19,99 € на година')}</button>`}
        <a class="btn ghost" href="#/" style="color:#FFFFFF">Продължи безплатно</a>
      </div></div>`);
    const pay = document.getElementById('pay');
    if (pay) pay.addEventListener('click', () => { if (CFG.SUPPORT_URL) location.href = CFG.SUPPORT_URL; else toast('Плащането стартира скоро. Благодарим за интереса!'); });
  }

  /* ---------- sharing ---------- */
  function productUrl(code) { return location.origin + location.pathname + '#/p/' + encodeURIComponent(code); }
  function shareSheet(d) {
    const kidLine = d.kid ? '' : '';
    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Сподели');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(29,42,31,0.55)';
    const canLink = !!d.code;
    sheet.innerHTML = `<div style="background:#FFF;border-radius:26px 26px 0 0;padding:16px 16px calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px;max-width:520px;width:100%;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Сподели</h2><button class="btn ghost" id="sh-x" style="width:auto">Готово</button></div>
      <div class="card" style="gap:6px"><b>${esc(d.title)}</b><span style="font-size:14px;color:var(--muted)">${esc(d.text)}</span>${canLink ? `<span class="src">${esc(productUrl(d.code))}</span>` : '<span class="src">Продукт от снимка: споделяме само текста.</span>'}</div>
      <button class="btn green" id="sh-link">${icon('share')}${canLink ? 'Изпрати линк' : 'Изпрати текста'}</button>
      ${d.nut && d.nut.sugar != null ? `<button class="btn outline" id="sh-story">${icon('story')}Картинка за Instagram история</button>` : ''}
      ${canLink ? '<button class="btn ghost" id="sh-copy">Копирай линка</button>' : ''}
      <p class="src" style="margin:0">За Instagram: линкът се копира сам. В историята добави стикер „Линк“ и го постави там.</p>${kidLine}</div>`;
    document.body.appendChild(sheet);
    const close = () => sheet.remove();
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    sheet.querySelector('#sh-x').addEventListener('click', close);
    const text = `${d.title}: ${d.text}`;
    sheet.querySelector('#sh-link').addEventListener('click', async () => {
      const payload = canLink ? { title: d.title + ' · Kakvo', text, url: productUrl(d.code) } : { title: d.title + ' · Kakvo', text };
      if (navigator.share) { try { await navigator.share(payload); close(); } catch (e) { /* cancelled */ } } else copy((canLink ? productUrl(d.code) + '\n' : '') + text);
    });
    const cp = sheet.querySelector('#sh-copy'); if (cp) cp.addEventListener('click', () => copy(productUrl(d.code)));
    const st = sheet.querySelector('#sh-story'); if (st) st.addEventListener('click', () => storyImage(d));
  }
  async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Копирано'); } catch (e) { toast('Не успяхме да копираме.'); } }

  async function storyImage(d) {
    if (d.code) copy(productUrl(d.code));
    try { await document.fonts.load('900 100px Geologica'); await document.fonts.load('600 40px Onest'); } catch (e) { /* fallback fonts */ }
    const W = 1080, H = 1920; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#246B2A'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2F7D36'; x.beginPath(); x.moveTo(1060, 60); x.bezierCurveTo(700, 60, 560, 300, 560, 620); x.bezierCurveTo(880, 620, 1060, 400, 1060, 60); x.fill();
    x.fillStyle = '#FFFFFF'; x.font = '900 64px Geologica, sans-serif'; x.fillText('Kakvo', 80, 180); x.fillStyle = '#F2B35E'; x.fillText('.', 80 + x.measureText('Kakvo').width, 180);
    x.fillStyle = '#FFFFFF'; x.font = '700 52px Onest, sans-serif'; wrapText(x, d.title, 80, 320, 920, 64, 2);
    const cubes = E.cubes(d.nut.sugar);
    x.fillStyle = '#F2B35E'; x.font = '900 380px Geologica, sans-serif'; x.fillText(fmt(cubes), 70, 790);
    x.fillStyle = '#FFFFFF'; x.font = '900 92px Geologica, sans-serif'; x.fillText(cubes === 1 ? 'бучка захар' : 'бучки захар', 80, 930); x.fillText(`в 100 ${d.kind === 'drink' ? 'мл' : 'грама'}`, 80, 1040);
    x.fillStyle = '#FFF3E8'; roundRect(x, 80, 1110, 920, 220, 40); x.fill();
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CUBE(120).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    await new Promise(r => { img.onload = r; img.onerror = r; });
    for (let i = 0; i < Math.min(6, Math.ceil(cubes)); i++) x.drawImage(img, 120 + i * 140, 1160, 120, 125);
    x.fillStyle = '#D5E8D6'; x.font = '500 44px Onest, sans-serif'; wrapText(x, d.res.add.size ? `+ ${d.res.add.size} добавки, обяснени с прости думи в Kakvo.` : 'Без добавки с Е-номер.', 80, 1450, 920, 60, 3);
    x.strokeStyle = '#D5E8D6'; x.setLineDash([14, 12]); x.lineWidth = 4; roundRect(x, 240, 1680, 600, 110, 55); x.stroke();
    x.setLineDash([]); x.fillStyle = '#D5E8D6'; x.font = '600 36px Onest, sans-serif'; x.textAlign = 'center'; x.fillText('място за стикер „Линк“', 540, 1748);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'kakvo-story.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Kakvo' }); return; } catch (e) { /* cancelled */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kakvo-story.png'; document.body.appendChild(a); a.click(); a.remove();
    toast('Картинката е запазена. Линкът е копиран.');
  }
  function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function wrapText(x, text, X, Y, maxW, lh, maxLines) {
    const words = String(text).split(' '); let line = '', n = 0;
    for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { x.fillText(line, X, Y + n * lh); n++; line = w; if (n >= maxLines) return; } else line = t; }
    if (line && n < maxLines) x.fillText(line, X, Y + n * lh);
  }

  /* ---------- router ---------- */
  function route() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, query] = h.split('?'); const qs = new URLSearchParams(query || '');
    let m;
    if (path === '/' || path === '') return viewScan();
    if ((m = /^\/p\/(\d{6,14})$/.exec(path))) return viewProduct(m[1], false, qs.get('db') === '1');
    if ((m = /^\/k\/(\d{6,14})$/.exec(path))) return viewProduct(m[1], true, qs.get('db') === '1');
    if ((m = /^\/a\/([A-Z0-9]+)$/.exec(path))) return viewAdditive(m[1], qs.get('from'), qs.get('c'), qs.get('l'));
    if ((m = /^\/i\/([a-z0-9-]+)$/.exec(path))) return viewIngredient(m[1], qs.get('from'), qs.get('l'));
    if ((m = /^\/notfound\/(\d+)$/.exec(path))) return viewNotFound(m[1]);
    if (path === '/photo') return viewPhoto(qs.get('m'), qs.get('pair'));
    if (path === '/n') return viewNut();
    if (path === '/nutask') return viewNutAsk();
    if (path === '/crop') return viewCrop();
    if (path === '/type') return viewType();
    if (path === '/t') return viewText();
    if (path === '/history') return viewHistory();
    if (path === '/profiles') return viewProfiles();
    if (path === '/support') return viewSupport();
    return viewScan();
  }

  async function boot() {
    try {
      const [r, x] = await Promise.all([fetch('data/library.json'), fetch('data/explain.json').catch(() => null)]);
      DB = await r.json();
      let EX = null; try { EX = x && x.ok ? await x.json() : null; } catch (e) { EX = null; }
      E = KakvoEngine.createEngine(DB, EX);
    } catch (e) { app.innerHTML = '<div class="center"><h1>Kakvo не се зареди</h1><p>Провери интернета и опитай пак.</p></div>'; return; }
    window.addEventListener('hashchange', route);
    route();
    setTimeout(flushOutbox, 4000);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
  }
  boot();
})();
