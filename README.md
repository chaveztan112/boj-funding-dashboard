# BOJ Hike Funding Monitor — live

Interactive STIRT/repo/FX-funding dashboard: carry compression, FX-swap funding,
cross-currency basis, OIS curves (1M→10Y) for JPY/USD/SGD, CLP-style unwind
scoring, a G10+SGD grid, and the MAS/SGD transmission channel. Anchored to the
16 Jun 2026 BOJ hike to 1.00%, with **live USD/JPY and USD/SGD spot + realized
vol pulled from Yahoo Finance**.

## Why it needs hosting
A page opened from disk (`file://`) cannot fetch Yahoo directly — Yahoo sends no
CORS headers, so the browser blocks it. The fix (same design as the reference
site) is a tiny **server-side** function, `api/quotes.js`, that fetches Yahoo and
the page calls. No CORS, robust, cached ~15 min. If the feed is down the page
falls back to anchored levels and shows a "Modeled fallback" badge.

## Files
- `index.html` — the dashboard (calls `/api/quotes` on load + on "Refresh live data")
- `api/quotes.js` — serverless function; fetches `USDJPY=X` and `SGD=X` from Yahoo
- `package.json` — Node 18+ marker

## Deploy to Vercel (free, ~3 min)

### Option A — drag & drop / CLI
1. Install the CLI once: `npm i -g vercel`
2. From this folder: `vercel`  (accept defaults; it auto-detects static + `/api`)
3. Promote to production: `vercel --prod`
4. Open the URL it prints. The badge should read **"Live · Yahoo"**.

### Option B — GitHub import
1. Push this folder to a new GitHub repo.
2. vercel.com → **Add New → Project → Import** the repo → **Deploy** (zero config).

### Test locally with the function running
`vercel dev` then open http://localhost:3000 (this runs `/api/quotes` locally so
the live feed works; opening `index.html` directly will only show the modeled
fallback).

## Make policy rates live too (optional)
Yahoo doesn't carry policy rates. Add a FRED key and extend `api/quotes.js` to
also fetch e.g. `DFF` (Fed funds) / JPY/SGD series from
`https://api.stlouisfed.org/fred/series/observations`, then feed them into the
front ends in `index.html`.

## Caveat
Cross-currency basis, FX-swap-implied funding, OIS curve shapes, positioning
z-scores and the CLP score are transparent **modeled proxies** (no free live
feed), calibrated to plausible June 2026 levels. Verify against desk marks
before quoting.
