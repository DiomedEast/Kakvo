// Run: node tests/engine.test.js [folder-with-product-json]
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { createEngine } = require('../js/engine.js');
const DB = require('../data/library.json');
const E = createEngine(DB);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('E-numbers in Cyrillic and Latin, sub-types', () => {
  const r = E.analyseText('Оцветители: Е110, E129, E160а, Е1442, E500ii');
  assert.deepStrictEqual([...r.add.keys()], ['E110', 'E129', 'E160A', 'E14X', 'E500']);
});
t('names, aliases, role labels, esters', () => {
  const r = E.analyseText('Пшенично брашно 62%, захар, набухватели: сода бикарбонат, амониев бикарбонат, емулгатор: соев лецитин, моно- и диглицериди на мастни киселини');
  assert.ok(r.add.has('E500') && r.add.has('E503') && r.add.has('E322') && r.add.has('E471'));
  assert.ok(r.ing.has('wheat-flour') && r.ing.has('sugar'));
  assert.strictEqual(r.unk.length, 0);
});
t('decimal comma does not split', () => {
  const r = E.analyseText('какао на прах 4,5%, сол');
  assert.ok(r.ing.has('cocoa-powder'), [...r.ing.keys()].join());
});
t('flags: children colours, aspartame, sugar in first three', () => {
  const r = E.analyseText('Вода, захар, оцветители: Е110, Е129, подсладител: аспартам');
  const ids = E.flagsFor(r).map(f => f.id);
  assert.ok(ids.includes('south') && ids.includes('e951') && ids.includes('sugar3'), ids.join());
});
t('OFF additive tags', () => {
  assert.strictEqual(E.offAdditive('en:e500ii'), 'E500');
  assert.strictEqual(E.offAdditive('en:e160a'), 'E160A');
  assert.strictEqual(E.offAdditive('en:e1422'), 'E14X');
  assert.strictEqual(E.offAdditive('en:e472e'), 'E472E');
});
t('traffic lights and cubes', () => {
  assert.strictEqual(E.level('food', 'sugar', 24), 'high');
  assert.strictEqual(E.level('food', 'sugar', 5), 'low');
  assert.strictEqual(E.level('drink', 'sugar', 10.6), 'mid');
  assert.strictEqual(E.cubes(24), 6);
});
t('OCR suggestions', () => {
  assert.strictEqual(E.suggest('амонйев'), 'амониев');
  assert.strictEqual(E.suggest('захар'), null);
});
t('avoid list', () => {
  const r = E.analyseText('Вода, захар, оцветители: Е110, палмово масло');
  assert.deepStrictEqual(E.avoidHits(r, ['Оцветители', 'Палмово масло', 'Нитрити', 'захар']), ['Оцветители', 'Палмово масло', 'захар']);
});
const dir = process.argv[2];
if (dir) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  t('real product ' + f, () => {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f))).product;
    const r = E.analyseProduct(p);
    const nut = { sugar: p.nutriments && p.nutriments.sugars_100g };
    const drink = (p.categories_tags || []).includes('en:beverages') ? 'drink' : 'food';
    console.log('   ', p.product_name, '|', drink, '|', [...r.add.keys()].join(' '), '|', r.ing.size, 'ing |', r.unk.length, 'unk');
    console.log('   ', E.summary(r, nut, drink));
    assert.ok(r.ing.size + r.add.size > 0);
  });
}
console.log(n, 'tests passed');

// Multilingual label (Lidl dark chocolate, 6 languages), as read by Tesseract.
const ocr = fs.readFileSync(path.join(__dirname, 'fixtures/chocolate-6-languages-ocr.txt'), 'utf8');
const bg = E.extractBulgarian(ocr);
assert.ok(bg.found && bg.part.startsWith('какаова маса'), bg.part.slice(0, 60));
assert.ok(!/socker|kakaomassa|cacao/i.test(bg.part), 'other languages leaked in');
const cr = E.analyseText(bg.part);
assert.ok(cr.ing.has('sugar') && cr.ing.has('cocoa-paste'));
assert.ok(!cr.ing.has('milk') && cr.traces && cr.traces.join(' ').includes('мляко'), 'traces must not count as ingredients');
assert.strictEqual(E.suggest('пецитини:'), 'лецитини');
console.log('ok multilingual label: Bulgarian part only, traces separate');

// Nutrition table: clean English reading and a noisy reading of the same Lidl table.
const clean = E.parseNutrition('ø/100 g ø/20 g %RI\nEnergy 2431 kJ / 588 kcal 485 kJ/117 kcal 6%\nFat 48,1 g 9,6 g 14%\nof which saturates 29,0 g 5,8 g 29%\nCarbohydrate 21,2 g 4,2 g 2%\nof which sugars 12,8 g 2,6 g 3%\nFibre 14,0 g 2,8 g\nProtein 10,5 g 2,1 g 4%\nSalt 0,02 g <0,01 g <1%\nRI (reference intake) 8400 kJ');
assert.deepStrictEqual([clean.fat, clean.sat, clean.carbs, clean.sugar, clean.fibre, clean.protein, clean.salt, clean.kcal, clean.portion], [48.1, 29, 21.2, 12.8, 14, 10.5, 0.02, 588, 20]);
assert.ok(clean.check.ok && clean.doubt.length === 0);
const noisy = E.parseNutrition('0/100 9/20q %RI\n/588keal | 4850/5\n48) gq 38 g Eh\n~ 20q 38g 8%\n- A2g 429 2%\n128g 28g 3%\n~ 140g 28g\n~ 105g 2g 4%\n002g Q0lg «3\n3400 k/2000 keal)/Consumul');
assert.strictEqual(noisy.salt, 0.02); assert.strictEqual(noisy.carbs, 21); assert.ok(noisy.doubt.includes('carbs') && noisy.check.ok);
// English ingredients and the "could not read" guard
const en = E.analyseText('Ingredients: cocoa mass, sugar, emulsifier: lecithins (soya). May contain traces of milk.');
assert.ok(en.add.has('E322') && en.ing.has('sugar') && !en.ing.has('milk') && E.readable(en));
assert.ok(!E.readable(E.analyseText('Kakaotasha, zosket, totefeteg, wapyuezaai, sbvsaet')));
console.log('ok nutrition table, English ingredients, unreadable guard');
