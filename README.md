# Regression Playground

An interactive learning environment created by **Ryan Alfe** for exploring linear regression, residuals, and statistical interpretation.

## Analyze your data

`analyze.html` is a static, browser-only CSV analyzer. Open one of two synthetic examples or select a local CSV, choose an outcome and up to ten predictors, and fit ordinary least squares with an intercept. No build step or third-party JavaScript packages are required.

- **Weekly sales:** 72 invented observations with advertising spend, store visits, and sales. Compare simple and multiple regression.
- **Temperature and ice cream sales:** 64 invented observations with a curved relationship. Explore why a fairly high R² does not make a straight line adequate.
- Relationship, actual-versus-predicted, residual, and error-distribution plots have reading instructions. Scatter plots display at most 600 evenly spaced rows; fitting and the histogram use all complete rows.
- R², adjusted R², training RMSE, and coefficients describe the fitted data. The browser version does not calculate p-values, confidence intervals, or held-out performance. The original Python `regression.py` remains available for local analysis with conventional inference.

## Privacy and security

The analyzer reads selected files with the browser File API, computes locally, and renders values as text, never HTML. There is no upload endpoint, analytics, external font request, or browser persistence in the analyzer. A restrictive Content Security Policy blocks script connections (`connect-src 'none'`), form submissions, remote assets, and inline scripts. Sample data is bundled, so selecting an example needs no network request.

Limits: 5 MB per file, 10,000 data rows, 100 columns, 120 characters per unique column name, and 10 predictors. CSVs must use UTF-8 and comma separators. Missing, nonnumeric, and infinite selected values are excluded and counted; they are never interpreted as zero. Invalid quoting, ragged rows, constant variables, and redundant or nearly redundant predictors produce errors. Regression uses centered, scaled, reorthogonalized QR rather than normal equations.

**Clear data** removes the preview, selections, plots, and app references to the dataset. It also invalidates any pending file read. Reloading or closing the tab ends the analysis session. JavaScript garbage collection does not offer guaranteed secure memory erasure. Browser extensions, compromised devices, and future code/hosting changes are outside these protections. The host still receives ordinary requests for public site assets; the app does not send CSV contents with them.

The old `streamlit_app.py` now contains only a link to the browser analyzer and accepts no files. Streamlit usage telemetry is disabled in `.streamlit/config.toml`. The old deployed upload form remains active until that deployment updates to this version.

## Run and test locally

Serve this directory with a static HTTP server, for example `python -m http.server 8000`, then open `http://localhost:8000/analyze.html`. Use a current browser with JavaScript enabled. The original home and interactive playground remain available.

Run the dependency-free parser, regression, limits, sample-integrity, and privacy checks with Node.js 18 or newer:

```sh
node --test tests/analysis.test.cjs
```

For a release, also verify both samples and a selected CSV in a browser, test Clear data and mobile layout, and inspect the Network panel: selecting a file, fitting, switching plotted predictors, and clearing should cause no requests. `tests/browser-smoke.cjs` automates these checks with Playwright when installed in the development environment; see its header for usage.

## Publishing and project ownership

Keep deployment under Ryan Alfe's existing GitHub repository and hosting account. Publish the static site including `analyze.html`, its scripts/styles, and `datasets/` through the existing GitHub Pages setup. Then update the Streamlit deployment so bookmarked links lead to the new analyzer. If the site's public URL changes, update the link in `streamlit_app.py`.

The two CSVs in `datasets/` were generated specifically for this project; they contain no real individuals or businesses and introduce no third-party dataset attribution requirement. The website retains Ryan Alfe's authorship. This change adds no license grant and transfers no repository or hosting control. Existing dependency licenses remain applicable to those dependencies.
