const { chromium } = require('playwright'); require('fs').mkdirSync('/tmp/shots', { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const labels = {
    bg: 'Съставки: пшенично брашно, захар, безводна млечна мазнина, емулгатор: соеви лецитини, готварска сол, набухватели: натриеви карбонати, амониеви карбонати.',
    fr: "Ingrédients : farine de blé, sucre, matière grasse laitière anhydre, émulsifiant : lécithines de soja, sel de table, poudres à lever : carbonates de sodium, carbonates d'ammonium."
  };
  for (const [k, txt] of Object.entries(labels)) {
    await p.goto('http://localhost:8765/#/type'); await p.waitForSelector('#typed');
    await p.fill('#pname', 'Бисквити'); await p.fill('#typed', txt); await p.fill('#n-sugar', '22'); await p.fill('#n-sat', '9'); await p.fill('#n-salt', '0.8');
    await p.waitForTimeout(300); console.log(k, 'COUNT:', await p.textContent('#count'));
    await p.click('#explain'); await p.waitForSelector('.addrow');
    console.log(k, 'ROWS:', await p.$$eval('.addrow b', e => e.map(x => x.textContent)));
    if (k === 'bg') {
      const el = await p.$('h2:has-text("съставка по съставка")'); await el.scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollBy(0, -120)); await p.screenshot({ path: '/tmp/shots/list.png' });
      await p.click('a[href^="#/i/butterfat"]'); await p.waitForSelector('h1'); await p.screenshot({ path: '/tmp/shots/butterfat.png', fullPage: true });
      console.log('PAGE:', (await p.textContent('.wrap')).slice(0, 400));
      await p.goBack(); await p.waitForSelector('.addrow');
      await p.click('a[href^="#/a/E322"]'); await p.waitForSelector('h1'); await p.screenshot({ path: '/tmp/shots/e322.png', fullPage: true });
      console.log('E322:', (await p.textContent('.wrap')).slice(0, 300));
      await p.goBack(); await p.waitForSelector('.addrow');
      await p.click('a[href^="#/a/E503"]'); await p.waitForSelector('h1'); await p.screenshot({ path: '/tmp/shots/e503.png', fullPage: true });
      await p.goBack(); await p.waitForSelector('.addrow');
      await p.click('a[href^="#/i/salt"]'); await p.waitForSelector('h1'); await p.screenshot({ path: '/tmp/shots/salt.png', fullPage: true });
    }
  }
  console.log('ERRORS:', errs); await b.close();
})();
