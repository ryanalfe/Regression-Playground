const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../analysis-core.js');
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('CSV supports BOM, CRLF, quoted commas, escaped quotes and embedded newlines', () => {
  const d = A.parseCSV('\uFEFFname,x,y\r\n"a,b",1,2\r\n"a""b\nc",2,4\r\n');
  assert.deepEqual(d.headers, ['name','x','y']); assert.equal(d.rows[1][0], 'a"b\nc');
});
test('malformed files and duplicate headers fail clearly', () => {
  for (const csv of ['', 'x,y', 'x,x\n1,2', 'x,\n1,2', 'x,y\n1', 'x,y\n"1,2', 'x,y\n"1"oops,2']) assert.throws(() => A.parseCSV(csv));
});
test('resource limits reject oversized data', () => {
  assert.throws(() => A.parseCSV('x'.repeat(A.LIMITS.bytes + 1)), /5 MB/);
  assert.throws(() => A.parseCSV('x,y\n' + '1,2\n'.repeat(10001)), /10,000/);
  assert.throws(() => A.parseCSV(Array.from({length:101},(_,i)=>'x'+i).join(',')+'\n1'), /100 columns/);
  assert.equal(A.parseCSV('x,y\n'+'1,2\n'.repeat(10000)).rows.length,10000);
});
test('missing values and nondecimal syntax never become zero', () => {
  for (const v of ['', ' ', 'NA','Infinity','NaN','0x10','1,000','$2']) assert.ok(Number.isNaN(A.number(v)));
  close(A.number(' -2.5e2 '),-250);
  const r=A.fit(A.parseCSV('x,y\n1,3\n2,5\n3,7\n,10\n4,Infinity\n5,11'),1,[0]);
  assert.equal(r.excluded,2);close(r.slopes[0],2);close(r.intercept,1);
});
test('OLS agrees with a hand-computed noisy reference', () => {
  const r=A.fit(A.parseCSV('x,y\n1,2\n2,4\n3,5\n4,4\n5,5'),1,[0]);
  close(r.intercept,2.2);close(r.slopes[0],.6);close(r.r2,.6);close(r.adjusted,7/15);close(r.rmse,Math.sqrt(.48));
});
test('multiple regression recovers coefficients at very different predictor scales', () => {
  const rows=Array.from({length:40},(_,i)=>{const x=1e9+i*1e5,z=(i%7)*1e-5;return [x,z,12+2*x-3e8*z].map(String);});
  const r=A.fit({headers:['x','z','y'],rows},2,[0,1]);
  close(r.slopes[0],2,1e-9);close(r.slopes[1],-3e8,.01);close(r.intercept,12,.001);close(r.r2,1);
});
test('constant outcomes, constant or collinear predictors and insufficient rows fail', () => {
  for(const csv of ['x,z,y\n1,2,3\n2,4,5\n3,6,7\n4,8,9','x,z,y\n1,2,3\n1,3,5\n1,4,7\n1,5,9','x,z,y\n1,2,3\n2,3,3\n4,2,3\n5,4,3','x,z,y\n1,2,3\n2,4,5']) assert.throws(()=>A.fit(A.parseCSV(csv),2,[0,1]));
  assert.throws(()=>A.fit(A.parseCSV('x,y\n1,2\n2,3\n3,4'),1,[0,0]));
});
test('bundled CSVs match the browser examples and both fit their suggested models', () => {
  require('../sample-data.js');
  for(const [key,file] of [['sales','synthetic-sales.csv'],['curve','synthetic-temperature.csv']]) {
    const s=globalThis.RegressionSamples[key], csv=fs.readFileSync(path.join(__dirname,'../datasets',file),'utf8');
    assert.equal(s.csv,csv);const d=A.parseCSV(csv),r=A.fit(d,d.headers.indexOf(s.outcome),s.predictors.map(p=>d.headers.indexOf(p)));
    assert.equal(r.excluded,0);assert.ok(Number.isFinite(r.rmse));
  }
});
test('analyzer assets have no external dependencies, transfer APIs, or persistent storage', () => {
  const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  const html=read('analyze.html');assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
  for(const file of ['analysis-core.js','analyze.js','sample-data.js']) assert.doesNotMatch(read(file),/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|eval)\s*[.(]/);
  assert.doesNotMatch(read('style.css'),/@import|https?:/);
  assert.doesNotMatch(read('streamlit_app.py'),/file_uploader|read_csv/);
});
