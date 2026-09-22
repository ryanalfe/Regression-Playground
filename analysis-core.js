/* Regression Playground · Ryan Alfe. Pure, dependency-free analysis. */
(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ bytes: 5 * 1024 * 1024, rows: 10000, columns: 100, predictors: 10 });
  function parseCSV(text) {
    if (new TextEncoder().encode(text).length > LIMITS.bytes) throw Error('Choose a CSV smaller than 5 MB.');
    text = text.replace(/^\uFEFF/, '');
    const records = []; let row = [], field = '', quoted = false, closed = false;
    function endField() { row.push(field); field = ''; closed = false; if (row.length > LIMITS.columns) throw Error('Use at most 100 columns.'); }
    function endRow() {
      endField();
      if (row.some(value => value.trim() !== '')) records.push(row);
      row = [];
      if (records.length > LIMITS.rows + 1) throw Error('Use at most 10,000 data rows.');
    }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
        else field += c;
      } else if (c === ',') endField();
      else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
      else if (c === '"' && field === '' && !closed) quoted = true;
      else { if (closed || c === '"') throw Error('Invalid CSV quoting. Use a UTF-8, comma-separated file with a header.'); field += c; }
    }
    if (quoted) throw Error('A quoted CSV field is not closed.');
    if (field || row.length || closed) endRow();
    if (records.length < 2) throw Error('Include a header and at least one data row.');
    const headers = records.shift().map(h => h.trim());
    if (headers.some(h => !h || h.length > 120) || new Set(headers).size !== headers.length) throw Error('Use unique, nonempty column names of at most 120 characters.');
    if (records.some(r => r.length !== headers.length)) throw Error('Each row must have the same number of fields as the header.');
    return { headers, rows: records };
  }
  function number(value) {
    const s = String(value).trim();
    return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s) && Number.isFinite(Number(s)) ? Number(s) : NaN;
  }
  function numericColumns(data) { return data.headers.map((_, j) => j).filter(j => data.rows.some(r => Number.isFinite(number(r[j])))); }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const mean = a => a.reduce((s, v) => s + v / a.length, 0);
  function fit(data, outcome, predictors) {
    if (!Number.isInteger(outcome) || outcome < 0 || outcome >= data.headers.length) throw Error('Choose an outcome.');
    if (!predictors.length || predictors.length > LIMITS.predictors) throw Error('Choose between 1 and 10 predictors.');
    if (new Set(predictors).size !== predictors.length || predictors.includes(outcome) || predictors.some(j => !Number.isInteger(j) || j < 0 || j >= data.headers.length)) throw Error('Choose distinct predictors different from the outcome.');
    const clean = data.rows.map((r, i) => ({ y: number(r[outcome]), x: predictors.map(j => number(r[j])), row: i + 1 })).filter(r => [r.y, ...r.x].every(Number.isFinite));
    const n = clean.length, p = predictors.length;
    if (n <= p + 1) throw Error('Use more complete rows than predictors plus the intercept.');
    const y = clean.map(r => r.y), ym = mean(y), yc = y.map(v => v - ym);
    const sst = dot(yc, yc);
    if (!(sst > 0) || !Number.isFinite(sst)) throw Error('The outcome must vary and have a numerically manageable range.');
    const means = predictors.map((_, j) => mean(clean.map(r => r.x[j])));
    const centered = predictors.map((_, j) => clean.map(r => r.x[j] - means[j]));
    const scales = centered.map(c => Math.sqrt(dot(c, c) / n));
    if (scales.some(s => !Number.isFinite(s) || s === 0)) throw Error('Predictors must vary and have a numerically manageable range.');
    // Center/scale, then reorthogonalized QR: avoid squaring the condition number
    // through normal equations. Reject redundant or nearly redundant predictors.
    const q = [], R = Array.from({ length: p }, () => Array(p).fill(0));
    for (let j = 0; j < p; j++) {
      const v = centered[j].map(x => x / scales[j]);
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < j; k++) {
        const projection = dot(q[k], v); R[k][j] += projection;
        for (let i = 0; i < n; i++) v[i] -= projection * q[k][i];
      }
      R[j][j] = Math.sqrt(dot(v, v));
      if (R[j][j] < 1e-8 * Math.sqrt(n)) throw Error('Some predictors are redundant or nearly redundant. Remove one and try again.');
      q.push(v.map(x => x / R[j][j]));
    }
    const b = q.map(c => dot(c, yc));
    for (let j = p - 1; j >= 0; j--) { for (let k = j + 1; k < p; k++) b[j] -= R[j][k] * b[k]; b[j] /= R[j][j]; }
    const slopes = b.map((v, j) => v / scales[j]);
    const intercept = ym - dot(slopes, means);
    const observations = clean.map(r => { const predicted = ym + r.x.reduce((s, x, j) => s + slopes[j] * (x - means[j]), 0); return { ...r, predicted, residual: r.y - predicted }; });
    const sse = observations.reduce((s, r) => s + r.residual ** 2, 0);
    const r2 = 1 - sse / sst, rmse = Math.sqrt(sse / n), adjusted = 1 - (1 - r2) * (n - 1) / (n - p - 1);
    if (![intercept, ...slopes, sse, r2, rmse, adjusted].every(Number.isFinite)) throw Error('The values are too extreme for a reliable fit. Rescale them and try again.');
    return { observations, slopes, intercept, means, outcomeMean: ym, r2, adjusted, rmse, excluded: data.rows.length - n };
  }
  const api = { LIMITS, parseCSV, number, numericColumns, fit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RegressionAnalysis = Object.freeze(api);
})(globalThis);
