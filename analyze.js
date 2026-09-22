/* Regression Playground · Ryan Alfe. No network or persistence APIs. */
'use strict';
const A = globalThis.RegressionAnalysis;
const $ = s => document.querySelector(s);
let dataset = null, model = null, outcome = null, predictors = [], generation = 0;
const fmt = n => Math.abs(n) < 1e-10 ? '0' : new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4, notation: Math.abs(n) >= 1e6 || Math.abs(n) < .001 ? 'scientific' : 'standard' }).format(n);
function element(tag, text, parent) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (parent) parent.append(node); return node; }
function error(message) { $('#error').textContent = message; $('#error').hidden = !message; }
function invalidate() { model = null; $('#model-results').hidden = true; for (const id of ['metrics', 'coefficients', 'relationship-chart', 'prediction-chart', 'residual-chart', 'error-chart', 'plot-predictor']) $('#' + id).replaceChildren(); }
function clear() {
  generation++; dataset = null; outcome = null; predictors = []; invalidate();
  $('#csv-file').value = ''; $('#dataset-panel').hidden = true;
  for (const id of ['preview', 'outcome', 'predictors']) $('#' + id).replaceChildren();
  for (const id of ['dataset-summary', 'sample-prompt', 'row-summary', 'plot-sampling', 'relationship-note']) $('#' + id).textContent = '';
  $('#dataset-title').textContent = 'Your dataset';
  error(''); $('#status').textContent = 'Data cleared. Choose an example or open a CSV to start again.';
}
function table(headers, rows, parent) {
  parent.replaceChildren(); const t = element('table', undefined, parent), head = element('tr', undefined, element('thead', undefined, t));
  headers.forEach(h => { const th = element('th', h, head); th.scope = 'col'; });
  const body = element('tbody', undefined, t);
  rows.forEach(row => { const tr = element('tr', undefined, body); row.forEach(value => element('td', String(value), tr)); });
}
function showPredictors(defaults = []) {
  invalidate(); $('#predictors').replaceChildren();
  A.numericColumns(dataset).filter(j => j !== Number($('#outcome').value)).forEach(j => {
    const label = element('label', undefined, $('#predictors')), input = element('input', undefined, label);
    input.type = 'checkbox'; input.value = j; input.checked = defaults.includes(dataset.headers[j]);
    input.addEventListener('change', () => { invalidate(); error(''); updateRun(); });
    label.append(document.createTextNode(' ' + dataset.headers[j]));
  }); updateRun();
}
function updateRun() { const count = $('#predictors').querySelectorAll('input:checked').length; $('#run').disabled = count < 1 || count > A.LIMITS.predictors; }
function load(text, name, example) {
  const parsed = A.parseCSV(text), numeric = A.numericColumns(parsed);
  if (numeric.length < 2) throw Error('Include at least two columns containing numeric values.');
  dataset = parsed; $('#dataset-title').textContent = name;
  $('#dataset-summary').textContent = `${dataset.rows.length.toLocaleString()} rows · ${dataset.headers.length} columns · ${numeric.length} columns with numeric values`;
  $('#sample-prompt').textContent = example?.prompt || '';
  table(dataset.headers, dataset.rows.slice(0, 8), $('#preview'));
  $('#outcome').replaceChildren(); numeric.forEach(j => { const option = element('option', dataset.headers[j], $('#outcome')); option.value = j; });
  if (example) $('#outcome').value = dataset.headers.indexOf(example.outcome);
  showPredictors(example?.predictors || []);
  $('#dataset-panel').hidden = false; $('#status').textContent = 'Ready. Review the variables below, then run your regression.';
}
$('#clear').addEventListener('click', clear);
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => {
  clear(); const example = globalThis.RegressionSamples[button.dataset.sample];
  try { load(example.csv, example.title, example); } catch (e) { error(e.message); }
}));
$('#csv-file').addEventListener('change', async event => {
  const file = event.target.files[0]; clear(); if (!file) return;
  const token = generation;
  try {
    if (file.size > A.LIMITS.bytes) throw Error('Choose a CSV smaller than 5 MB.');
    if (!/\.csv$/i.test(file.name)) throw Error('Choose a file with a .csv extension.');
    $('#status').textContent = 'Reading locally…';
    const buffer = await file.arrayBuffer(); if (token !== generation) return;
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw Error('Save the CSV using UTF-8 encoding and try again.'); }
    load(text, file.name);
  } catch (e) { if (token === generation) { error(e.message); $('#status').textContent = 'Could not read this dataset. Choose another CSV or try an example.'; } }
});
$('#outcome').addEventListener('change', () => { showPredictors(); error(''); });
$('#run').addEventListener('click', () => {
  invalidate(); error(''); if (!dataset) return;
  try {
    outcome = Number($('#outcome').value); predictors = [...$('#predictors').querySelectorAll('input:checked')].map(input => Number(input.value));
    model = A.fit(dataset, outcome, predictors); renderResults();
    $('#model-results').hidden = false; $('#results-title').focus({ preventScroll: true }); $('#model-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#status').textContent = 'Regression complete. Results are below.';
  } catch (e) { error(e.message); }
});
const NS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attrs, parent, text) { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v)); if (text !== undefined) node.textContent = text; parent.append(node); return node; }
function extent(values) {
  let lo = Math.min(...values), hi = Math.max(...values); const pad = (hi - lo) * .08 || Math.max(Math.abs(lo) * .05, 1);
  return [lo - pad, hi + pad];
}
function chart(id, title, xLabel, yLabel, xs, ys, yRange) {
  const parent = $('#' + id); parent.replaceChildren();
  const svg = svgElement('svg', { viewBox: '0 0 580 350', role: 'img', 'aria-label': `${title}. Horizontal axis: ${xLabel}. Vertical axis: ${yLabel}.` }, parent);
  svgElement('title', {}, svg, title);
  const [xl, xh] = extent(xs), [yl, yh] = yRange || extent(ys), x = v => 83 + (v - xl) / (xh - xl) * 466, y = v => 286 - (v - yl) / (yh - yl) * 258;
  for (let i = 0; i <= 4; i++) {
    const xv = xl + (xh - xl) * i / 4, yv = yl + (yh - yl) * i / 4;
    svgElement('line', { x1: 83, x2: 549, y1: y(yv), y2: y(yv), stroke: '#e6ecf2' }, svg);
    svgElement('text', { x: x(xv), y: 307, 'text-anchor': 'middle' }, svg, fmt(xv));
    svgElement('text', { x: 75, y: y(yv) + 4, 'text-anchor': 'end' }, svg, fmt(yv));
  }
  const short = s => s.length > 48 ? s.slice(0, 45) + '…' : s;
  svgElement('text', { x: 315, y: 338, 'text-anchor': 'middle' }, svg, short(xLabel));
  svgElement('text', { x: 18, y: 158, transform: 'rotate(-90 18 158)', 'text-anchor': 'middle' }, svg, short(yLabel));
  return { svg, x, y, line(x1,y1,x2,y2) { svgElement('line', { x1:x(x1),y1:y(y1),x2:x(x2),y2:y(y2),stroke:'#4567cd','stroke-width':2,'stroke-dasharray':'6 4' },svg); } };
}
function sampleRows() { const rows = model.observations; return rows.length <= 600 ? rows : Array.from({length:600},(_,i)=>rows[Math.floor(i * (rows.length - 1) / 599)]); }
function points(c, rows, x, y) { rows.forEach(r => { const dot = svgElement('circle', { cx:c.x(x(r)),cy:c.y(y(r)),r:3.7,fill:'#167f7a','fill-opacity':'.55' }, c.svg); svgElement('title',{},dot,`Data row ${r.row}: ${fmt(x(r))}, ${fmt(y(r))}`); }); }
function relationship() {
  if (!model) return;
  const j = Number($('#plot-predictor').value), rows = model.observations, xs = rows.map(r=>r.x[j]);
  const lo = Math.min(...xs), hi = Math.max(...xs), at = x => model.outcomeMean + model.slopes[j] * (x - model.means[j]);
  const c = chart('relationship-chart','Outcome and selected predictor',dataset.headers[predictors[j]],dataset.headers[outcome],xs,[...rows.map(r=>r.y),at(lo),at(hi)]);
  points(c,sampleRows(),r=>r.x[j],r=>r.y); c.line(lo,at(lo),hi,at(hi));
  $('#relationship-note').textContent = predictors.length === 1 ? 'Each dot is an observation. The dashed line is the fitted relationship within the observed predictor range.' : 'Dots show the raw observations. The dashed line varies this predictor while holding all other predictors at their sample means. It need not pass through the raw cloud and is not a separate one-predictor fit.';
}
$('#plot-predictor').addEventListener('change', relationship);
function renderResults() {
  const rows = model.observations;
  $('#row-summary').textContent = `${rows.length.toLocaleString()} rows used · ${model.excluded.toLocaleString()} excluded.${model.excluded ? ' Missing or invalid selected values were excluded. Systematic missingness can bias the result.' : ''}`;
  for (const [label,value] of [['R²',model.r2],['Adjusted R²',model.adjusted],['Training RMSE',model.rmse]]) {
    const card = element('div',undefined,$('#metrics')); card.className='metric-card'; element('span',label,card); element('strong',fmt(value),card);
  }
  const coefRows = [['Intercept',fmt(model.intercept)], ...predictors.map((j,i)=>[dataset.headers[j],fmt(model.slopes[i])])];
  table(['Term','Coefficient (original units)'],coefRows,$('#coefficients'));
  predictors.forEach((j,i)=>{ const option=element('option',dataset.headers[j],$('#plot-predictor'));option.value=i; }); relationship();
  const predicted=rows.map(r=>r.predicted), observed=rows.map(r=>r.y), errors=rows.map(r=>r.residual);
  const bounds=[...predicted,...observed], lo=Math.min(...bounds), hi=Math.max(...bounds);
  const pc=chart('prediction-chart','Actual versus predicted outcomes','Predicted outcome','Actual outcome',bounds,bounds);
  points(pc,sampleRows(),r=>r.predicted,r=>r.y);pc.line(lo,lo,hi,hi);
  const rc=chart('residual-chart','Residuals versus predicted outcomes','Predicted outcome','Residual (actual − predicted)',predicted,[...errors,0]);
  points(rc,sampleRows(),r=>r.predicted,r=>r.residual);rc.line(Math.min(...predicted),0,Math.max(...predicted),0);
  let emin=Math.min(...errors),emax=Math.max(...errors); if(emax-emin<1e-10){emin=-1;emax=1;}
  const bins=Array(Math.min(20,Math.max(5,Math.ceil(Math.sqrt(rows.length))))).fill(0), width=(emax-emin)/bins.length;
  errors.forEach(e=>bins[Math.min(bins.length-1,Math.max(0,Math.floor((e-emin)/width)))]++);
  const hc=chart('error-chart','Distribution of prediction errors','Residual (outcome units)','Number of rows',[emin,emax,0],[0,Math.max(...bins)],[0,Math.ceil(Math.max(...bins)/4)*4]);
  bins.forEach((count,i)=>{const x=hc.x(emin+i*width);svgElement('rect',{x,y:hc.y(count),width:Math.max(1,hc.x(emin+(i+1)*width)-x-2),height:hc.y(0)-hc.y(count),fill:'#167f7a','fill-opacity':'.75'},hc.svg);});
  hc.line(0,0,0,Math.max(...bins));
  $('#plot-sampling').textContent = rows.length>600 ? 'Scatter plots show 600 evenly spaced rows for responsiveness. Model statistics, axis ranges, and the error histogram use all complete rows.' : 'Plots and statistics use every complete row. RMSE and residuals are expressed in the outcome’s units.';
}
