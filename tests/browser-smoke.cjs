/* Run: node tests/browser-smoke.cjs
   Requires Playwright + Chromium. Optionally set PLAYWRIGHT_MODULE to its installed
   module path; PLAYWRIGHT_CHANNEL=msedge or chrome uses an installed browser.
   Set SCREENSHOT_DIR to save desktop/mobile screenshots outside the repo. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.csv':'text/csv' };
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404); res.end(); return;}
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
    const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors=[], requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto(`http://127.0.0.1:${server.address().port}/analyze.html`);await page.waitForLoadState('networkidle');
    assert.ok(requests.every(url=>url.startsWith(`http://127.0.0.1:${server.address().port}/`)));
    const initial=requests.length;
    await page.click('[data-sample=sales]');await page.click('#run');
    assert.ok(await page.locator('#model-results').isVisible());assert.equal(await page.locator('#model-results svg').count(),4);
    assert.match(await page.locator('#row-summary').textContent(),/72 rows used/);
    await page.selectOption('#plot-predictor','1');
    assert.match(await page.locator('#relationship-note').textContent(),/holding all other predictors/);
    if(process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'analyzer-desktop.png'),fullPage:true});
    }
    await page.locator('#predictors input').first().uncheck();assert.ok(await page.locator('#model-results').isHidden());
    await page.click('[data-sample=curve]');await page.click('#run');assert.match(await page.locator('#row-summary').textContent(),/64 rows used/);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'analyzer-mobile.png'),fullPage:true});
    await page.click('#clear');assert.ok(await page.locator('#model-results').isHidden());assert.equal(await page.locator('#preview').textContent(),'');
    assert.equal(await page.locator('#csv-file').inputValue(),'');
    await page.locator('#csv-file').setInputFiles({name:'private.csv',mimeType:'text/csv',buffer:Buffer.from('x,y,notes\n1,3,"<img src=https://example.com/leak onerror=alert(1)>"\n2,5,test\n3,7,test\n4,9,test\n,10,test')});
    await page.waitForFunction(()=>document.querySelector('#dataset-title').textContent==='private.csv');
    assert.equal(await page.locator('#preview img').count(),0);assert.match(await page.locator('#preview').textContent(),/<img/);
    await page.selectOption('#outcome','1');await page.locator('#predictors input[value="0"]').check();await page.click('#run');
    assert.match(await page.locator('#row-summary').textContent(),/4 rows used · 1 excluded/);
    assert.equal(requests.length,initial,'File selection, analysis, sample switching and clearing must make no requests');
    assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
    await page.locator('#csv-file').setInputFiles({name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from('x,x\n1,2')});
    await page.waitForFunction(()=>!document.querySelector('#error').hidden);
    assert.match(await page.locator('#error').textContent(),/unique/);assert.ok(await page.locator('#model-results').isHidden());
    // Clear while a file read is pending: stale content must not reappear.
    await page.evaluate(()=>{const native=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return new Promise(resolve=>setTimeout(()=>resolve(native.call(this)),200));};});
    await page.locator('#csv-file').setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from('x,y\n1,2\n2,3\n3,4')});
    await page.click('#clear');await page.waitForTimeout(350);assert.ok(await page.locator('#dataset-panel').isHidden());
    assert.equal(requests.length,initial);assert.deepEqual(errors,[]);
    console.log('PASS: both samples, four plots, predictor changes, local CSV, literal HTML, missing values, malformed CSV, clear/read race, mobile width, zero analysis network requests, no local/session storage, no runtime errors.');
  } finally {if(browser) await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
