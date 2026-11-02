/* Kakvo explanation engine.
 * Works in the browser (window.KakvoEngine) and in Node (module.exports) for tests.
 * Facts used here come from: the ingredient library (Open Food Facts, ODbL),
 * EU regulations and WHO statements linked in FLAGS. Nothing else.
 */
(function (root) {
  'use strict';

  const SRC = {
    r1333: { t: 'Регламент (ЕО) № 1333/2008, Приложение V', u: 'https://eur-lex.europa.eu/legal-content/BG/TXT/?uri=CELEX:32008R1333' },
    r1169: { t: 'Регламент (ЕС) № 1169/2011', u: 'https://eur-lex.europa.eu/legal-content/BG/TXT/?uri=CELEX:32011R1169' },
    r2022: { t: 'Регламент (ЕС) 2022/63', u: 'https://eur-lex.europa.eu/eli/reg/2022/63/oj' },
    efsa171: { t: 'EFSA, 6 май 2021', u: 'https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive' },
    who951: { t: 'СЗО, 14 юли 2023', u: 'https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released' },
    r2019: { t: 'Регламент (ЕС) 2019/649', u: 'https://eur-lex.europa.eu/eli/reg/2019/649/oj' },
    fsa: { t: 'Критерии за цветно етикетиране (Великобритания)', u: 'https://www.gov.scot/publications/supporting-healthy-choices-framework-voluntary-action/pages/13/' }
  };

  const SOUTH = { id: 'south', level: 'warn', title: 'Задължително предупреждение за деца',
    text: 'По закон в ЕС храна с тези оцветители трябва да носи надпис, че те могат да имат неблагоприятно въздействие върху активността и вниманието на децата.', src: [SRC.r1333] };
  const POLYOL = { id: 'polyol', level: 'info', title: 'Полиол (захарен алкохол)',
    text: 'Ако продуктът съдържа над 10% добавени полиоли, етикетът трябва да предупреждава, че прекомерната консумация може да има слабително действие.', src: [SRC.r1169] };
  const FLAGS = {};
  ['E102', 'E104', 'E110', 'E122', 'E124', 'E129'].forEach(c => { FLAGS[c] = SOUTH; });
  ['E420', 'E421', 'E953', 'E965', 'E966', 'E967', 'E968'].forEach(c => { FLAGS[c] = POLYOL; });
  FLAGS.E171 = { id: 'e171', level: 'warn', title: 'Забранен в храни в ЕС',
    text: 'Титановият диоксид е забранен като добавка в храни от 7 август 2022 г. През 2021 г. EFSA заключи, че вече не може да се счита за безопасен.', src: [SRC.r2022, SRC.efsa171] };
  FLAGS.E951 = { id: 'e951', level: 'info', title: 'Аспартам: какво казва СЗО',
    text: 'През 2023 г. агенцията за рака към СЗО (IARC) го класифицира като „възможно канцерогенен“ (група 2B) поради ограничени доказателства. Експертният комитет на СЗО и ФАО (JECFA) запази безопасния дневен прием: 40 мг на кг телесно тегло. Съдържа фенилаланин, важен за хора с фенилкетонурия.', src: [SRC.who951] };
  const TRANS = { id: 'trans', level: 'info', title: 'Частично хидрогенирана мазнина',
    text: 'Това е основният източник на изкуствени транс-мазнини. В ЕС те са ограничени до 2 г на 100 г мазнина в храната.', src: [SRC.r2019] };

  const ROLE = {
    raising: 'Набухвател: прави тестото пухкаво, като отделя газ при печене.',
    acidity: 'Регулатор на киселинност: държи вкуса и киселинността постоянни.',
    stabiliser: 'Стабилизатор: пази продукта да не се разслоява и да запази формата си.',
    emulsifier: 'Емулгатор: помага мазнина и вода да се смесят, вместо да се разделят.',
    thickener: 'Сгъстител: прави продукта по-гъст.',
    preservative: 'Консервант: забавя развалянето от бактерии и плесени.',
    colour: 'Оцветител: дава или подсилва цвета на продукта.',
    sequestrant: 'Свързва металите във водата и храната, за да не развалят вкуса и цвета.',
    antioxidant: 'Антиоксидант: пази мазнините и цвета от въздуха, за да не гранясат.',
    humectant: 'Овлажнител: задържа влагата, за да не изсъхне продуктът.',
    sweetener: 'Подсладител: дава сладък вкус с малко или никакви калории.',
    carrier: 'Носител: помага на други добавки да се разпределят равномерно.',
    'propellent-gas': 'Газ: прави напитката газирана или пази продукта в опаковката.',
    coagulant: 'Коагулант: помага течността да се сгъсти.',
    'flavour-enhancer': 'Овкусител: засилва вкуса, особено соления и месния.'
  };
  const KID_ROLE = {
    raising: 'прави малки балончета, когато тестото се пече. Така става пухкаво.',
    emulsifier: 'помага на маслото и водата да се хванат за ръце, вместо да се разделят.',
    stabiliser: 'пази храната да не се разпада.', thickener: 'прави храната по-гъста.',
    preservative: 'пази храната да не се развали бързо.', antioxidant: 'пази мазнината да не се развали от въздуха.',
    colour: 'дава цвят на храната.', sweetener: 'прави храната сладка без захар.',
    acidity: 'пази вкуса еднакъв.', 'flavour-enhancer': 'прави вкуса по-силен.',
    humectant: 'пази храната мека.', 'propellent-gas': 'прави мехурчетата в напитката.'
  };
  const PURPOSE = { emulsifier: 'текстура', stabiliser: 'текстура', thickener: 'текстура', preservative: 'по-дълъг срок', antioxidant: 'по-дълъг срок',
    colour: 'цвят', sweetener: 'сладък вкус', raising: 'пухкаво тесто', acidity: 'вкус', 'flavour-enhancer': 'по-силен вкус', humectant: 'мекота', 'propellent-gas': 'газ' };

  const ALIAS = {
    'сода бикарбонат': 'E500', 'натриев бикарбонат': 'E500', 'сода за хляб': 'E500',
    'амониев бикарбонат': 'E503', 'амонячна сода': 'E503', 'амониев хидроген карбонат': 'E503',
    'соев лецитин': 'E322', 'слънчогледов лецитин': 'E322', 'лецитин': 'E322', 'лецитини': 'E322',
    'карбоксиметил целулоза': 'E466', 'натриев стеароил 2 лактилат': 'E481', 'натриев стеароил-2-лактилат': 'E481',
    'полиглицеролови естери на мастните киселини': 'E475', 'натриев дифосфат': 'E450', 'дифосфати': 'E450',
    'цикламати': 'E952', 'бета каротен': 'E160A', 'бета-каротен': 'E160A', 'каротени': 'E160A',
    'модифицирано нишесте': 'E14X', 'модифицирано царевично нишесте': 'E14X', 'гума арабика': 'E414', 'калциев хлорид': 'E509',
    'яйчен меланж': '#egg', 'пастьоризиран яйчен меланж': '#egg', 'сух яйчен меланж': '#egg-powder',
    'палмово олио': '#palm-oil', 'растителна палмова мазнина': '#palm-fat', 'растителна мазнина палмова': '#palm-fat',
    'пшеничено брашно': '#wheat-flour', 'бяло пшенично брашно': '#wheat-flour', 'брашно пшенично тип 500': '#wheat-flour',
    'суха суроватка': '#whey-powder', 'млечна суроватка': '#whey', 'суха сладка суроватка': '#sweet-whey-powder',
    'кашкавал': '#cheese', 'ароматизатор': '#flavouring', 'ароматизатори': '#flavouring', 'ароматизант': '#flavouring',
    'аромати': '#flavouring', 'мед': '#honey', 'пчелен мед': '#bee-honey', 'свинска мас': '#pork-fat',
    'сирище': '#rennet', 'мая за сирене': '#rennet', 'сирищни ензими': '#rennet', 'ший': '#shea', 'гума база': '#gum-base',
    'фъстъци': '#peanut', 'фъстък': '#peanut', 'лешници': '#hazelnut', 'бадеми': '#almond',
    'растителни мазнини': '#vegetable-fat', 'растителни масла': '#vegetable-oil'
  };
  const ROLE_LABEL = /^(емулгатор(и|ни соли)?|консервант(и)?|стабилизатор(и)?|сгъстител(и)?|оцветител(и)?|антиоксидант(и)?|подсладител(и)?|овлажнител(и)?|влагозадържащ(и)? агент(и)?|киселинен регулатор|киселинни регулатори|регулатор(и)? на киселинност(та)?|регулатор(и)? на киселинноста|набухвател(и)?|втасващ(и)? агент(и)?|агент(и)? за обработка на брашн[оа]|овкусител(и)?|желиращ(и)? агент(и)?|глазиращ(и)? агент(и)?|окислител(и)?|киселини)(?=\s|$)\s*/;
  const NOISE = /^(съставки|състав|сьставки|ingredients|най добър до|партида|съхранение|условия на съхранение|производител|вносител|нетно количество|енергийна стойност|алергени|опаковано в защитна атмосфера|минимум|българия)(?=\s|$)/;
  const LETTER = /[a-zа-я]/i;
  const SUFFIX = { 'а': 'A', 'б': 'B', 'с': 'C', 'ц': 'C', 'д': 'D', 'е': 'E', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };

  const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[“”„"«»*]/g, '').replace(/\s+/g, ' ').trim();

  function createEngine(DB) {
    const ING = new Map(), NAMES = new Map();
    DB.i.forEach(x => { ING.set(x.t, x); const k = norm(x.bg); if (!NAMES.has(k)) NAMES.set(k, { ing: x }); });
    Object.keys(DB.a).forEach(c => { NAMES.set(norm(DB.a[c].bg), { add: c }); });
    Object.keys(ALIAS).forEach(k => { const v = ALIAS[k]; NAMES.set(k, v[0] === '#' ? { ing: ING.get(v.slice(1)) } : { add: v }); });
    for (const [k, v] of NAMES) if (!v.add && !v.ing) NAMES.delete(k);
    const NAME_KEYS = [...NAMES.keys()].filter(k => k.length >= 4).sort((a, b) => b.length - a.length);

    function codeFor(digits, suf) {
      if (/^14\d\d$/.test(digits)) return 'E14X';
      const s = suf && SUFFIX[suf.toLowerCase()];
      if (s && DB.a['E' + digits + s]) return 'E' + digits + s;
      return 'E' + digits;
    }
    function findCodes(seg) {
      const out = []; const re = /(?<![a-zа-я])[eе]\s?-?\s?(\d{3,4})([a-zа-я]{0,3})/gi; let m;
      while ((m = re.exec(seg))) {
        const tail = m[2] || '';
        const suf = tail.length === 1 ? tail : (/^[a-dа-д]i{0,3}$/i.test(tail) ? tail[0] : '');
        out.push(codeFor(m[1], suf));
      }
      return out;
    }
    function esterCode(s) {
      if (!s.includes('диглицерид')) return null;
      if (s.includes('диацетил')) return 'E472E';
      if (s.includes('млечн')) return 'E472B';
      if (s.includes('лимонен')) return 'E472C';
      if (s.includes('естер')) return 'E472';
      return 'E471';
    }
    function lookup(s) {
      if (NAMES.has(s)) return [NAMES.get(s)];
      const e = esterCode(s); if (e) return [{ add: e }];
      if (s.includes(' и ')) { const parts = s.split(' и ').map(p => lookup(p.trim())); if (parts.every(Boolean)) return parts.flat(); }
      for (const k of NAME_KEYS) {
        const i = s.indexOf(k);
        if (i >= 0 && !LETTER.test(s[i - 1] || '') && !LETTER.test(s[i + k.length] || '')) return [NAMES.get(k)];
      }
      return null;
    }

    function emptyResult() { return { spans: [], add: new Map(), ing: new Map(), unk: [], notes: new Set(), order: [] }; }

    /* Analyse free text (label photo, typed text, or the Bulgarian label text of a product). */
    function analyseText(text, res) {
      res = res || emptyResult();
      const scan = text.replace(/(\d)[,.](?=\d)/g, '$1\u0001');
      const re = /[^,;:()\[\]{}•·\n.]+/g; let m; let inTrace = false;
      while ((m = re.exec(scan))) {
        const raw = text.slice(m.index, m.index + m[0].length);
        const after = scan[m.index + m[0].length] || '';
        let s = norm(raw.replace(/\d+[.,]?\d*\s?%/g, ''));
        if (!s || /^[\d\s.,-]+$/.test(s)) { if (after === '.') inTrace = false; continue; }
        const span = { start: m.index, end: m.index + raw.length, kind: null };
        if (/може да съдържа|^съдържа (следи|глутен)|^следи от/.test(s)) inTrace = true;
        if (inTrace) { res.traces = res.traces || []; res.traces.push(raw.trim().replace(/^(.*?(може да съдържа|следи от)\s*)+/i, '')); res.notes.add('trace:' + raw.trim()); span.kind = 'ing'; res.spans.push(span); if (after === '.' || after === '\n') inTrace = false; continue; }
        if (/фенилаланин/.test(s)) { res.notes.add('phe'); span.kind = 'ing'; res.spans.push(span); continue; }
        if (NOISE.test(s)) continue;
        let prev; do { prev = s; s = s.replace(ROLE_LABEL, '').trim(); } while (s !== prev);
        if (!s) continue;
        const codes = findCodes(s);
        const hits = codes.length ? codes.map(c => ({ add: c })) : lookup(s);
        if (!hits) { res.unk.push(raw.trim()); span.kind = 'unk'; res.spans.push(span); continue; }
        for (const h of hits) {
          if (h.add) { if (!res.add.has(h.add)) res.add.set(h.add, raw.trim()); span.kind = FLAGS[h.add] && FLAGS[h.add].level === 'warn' ? 'flag' : (span.kind === 'flag' ? 'flag' : 'add'); }
          else { const x = h.ing; if (!res.ing.has(x.t)) res.ing.set(x.t, x); res.order.push(x); if (!span.kind) span.kind = x.g === 'sugar' ? 'sugar' : 'ing'; }
        }
        res.spans.push(span);
      }
      return res;
    }

    /* Map an Open Food Facts additive tag like "en:e500ii" or "en:e160a" to a library code. */
    function offAdditive(tag) {
      const m = /^en:e(\d{3,4})([a-z]*)$/.exec(tag || '');
      if (!m) return null;
      const letters = m[2];
      const suf = letters && !/^i+v?$|^v$/.test(letters) ? letters[0] : '';
      return codeFor(m[1], suf);
    }

    /* Analyse an Open Food Facts product: ingredient/additive codes first, Bulgarian label text on top. */
    function analyseProduct(p) {
      const res = emptyResult();
      const text = p.ingredients_text_bg || '';
      if (text) analyseText(text, res);
      (p.additives_tags || []).forEach(t => { const c = offAdditive(t); if (c && !res.add.has(c)) res.add.set(c, c); });
      const walk = (list, top) => (list || []).forEach(it => {
        const tag = (it.id || '').replace(/^[a-z]{2}:/, '');
        const x = ING.get(tag);
        if (x) { if (!res.ing.has(x.t)) res.ing.set(x.t, x); if (top && !text) res.order.push(x); }
        else if (top && !text && it.text && !/^en:e\d/.test(it.id || '')) res.unk.push(it.text);
        walk(it.ingredients, false);
      });
      walk(p.ingredients, true);
      res.text = text;
      return res;
    }

    const LIMITS = { food: { sugar: [5, 22.5], sat: [1.5, 5], salt: [0.3, 1.5] }, drink: { sugar: [2.5, 11.25], sat: [0.75, 2.5], salt: [0.3, 0.75] } };
    function level(kind, nutrient, v) {
      if (v == null || !isFinite(v)) return null;
      const [lo, hi] = LIMITS[kind][nutrient];
      return v <= lo ? 'low' : v > hi ? 'high' : 'mid';
    }
    const cubes = g => Math.round(g / 4 * 2) / 2;
    const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');
    const LEVEL_WORD = { low: 'Ниско', mid: 'Средно', high: 'Високо' };

    function flagsFor(res) {
      const out = []; const seen = new Set();
      for (const c of res.add.keys()) { const f = FLAGS[c]; if (f && !seen.has(f.id)) { seen.add(f.id); out.push(Object.assign({}, f, { codes: [...res.add.keys()].filter(k => FLAGS[k] === f) })); } }
      if ([...res.ing.values()].some(x => x.g === 'trans')) out.push(TRANS);
      const firstSugar = res.order.slice(0, 3).find(x => x.g === 'sugar');
      if (firstSugar) out.push({ id: 'sugar3', level: 'info', title: 'Захарта е сред първите три съставки', text: `„${firstSugar.bg}“ е на място ${res.order.indexOf(firstSugar) + 1}. По закон съставките се изброяват от най-голямото към най-малкото количество.`, src: [SRC.r1169] });
      return out;
    }

    function purposes(res) {
      const count = {};
      for (const c of res.add.keys()) { const a = DB.a[c]; if (!a) continue; const p = ranked(a).map(f => PURPOSE[f]).find(Boolean); if (p) count[p] = (count[p] || 0) + 1; }
      return Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 2);
    }

    /* One-paragraph plain summary. Only facts from the data, no verdict. */
    function summary(res, nut, kind) {
      const parts = [];
      const unit = kind === 'drink' ? 'мл' : 'г';
      if (nut && nut.sugar != null) {
        const lv = level(kind, 'sugar', nut.sugar);
        const c = cubes(nut.sugar);
        parts.push(`${LEVEL_WORD[lv]} съдържание на захар: ${fmt(nut.sugar)} г на 100 ${unit}, около ${fmt(c)} ${c === 1 ? 'бучка' : 'бучки'}.`);
      }
      const n = res.add.size;
      if (n === 0) parts.push('Без добавки с Е-номер.');
      else { const p = purposes(res); parts.push(`${n} ${n === 1 ? 'добавка' : 'добавки'}${p.length ? ', главно за ' + p.join(' и ') : ''}.`); }
      if ([...res.ing.values()].some(x => x.g === 'palm')) parts.push('Има палмово масло.');
      const fl = flagsFor(res).filter(f => f.level === 'warn');
      parts.push(fl.length ? 'Има официално предупреждение: виж по-долу.' : 'Без официални предупреждения.');
      return parts.join(' ');
    }

    function kidSummary(res, nut, kind) {
      const parts = [];
      if (nut && nut.sugar != null) {
        const c = cubes(nut.sugar); const lv = level(kind, 'sugar', nut.sugar);
        parts.push(`В 100 ${kind === 'drink' ? 'милилитра' : 'грама'} има колкото ${fmt(c)} ${c === 1 ? 'бучка' : 'бучки'} захар. Това е ${lv === 'high' ? 'много' : lv === 'mid' ? 'средно количество' : 'малко'} захар.`);
      }
      const n = res.add.size;
      parts.push(n ? `Вътре има ${n} ${n === 1 ? 'помощник' : 'помощника'}, наречени добавки. Ето какво правят:` : 'Вътре няма добавки с Е-номер.');
      return parts.join(' ');
    }

    /* Show the job an additive most often does in food first (e.g. lecithin: emulsifier before antioxidant). */
    const ROLE_ORDER = ['raising', 'emulsifier', 'thickener', 'sweetener', 'colour', 'preservative', 'flavour-enhancer', 'propellent-gas', 'acidity', 'stabiliser', 'humectant', 'antioxidant', 'coagulant', 'carrier', 'sequestrant'];
    const ranked = a => a ? a.f.slice().sort((x, y) => (ROLE_ORDER.indexOf(x) + 99) % 99 - (ROLE_ORDER.indexOf(y) + 99) % 99) : [];
    function additiveInfo(code) {
      const a = DB.a[code]; const f = ranked(a);
      return { code, name: a ? a.bg : code, en: a ? a.en : '', roles: f.filter(x => ROLE[x]).map(x => ROLE[x]),
        kid: f.map(x => KID_ROLE[x]).find(Boolean) || null, pct: a ? a.p : null, flag: FLAGS[code] || null, known: !!a };
    }

    /* Closest library spelling for an unsure OCR word (Levenshtein ≤ 2). */
    const WORDS = [...new Set([...NAMES.keys()].flatMap(k => k.split(/[\s-]+/)).filter(w => w.length >= 5))];
    function lev(a, b) {
      const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
      let prev = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
      return prev[n];
    }
    function suggest(word) {
      if (/[a-z0-9]/i.test(word.replace(/[^a-z0-9а-я]/gi, '').replace(/[а-я]/gi, ''))) return null;
      const w = norm(word).replace(/[^а-я-]/g, '');
      if (w.length < 5 || WORDS.includes(w)) return null;
      let best = null, bd = 3;
      for (const c of WORDS) { const d = lev(w, c); if (d < bd) { bd = d; best = c; } }
      if (bd === 1 && best) return best;
      if (bd === 2 && best && best[0] === w[0] && w.length >= 7 && !w.startsWith(best.slice(0, -1)) && !best.startsWith(w.slice(0, -2))) return best;
      return null;
    }

    /* Find the Bulgarian ingredient list inside a multilingual label.
       Starts at "Съставки"/"Състав", ends before storage/producer lines or the next language. */
    function extractBulgarian(text) {
      const t = text.replace(/\r/g, '');
      const start = t.search(/съставки\s*[:;.]|състав\s*[:;.]/i);
      if (start < 0) return { part: t.trim(), found: false, start: 0, end: t.length };
      const from = t.indexOf(':', start) >= 0 && t.indexOf(':', start) - start < 14 ? t.indexOf(':', start) + 1 : start;
      const rest = t.slice(from);
      const stops = [/да се съхранява/i, /съхранявайте/i, /произведено/i, /опаковано/i, /вносител/i, /най[- ]добър до/i, /хранителна стойност/i, /fairtrade/i,
        /(^|\n|\s)[\[(]?(EN|DE|FR|IT|ES|PT|NL|SE|SV|DK|FI|NO|PL|CZ|SK|HU|RO|RS|HR|SI|SL|GR|CY|TR|UA|RU|MK|AL|LT|LV|EE)[\])]?\s/];
      let end = rest.length;
      stops.forEach(re => { const m = re.exec(rest); if (m && m.index < end && m.index > 3) end = m.index; });
      // also stop at the first line that is mostly non-Cyrillic letters (another language)
      let pos = 0;
      for (const line of rest.split('\n')) {
        const letters = line.replace(/[^a-zа-яα-ω]/gi, '');
        const cyr = line.replace(/[^а-я]/gi, '');
        if (pos > 3 && letters.length > 12 && cyr.length / letters.length < 0.4 && pos < end) { end = pos; break; }
        pos += line.length + 1;
      }
      const part = rest.slice(0, end).replace(/\s*\n\s*/g, ' ').trim();
      return { part, found: true, start: from, end: from + end };
    }

    /* Personal "avoid" list check. */
    const AVOID_RULES = {
      'Оцветители': r => [...r.add.keys()].some(c => (DB.a[c] || { f: [] }).f.includes('colour')),
      'Подсладители': r => [...r.add.keys()].some(c => (DB.a[c] || { f: [] }).f.includes('sweetener')),
      'Палмово масло': r => [...r.ing.values()].some(x => x.g === 'palm'),
      'Нитрити': r => ['E249', 'E250', 'E251', 'E252'].some(c => r.add.has(c)),
      'Консерванти': r => [...r.add.keys()].some(c => (DB.a[c] || { f: [] }).f.includes('preservative')),
      'Глутен': r => [...r.ing.keys()].some(t => /wheat|barley|rye|gluten|spelt/.test(t)),
      'Кофеин': r => [...r.ing.keys()].some(t => /caffeine|coffee/.test(t))
    };
    function avoidHits(res, list, rawText) {
      const hay = norm((rawText || '') + ' ' + [...res.ing.values()].map(x => x.bg).join(' ') + ' ' + [...res.add.keys()].map(c => (DB.a[c] || {}).bg || '').join(' '));
      return (list || []).filter(item => AVOID_RULES[item] ? AVOID_RULES[item](res) : (norm(item).length >= 3 && hay.includes(norm(item))));
    }

    return { extractBulgarian, analyseText, analyseProduct, summary, kidSummary, flagsFor, additiveInfo, level, cubes, fmt, LEVEL_WORD, LIMITS, suggest, avoidHits, AVOID_RULES, offAdditive, SRC, ING };
  }

  const api = { createEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KakvoEngine = api;
})(typeof self !== 'undefined' ? self : this);
