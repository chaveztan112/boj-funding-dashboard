// Serverless function (Vercel/Node 18+). Fetches data SERVER-SIDE (no browser CORS):
//   • FX spot + realized vol from Yahoo Finance (USD/JPY, USD/SGD)
//   • Policy/curve rates from FRED  (needs env var FRED_API_KEY)
// Response: { asof, usdjpy:{spot,vol}, usdsgd:{spot,vol}, rates:{...} | null }

async function fetchSym(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; funding-dashboard/1.0)' },
  });
  if (!r.ok) throw new Error(`${sym} ${r.status}`);
  const j = await r.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res) throw new Error(`${sym} no result`);

  const meta = res.meta || {};
  const closes = ((res.indicators && res.indicators.quote && res.indicators.quote[0].close) || [])
    .filter((x) => x != null);
  const spot = meta.regularMarketPrice != null ? meta.regularMarketPrice : closes[closes.length - 1];

  let vol = null;
  if (closes.length > 5) {
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const m = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varc = rets.reduce((a, b) => a + (b - m) * (b - m), 0) / (rets.length - 1);
    vol = Math.sqrt(varc * 252) * 100;
  }
  return { spot: +Number(spot).toFixed(4), vol: vol != null ? +vol.toFixed(1) : null };
}

// latest non-missing value of a FRED series
async function fredLatest(seriesId, key) {
  const url = `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=12`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${seriesId} ${r.status}`);
  const j = await r.json();
  const obs = (j.observations || []).find((o) => o.value && o.value !== '.');
  return obs ? +obs.value : null;
}

async function fetchRates() {
  const key = process.env.FRED_API_KEY;
  if (!key) return null; // no key configured -> front-end keeps anchored policy rates
  try {
    const [fedFunds, us2y, us10y, jp10y] = await Promise.all([
      fredLatest('DFF', key),            // Fed funds effective (daily)
      fredLatest('DGS2', key),           // US 2Y Treasury
      fredLatest('DGS10', key),          // US 10Y Treasury
      fredLatest('IRLTLT01JPM156N', key) // Japan 10Y govt (monthly; lags)
    ]);
    return { fedFunds, us2y, us10y, jp10y };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export default async function handler(req, res) {
  try {
    const [usdjpy, usdsgd, rates] = await Promise.all([
      fetchSym('USDJPY=X'),
      fetchSym('SGD=X'),
      fetchRates(),
    ]);
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ asof: Date.now(), usdjpy, usdsgd, rates });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
