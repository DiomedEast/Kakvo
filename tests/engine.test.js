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
