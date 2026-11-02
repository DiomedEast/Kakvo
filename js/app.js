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
  const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
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
  const OFF_FIELDS = 'code,product_name,product_name_bg,brands,quantity,ingredients_text_bg,ingredients,additives_tags,nutriments,serving_quantity,serving_size,categories_tags,image_front_small_url,allergens_tags,traces_tags';
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
  function remember(item) {
    let h = store.get('history', []).filter(x => x.key !== item.key);
    h.unshift(Object.assign({ ts: Date.now() }, item));
    h = h.slice(0, isSupporter() ? 500 : FREE_HISTORY);
    store.set('history', h);
  }
  const profiles = () => store.get('profiles', [{ id: 'me', name: 'Аз', kid: false, avoid: [] }]);
  const activeProfile = () => { const ps = profiles(); return ps.find(p => p.id === store.get('activeProfile', 'me')) || ps[0]; };

  /* ---------- product rendering (shared by barcode and text results) ---------- */
  function tilesHtml(nut, kind) {
    const unit = kind === 'drink' ? 'мл' : 'г';
    const rows = [['sugar', 'Захари'], ['sat', 'Наситени'], ['salt', 'Сол']];
    if (rows.every(([k]) => nut[k] == null)) return `<div class="note">Няма данни за хранителната стойност. ${''}Можеш да ги добавиш в Open Food Facts от линка най-долу.</div>`;
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
    for (const x of res.ing.values()) { const g = x.g === 'palm' || x.g === 'trans' ? 'fat' : x.g; (groups[g] = groups[g] || []).push(x.bg); }
    const order = ['grain', 'sugar', 'fat', 'cocoa', 'dairy', 'other'];
    const chips = order.filter(g => groups[g]).map(g => `<span class="chip g-${g}"><span class="dot"></span>${LABEL[g]}: ${esc(groups[g].slice(0, 4).join(', '))}${groups[g].length > 4 ? ' и още ' + (groups[g].length - 4) : ''}</span>`).join('');
    const unk = res.unk.length ? `<span class="chip g-unk">Още ${res.unk.length} без обяснение</span>` : '';
    return chips || unk ? `<div style="display:flex;flex-direction:column;gap:10px"><h2>Съставът по групи</h2><div class="chips">${chips}${unk}</div></div>` : '';
  }

  function additivesHtml(res, back) {
    if (!res.add.size) return '';
    const rows = [...res.add.keys()].sort((a, b) => !!E.additiveInfo(b).flag - !!E.additiveInfo(a).flag).map(c => {
      const a = E.additiveInfo(c);
      const line = a.roles[0] ? a.roles[0].split(':').slice(1).join(':').trim() || a.roles[0] : (a.known ? 'Ролята ѝ още не е описана в Kakvo.' : 'Тази добавка още не е в нашата база.');
      const cap = a.name.charAt(0).toUpperCase() + a.name.slice(1);
      return `<a class="addrow ${a.flag && a.flag.level === 'warn' ? 'warn' : ''}" href="#/a/${encodeURIComponent(c)}?from=${encodeURIComponent(back)}"><span class="code">${c === 'E14X' ? 'E14xx' : c}</span><span><b>${esc(cap)}</b><small>${esc(line.charAt(0).toUpperCase() + line.slice(1))}</small></span>${icon('chev', 18, 2)}</a>`;
    }).join('');
    return `<div style="display:flex;flex-direction:column"><h2>Добавки (${res.add.size})</h2>${rows}</div>`;
  }

  function labelHtml(text, res) {
    if (!text) return '';
    let html = '', pos = 0;
    for (const s of res.spans.slice().sort((a, b) => a.start - b.start)) { html += esc(text.slice(pos, s.start)) + `<span class="k-${s.kind}">${esc(text.slice(s.start, s.end))}</span>`; pos = s.end; }
    html += esc(text.slice(pos));
    return `<div style="display:flex;flex-direction:column;gap:10px"><h2>Целият състав</h2><p class="label">${html}</p></div>`;
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
    const all = opts.allergens && opts.allergens.length ? `<div style="font-size:14px;color:var(--muted)">Алергени по данни: ${esc(opts.allergens.join(', '))}${opts.traces && opts.traces.length ? '. Може да съдържа: ' + esc(opts.traces.join(', ')) : ''}. Винаги проверявай етикета.</div>` : '';
    return `<div class="wrap">
      <p class="lead">${esc(E.summary(res, nut, kind))}</p>
      <button class="pillbtn" id="listen">${icon('speaker', 18)}Слушай обяснението ${isSupporter() ? '' : SUP}</button>
      ${avoidHtml(res, opts.text)}
      ${tilesHtml(nut, kind)}
      ${sugarHtml(nut, kind, opts.serving)}
      ${calcHtml(nut, kind)}
      ${flags.length ? '<div style="display:flex;flex-direction:column;gap:10px"><h2>Важно да знаеш</h2>' + flags.map(flagHtml).join('') + '</div>' : ''}
      ${groupsHtml(res)}
      ${additivesHtml(res, opts.back)}
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
  async function viewProduct(code, kidMode) {
    view(`<div class="center"><div class="spinner" aria-hidden="true"></div><p>Търсим продукта…</p></div>`);
    let p;
    try { p = await fetchProduct(code); } catch (e) {
      return view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Назад">${icon('back')}</a></div><div class="center"><h1 style="font-size:24px">Няма връзка</h1><p>Не успяхме да стигнем до базата с продукти. Провери интернета и опитай пак.</p><button class="btn green" onclick="location.reload()">Опитай пак</button><a class="btn ghost" href="#/type">Напиши състава ръчно</a></div>`);
    }
    if (!p) { session.set('pendingCode', code); return go('#/notfound/' + encodeURIComponent(code)); }
    const res = E.analyseProduct(p); const nut = nutOf(p); const kind = isDrink(p) ? 'drink' : 'food';
    const name = p.product_name_bg || p.product_name || 'Продукт ' + code;
    const meta = [p.brands, p.quantity].filter(Boolean).join(' · ');
    const shareData = { title: name, code, nut, kind, res, text: E.summary(res, nut, kind) };
    remember({ key: code, code, name, cubes: nut.sugar != null ? E.cubes(nut.sugar) : null, nAdd: res.add.size, warn: E.flagsFor(res).some(f => f.level === 'warn') });
    const top = header({ title: name, meta, img: p.image_front_small_url, back: '#/', toggle: { me: '#/p/' + code, kid: '#/k/' + code, on: kidMode ? 'kid' : 'me' } });
    if (kidMode) return renderKid(top, res, nut, kind, shareData);
    view(top + productBody(res, nut, kind, { text: p.ingredients_text_bg, serving: +p.serving_quantity || null, code, back: '#/p/' + code, allergens: allergens(p.allergens_tags), traces: allergens(p.traces_tags) }));
    wireProduct(res, nut, kind, shareData);
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

  function viewAdditive(code, back) {
    const a = E.additiveInfo(code);
    const roles = a.roles.length ? a.roles.map(r => `<p class="lead" style="margin:0">${esc(r)}</p>`).join('') : `<p class="lead">${a.known ? 'Ролята ѝ още не е описана в Kakvo.' : 'Тази добавка още не е в нашата база.'}</p>`;
    view(`<header class="head">${LEAF}<div class="row"><a class="rbtn" href="${esc(back || '#/')}" aria-label="Назад">${icon('back')}</a>${LOGO}<span style="width:44px"></span></div>
      <span style="align-self:flex-start;font-weight:800;font-size:15px;background:#FFFFFF;color:var(--g);padding:6px 12px;border-radius:10px">${code === 'E14X' ? 'E14xx' : esc(code)}</span>
      <h1 style="font-weight:900;font-size:30px;line-height:1.05">${esc(a.name.charAt(0).toUpperCase() + a.name.slice(1))}</h1>${a.en ? `<div class="meta">${esc(a.en)}</div>` : ''}</header>
      <div class="wrap">${roles}
      ${a.pct != null ? `<div class="card" style="flex-direction:row;align-items:baseline;gap:8px"><span style="font-family:var(--display);font-weight:900;font-size:24px">${a.pct >= 1 ? Math.round(a.pct) + '%' : '&lt;1%'}</span><span style="font-size:15px">от продуктите със състав в България я съдържат (данни Open Food Facts).</span></div>` : ''}
      ${a.flag ? flagHtml(a.flag) : ''}
      <div class="note">Всяка добавка с Е-номер е оценена и разрешена в ЕС за определени храни и количества. Kakvo показва предупреждения само когато има официален източник.</div>
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
    remember({ key: 't:' + d.text.slice(0, 60), name: d.name || 'Продукт от снимка', text: true, cubes: nut.sugar != null ? E.cubes(nut.sugar) : null, nAdd: res.add.size, warn: E.flagsFor(res).some(f => f.level === 'warn') });
    const shareData = { title: d.name || 'Продукт', nut, kind, res, text: E.summary(res, nut, kind) };
    view(header({ title: d.name || 'Твоят продукт', meta: 'От снимка или ръчно написан състав', back: '#/type' }) + productBody(res, nut, kind, { text: d.text, back: '#/t' }));
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
    const prev = session.get('text') || {};
    const text = prefill != null ? prefill : (prev.text || '');
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>Напиши съставките</b></div>
      <div class="wrap"><p style="margin:0;color:var(--muted)">Препиши ги от опаковката. Не е нужно да са перфектни: разпознаваме и Е-номера.</p>
      <div class="field"><label for="pname">Име на продукта (по желание)</label><input id="pname" value="${esc(prev.name || '')}" placeholder="напр. бисквити"></div>
      <div class="field"><label for="typed">Съставки</label><textarea id="typed" class="box" placeholder="напр. брашно, захар, палмово масло, Е322…">${esc(text)}</textarea></div>
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
      const n = readNut(); session.set('text', { text: ta.value, name: document.getElementById('pname').value.trim(), nut: n.nut, kind: n.kind });
      go('#/t');
    });
  }

  /* ---------- photo + OCR ---------- */
  function viewPhoto() {
    view(`<div class="topbar"><a class="rbtn soft" href="#/" aria-label="Затвори">${icon('close')}</a><b>Снимай състава</b></div>
      <div class="wrap"><h1 style="font-size:25px;font-weight:900">Снимай състава на гърба</h1>
      <p style="margin:0;color:var(--muted)">Ще го прочетем и ще ти покажем какво сме прочели, преди да го обясним.</p>
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
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
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

  async function handlePhoto(file) {
    view(`<div class="center"><div class="spinner" aria-hidden="true"></div><p id="ocrmsg">Проверяваме снимката…</p></div>`);
    let canvas; try { canvas = await loadImage(file); } catch (e) { toast('Не успяхме да отворим снимката.'); return go('#/photo'); }
    const sharp = sharpness(canvas);
    if (sharp < (CFG.BLUR_THRESHOLD || 60)) return viewBlur();
    try {
      document.getElementById('ocrmsg').textContent = 'Четем състава… Първия път отнема около минута.';
      if (!window.Tesseract) await loadScript(CFG.TESSERACT_URL);
      const worker = await Tesseract.createWorker('bul', 1, { logger: m => { const el = document.getElementById('ocrmsg'); if (el && m.status === 'recognizing text') el.textContent = 'Четем състава… ' + Math.round(m.progress * 100) + '%'; } });
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      await worker.terminate();
      const words = [];
      (data.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => { l.words.forEach(w => words.push({ t: w.text, c: w.confidence })); words.push({ t: '\n' }); })));
      if (!words.filter(w => w.t !== '\n').length) return viewBlur('Не намерихме текст на снимката.');
      session.set('ocr', words);
      viewReview(words);
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

  function viewReview(words) {
    const LOW = CFG.UNSURE_CONFIDENCE || 70;
    const fixes = [];
    const html = words.map((w, i) => {
      if (w.t === '\n') return ' ';
      const sug = w.c < LOW ? E.suggest(w.t) : null;
      if (w.c < LOW) { if (sug) fixes.push({ i, from: w.t, to: sug }); return `<span class="unsure" data-i="${i}">${esc(w.t)}</span> `; }
      return esc(w.t) + ' ';
    }).join('');
    const unsureCount = words.filter(w => w.t !== '\n' && w.c < LOW).length;
    view(`<div class="topbar"><a class="rbtn soft" href="#/photo" aria-label="Назад">${icon('back')}</a><b>Провери какво прочетохме</b></div>
      <div class="wrap"><ol class="steps" style="padding:0"><li class="done"><span></span>1 Снимка</li><li class="cur"><span></span>2 Провери текста</li><li><span></span>3 Обяснение</li></ol>
      <p style="margin:0;color:var(--muted)">Подчертаните думи са тези, в които не сме сигурни.</p>
      <p class="label" id="read">${html}</p>
      ${unsureCount ? `<div style="font-size:14px;color:var(--org);font-weight:700">${unsureCount} ${unsureCount === 1 ? 'дума' : 'думи'} за проверка</div>` : ''}
      ${fixes.length ? `<div class="chips">${fixes.map((f, k) => `<button class="chip-btn pillbtn" style="border-color:var(--orgbar)" data-fix="${k}"><s style="color:var(--muted)">${esc(f.from)}</s> → <b>${esc(f.to)}</b></button>`).join('')}</div>` : ''}
      <div class="field"><label for="edit">Поправи, ако нещо е грешно</label><textarea id="edit" class="box">${esc(words.map(w => w.t === '\n' ? '\n' : w.t).join(' ').replace(/ \n /g, '\n').trim())}</textarea></div>
      ${nutFields()}
      <button class="btn green" id="explain">Обясни състава</button>
      <div class="grid2"><a class="btn outline" href="#/photo" style="min-height:46px;font-size:14px">Снимай отново</a><a class="btn outline" href="#/type" style="min-height:46px;font-size:14px">Напиши сам</a></div></div><div class="foot"></div>`);
    wireKind();
    const ta = document.getElementById('edit');
    document.querySelectorAll('[data-fix]').forEach(b => b.addEventListener('click', () => {
      const f = fixes[+b.dataset.fix]; ta.value = ta.value.replace(f.from, f.to);
      const span = document.querySelector(`[data-i="${f.i}"]`); if (span) { span.textContent = f.to; span.classList.remove('unsure'); }
      b.remove();
    }));
    document.getElementById('explain').addEventListener('click', () => {
      const n = readNut(); session.set('text', { text: ta.value, name: '', nut: n.nut, kind: n.kind }); go('#/t');
    });
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
    const recent = store.get('history', []).slice(0, 3);
    const pillFor = h => h.warn ? '<span class="pill p-r">за внимание</span>' : h.cubes != null ? `<span class="pill p-o">${fmt(h.cubes)} ${h.cubes === 1 ? 'бучка' : 'бучки'}</span>` : `<span class="pill p-g">${h.nAdd} добавки</span>`;
    view(`<div class="scan"><div class="top">${LOGO}<a class="rbtn darkbtn" href="#/history" aria-label="История">${icon('history')}</a></div>
      <div class="viewer" id="viewer"><video id="video" playsinline muted></video><div class="frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="line"></span></div><p class="hint" id="hint">Насочи камерата към баркода на продукта</p></div>
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

  async function startCamera() {
    const video = document.getElementById('video'); const hint = document.getElementById('hint');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hint.textContent = 'Камерата не е достъпна тук. Въведи баркода отдолу.'; return; }
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    let native = false;
    if ('BarcodeDetector' in window) { try { const sup = await BarcodeDetector.getSupportedFormats(); native = formats.some(f => sup.includes(f)); } catch (e) { native = false; } }
    try {
      if (native) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!document.getElementById('video')) return stopCamera();
        video.srcObject = stream; await video.play();
        const det = new BarcodeDetector({ formats });
        scanTimer = setInterval(async () => {
          if (video.readyState < 2) return;
          try { const r = await det.detect(video); const hit = r.find(x => validCode(x.rawValue)); if (hit) found(hit.rawValue); } catch (e) { /* frame not ready */ }
        }, 250);
      } else {
        if (!window.ZXingBrowser) await loadScript('vendor/zxing-browser.min.js');
        if (!document.getElementById('video')) return;
        const reader = new ZXingBrowser.BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (result) => {
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
    if ((m = /^\/p\/(\d{6,14})$/.exec(path))) return viewProduct(m[1], false);
    if ((m = /^\/k\/(\d{6,14})$/.exec(path))) return viewProduct(m[1], true);
    if ((m = /^\/a\/([A-Z0-9]+)$/.exec(path))) return viewAdditive(m[1], qs.get('from'));
    if ((m = /^\/notfound\/(\d+)$/.exec(path))) return viewNotFound(m[1]);
    if (path === '/photo') return viewPhoto();
    if (path === '/type') return viewType();
    if (path === '/t') return viewText();
    if (path === '/history') return viewHistory();
    if (path === '/profiles') return viewProfiles();
    if (path === '/support') return viewSupport();
    return viewScan();
  }

  async function boot() {
    try {
      const r = await fetch('data/library.json'); DB = await r.json(); E = KakvoEngine.createEngine(DB);
    } catch (e) { app.innerHTML = '<div class="center"><h1>Kakvo не се зареди</h1><p>Провери интернета и опитай пак.</p></div>'; return; }
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
  }
  boot();
})();
