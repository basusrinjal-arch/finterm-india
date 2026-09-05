function $(id) { return document.getElementById(id); }

var YF1 = 'https://query1.finance.yahoo.com/v8/finance/chart/';
var YF2 = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/';
var CORS_PROXY = 'https://r.jina.ai/';
var RBI_REPO = 0.055;
var LIVE_MODE = true;

// fetchJSON: try a direct cross-origin fetch first; if that throws (Yahoo's unofficial
// endpoints don't send CORS headers on most hosts), retry through r.jina.ai, a public
// read-only fetch proxy that returns the target response wrapped in a small text
// preamble - strip that preamble and parse the JSON payload underneath.
function fetchJSON(url) {
  return fetch(url, { headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .catch(function () {
      return fetch(CORS_PROXY + url)
        .then(function (r) { if (!r.ok) throw new Error('proxy http ' + r.status); return r.text(); })
        .then(function (text) {
          var marker = 'Markdown Content:\n';
          var idx = text.indexOf(marker);
          var jsonStr = idx >= 0 ? text.slice(idx + marker.length) : text;
          return JSON.parse(jsonStr.trim());
        });
    });
}

var CH = {}, port = [], alerts = [], tdata = null, btResult = null, curA = null;
var inds = { sma: true, bb: false, rsi: false, macd: false, vol: false, ema: false, atr: false };

function fIN(n) {
  if (n == null || isNaN(n)) return 'N/A';
  var abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return sign + 'Rs ' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return sign + 'Rs ' + (abs / 1e5).toFixed(2) + 'L';
  return sign + 'Rs ' + abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function fINp(n) { if (n == null || isNaN(n)) return 'N/A'; return 'Rs ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fMCr(crores) {
  if (crores == null || isNaN(crores)) return 'N/A';
  if (crores >= 1e5) return 'Rs ' + (crores / 1e5).toFixed(2) + 'L Cr';
  return 'Rs ' + crores.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' Cr';
}
function fV(n) { if (!n) return 'N/A'; if (n >= 1e7) return (n / 1e7).toFixed(2) + 'Cr'; if (n >= 1e5) return (n / 1e5).toFixed(2) + 'L'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return '' + n; }
function f2(n) { return n == null || isNaN(n) ? 'N/A' : Number(n).toFixed(2); }
function f1(n) { return n == null || isNaN(n) ? 'N/A' : Number(n).toFixed(1); }
function ir(k, v) { return '<div class="ir"><span>' + k + '</span><span>' + v + '</span></div>'; }
function dC(id) { if (CH[id]) { try { CH[id].destroy(); } catch (e) {} delete CH[id]; } }

// ---------- DATA LAYER (live fetch with seeded fallback) ----------

function fetchQuote(symbol, callback) {
  if (!LIVE_MODE) {
    var seeded = getSeededQuote(symbol);
    if (!seeded) { callback(null, new Error('Unknown symbol in seeded data: ' + symbol)); return; }
    seeded.src = 'seeded';
    setTimeout(function () { callback(seeded, null); }, 150);
    return;
  }
  fetchJSON(YF1 + encodeURIComponent(symbol) + '?interval=1d&range=3mo&includePrePost=false')
    .then(function (cd) {
      if (!cd || !cd.chart || !cd.chart.result || !cd.chart.result.length) throw new Error('no data for ' + symbol);
      var res = cd.chart.result[0], meta = res.meta;
      var price = meta.regularMarketPrice || meta.previousClose || meta.chartPreviousClose || 0;
      var prev = meta.previousClose || meta.chartPreviousClose || price;
      var chg = meta.regularMarketChange != null ? meta.regularMarketChange : (price - prev);
      var chgPct = meta.regularMarketChangePercent != null ? meta.regularMarketChangePercent : ((chg / prev) * 100);
      var quote = {
        sym: symbol, name: meta.longName || meta.shortName || symbol, price: price, chg: chg, chgPct: chgPct,
        mcap: meta.marketCap, volume: meta.regularMarketVolume,
        lo52: meta.fiftyTwoWeekLow, hi52: meta.fiftyTwoWeekHigh, src: 'live'
      };
      // Fundamentals are a best-effort enrichment on top of the live price. Yahoo's
      // quoteSummary endpoint now demands an auth "crumb" it won't issue cross-origin
      // (it returns HTTP 200 with an Unauthorized/Invalid-Crumb body, not a fetch
      // error) — so it's attempted, but any gap it leaves is always patched from the
      // seeded fundamentals profile afterward. Ratios like P/E and ROE don't move
      // intraday, so this stays honest while the live price above does not.
      return fetchJSON(YF2 + encodeURIComponent(symbol) + '?modules=summaryDetail,defaultKeyStatistics,financialData')
        .then(function (qd) {
          if (qd && qd.quoteSummary && qd.quoteSummary.result && qd.quoteSummary.result[0]) {
            var r = qd.quoteSummary.result[0], sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {}, fd = r.financialData || {};
            quote.pe = (sd.trailingPE && sd.trailingPE.raw) || (sd.forwardPE && sd.forwardPE.raw);
            quote.eps = ks.trailingEps && ks.trailingEps.raw;
            quote.divYield = (sd.dividendYield && sd.dividendYield.raw) ? sd.dividendYield.raw * 100 : null;
            quote.beta = sd.beta && sd.beta.raw;
            quote.roe = fd.returnOnEquity && fd.returnOnEquity.raw;
            quote.grossMargin = fd.grossMargins && fd.grossMargins.raw;
            quote.totalDebtCr = (fd.totalDebt && fd.totalDebt.raw) ? fd.totalDebt.raw / 1e7 : null;
            quote.expenseRatio = (ks.annualReportExpenseRatio && ks.annualReportExpenseRatio.raw) ? ks.annualReportExpenseRatio.raw * 100 : null;
          }
        })
        .catch(function () { /* fundamentals unavailable live — patched from seeded data below */ })
        .then(function () {
          var seededF = getSeededQuote(symbol);
          if (seededF) {
            quote.pe = quote.pe != null ? quote.pe : seededF.pe;
            quote.eps = quote.eps != null ? quote.eps : seededF.eps;
            quote.divYield = quote.divYield != null ? quote.divYield : seededF.divYield;
            quote.beta = quote.beta != null ? quote.beta : seededF.beta;
            quote.roe = quote.roe != null ? quote.roe : seededF.roe;
            quote.grossMargin = quote.grossMargin != null ? quote.grossMargin : seededF.grossMargin;
            quote.totalDebtCr = quote.totalDebtCr != null ? quote.totalDebtCr : seededF.totalDebtCr;
            quote.mcapCr = seededF.mcapCr;
          }
          return quote;
        });
    })
    .then(function (quote) { callback(quote, null); })
    .catch(function (e) {
      console.warn('Live fetch failed for ' + symbol + ', falling back to seeded data:', e.message);
      var seeded = getSeededQuote(symbol);
      if (seeded) seeded.src = 'seeded';
      callback(seeded, seeded ? null : e);
    });
}

function fetchHistory(symbol, rangeKey, callback) {
  if (!LIVE_MODE) {
    var seeded = getSeededHistory(symbol, rangeKey);
    if (!seeded) { callback(null, new Error('Unknown symbol: ' + symbol)); return; }
    seeded.src = 'seeded';
    setTimeout(function () { callback(seeded, null); }, 150);
    return;
  }
  fetchJSON(YF1 + encodeURIComponent(symbol) + '?interval=1d&range=' + rangeKey + '&includePrePost=false')
    .then(function (d) {
      if (!d || !d.chart || !d.chart.result || !d.chart.result.length) throw new Error('no data');
      var res = d.chart.result[0], ts = res.timestamp || [];
      var rawCloses = res.indicators.quote[0].close || [];
      var prices = [], dates = [];
      for (var i = 0; i < rawCloses.length; i++) {
        if (rawCloses[i] != null) {
          prices.push(Math.round(rawCloses[i] * 100) / 100);
          dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
        }
      }
      if (!prices.length) throw new Error('empty series');
      callback({ prices: prices, dates: dates, volumes: res.indicators.quote[0].volume || [], src: 'live' }, null);
    })
    .catch(function (e) {
      console.warn('Live history fetch failed for ' + symbol + ', falling back to seeded data:', e.message);
      var seeded = getSeededHistory(symbol, rangeKey);
      if (seeded) seeded.src = 'seeded';
      callback(seeded, seeded ? null : e);
    });
}

// Lighter-weight than fetchQuote: price/change only, no fundamentals call. Used by the
// ticker strip and alert checks, which never display P/E, ROE, etc.
function fetchPriceOnly(symbol, callback) {
  if (!LIVE_MODE) {
    var seeded = getSeededQuote(symbol);
    if (seeded) seeded.src = 'seeded';
    callback(seeded || null, seeded ? null : new Error('unknown symbol'));
    return;
  }
  fetchJSON(YF1 + encodeURIComponent(symbol) + '?interval=1d&range=5d&includePrePost=false')
    .then(function (cd) {
      if (!cd || !cd.chart || !cd.chart.result || !cd.chart.result.length) throw new Error('no data for ' + symbol);
      var meta = cd.chart.result[0].meta;
      var price = meta.regularMarketPrice || meta.previousClose || meta.chartPreviousClose || 0;
      var prev = meta.previousClose || meta.chartPreviousClose || price;
      var chg = meta.regularMarketChange != null ? meta.regularMarketChange : (price - prev);
      var chgPct = meta.regularMarketChangePercent != null ? meta.regularMarketChangePercent : ((chg / prev) * 100);
      callback({ sym: symbol, price: price, chg: chg, chgPct: chgPct, src: 'live' }, null);
    })
    .catch(function (e) {
      var seeded = getSeededQuote(symbol);
      if (seeded) seeded.src = 'seeded';
      callback(seeded || null, seeded ? null : e);
    });
}

function srcBadge(src) {
  if (src === 'live') return '<span class="src-badge src-live"><span class="src-dot"></span>LIVE</span>';
  return '<span class="src-badge src-sim">SIMULATED</span>';
}

function updateStatusBar() {
  var dot = $('status-dot'), text = $('status-text');
  if (LIVE_MODE) { dot.classList.add('live'); text.textContent = 'Live mode - Yahoo Finance (direct + CORS-proxy fallback), auto-falls back to realistic simulated data per symbol if blocked'; }
  else { dot.classList.remove('live'); text.textContent = 'Simulated data mode (deterministic, offline-safe)'; }
}

// ---------- TABS ----------

function sw(n) {
  var order = ['a', 't', 'fc', 'opt', 'mac', 'earn', 'hm', 'news', 'al', 'bt', 'port', 'sc'];
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('on', order[i] === n); }
  var scrs = document.querySelectorAll('.scr');
  for (var j = 0; j < scrs.length; j++) { scrs[j].classList.remove('on'); }
  $('scr-' + n).classList.add('on');
}

// ---------- ANALYSE ----------

function doA() {
  var sym = ($('a-sym').value || 'RELIANCE.NS').toUpperCase().trim();
  var typ = $('a-type').value;
  $('a-load').style.display = 'block';
  $('a-main').style.display = 'none';
  $('a-ai').style.display = 'none';
  $('a-err').style.display = 'none';

  fetchQuote(sym, function (q, err) {
    $('a-load').style.display = 'none';
    if (err || !q) {
      $('a-err').style.display = 'block';
      $('a-err').textContent = 'Could not load data for "' + sym + '". Try RELIANCE.NS, TCS.NS, ^NSEI, ^BSESN, HDFCBANK.NS.';
      return;
    }
    fetchHistory(sym, '6mo', function (hist, herr) {
      $('a-main').style.display = 'block';
      curA = q; curA.typ = typ;
      var up = q.chg >= 0;
      $('a-price').textContent = fINp(q.price);
      var ce = $('a-chg'); ce.innerHTML = (up ? '+' : '') + f2(q.chg) + ' (' + (up ? '+' : '') + f2(q.chgPct) + '%) ' + srcBadge(q.src); ce.className = 'ks ' + (up ? 'up' : 'dn');
      $('a-mc').textContent = q.mcap ? fIN(q.mcap) : (q.mcapCr ? fMCr(q.mcapCr) : '--');
      $('a-mc2').textContent = typ.toUpperCase();
      $('a-vol').textContent = q.volume ? fV(q.volume) : '--';
      if (q.lo52 && q.hi52) {
        $('a-52').textContent = fINp(q.lo52) + ' to ' + fINp(q.hi52);
        $('a-rf').style.width = Math.round(((q.price - q.lo52) / (q.hi52 - q.lo52)) * 100) + '%';
      }
      dC('a-c');
      if (hist && hist.prices && hist.prices.length) {
        var col = up ? '#4ADE80' : '#F87171';
        CH['a-c'] = new Chart($('a-c').getContext('2d'), {
          type: 'line',
          data: { labels: hist.dates, datasets: [{ data: hist.prices, borderColor: col, borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: up ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', spanGaps: true }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return 'Rs ' + v.toLocaleString('en-IN'); } } } } }
        });
      }
      var vEl = $('a-val'), fEl = $('a-fund');
      if (typ === 'bond') {
        vEl.innerHTML = ir('Yield', q.divYield ? f2(q.divYield) + '%' : '6.85%') + ir('Type', 'G-Sec / Bond ETF') + ir('Expense', q.expenseRatio ? f2(q.expenseRatio) + '%' : '--') + ir('Beta', q.beta ? f2(q.beta) : '--');
        fEl.innerHTML = ir('AUM', q.mcap ? fIN(q.mcap) : (q.mcapCr ? fMCr(q.mcapCr) : '--')) + ir('Volume', q.volume ? fV(q.volume) : '--') + ir('52w low', q.lo52 ? fINp(q.lo52) : '--') + ir('52w high', q.hi52 ? fINp(q.hi52) : '--');
      } else if (typ === 'etf') {
        vEl.innerHTML = ir('P/E', q.pe ? f2(q.pe) : '--') + ir('Div yield', q.divYield ? f2(q.divYield) + '%' : '--') + ir('Expense', q.expenseRatio ? f2(q.expenseRatio) + '%' : '--') + ir('Beta', q.beta ? f2(q.beta) : '--');
        fEl.innerHTML = ir('AUM', q.mcap ? fIN(q.mcap) : (q.mcapCr ? fMCr(q.mcapCr) : '--')) + ir('Volume', q.volume ? fV(q.volume) : '--') + ir('52w low', q.lo52 ? fINp(q.lo52) : '--') + ir('52w high', q.hi52 ? fINp(q.hi52) : '--');
      } else if (typ === 'index') {
        vEl.innerHTML = ir('P/E', q.pe ? f2(q.pe) : '--') + ir('Day chg', (up ? '+' : '') + f2(q.chgPct) + '%') + ir('52w low', q.lo52 ? fINp(q.lo52) : '--') + ir('52w high', q.hi52 ? fINp(q.hi52) : '--');
        fEl.innerHTML = ir('Volume', q.volume ? fV(q.volume) : '--') + ir('Type', 'Broad market index') + ir('Exchange', sym.indexOf('BSE') > -1 ? 'BSE' : 'NSE') + ir('Symbol', sym);
      } else {
        vEl.innerHTML = ir('P/E (TTM)', q.pe ? f2(q.pe) : '--') + ir('EPS', q.eps ? fINp(q.eps) : '--') + ir('Div yield', q.divYield ? f2(q.divYield) + '%' : '--') + ir('Beta', q.beta ? f2(q.beta) : '--');
        fEl.innerHTML = ir('ROE', q.roe ? f1(q.roe * 100) + '%' : '--') + ir('Gross margin', q.grossMargin ? f1(q.grossMargin * 100) + '%' : '--') + ir('Total debt', q.totalDebtCr ? fMCr(q.totalDebtCr) : '--') + ir('Mkt cap', q.mcap ? fIN(q.mcap) : (q.mcapCr ? fMCr(q.mcapCr) : '--'));
      }
      renderFundScore(q, typ);
    });
  });
}

// ---------- FUNDAMENTAL SCORE ----------
// A simple, transparent 0-100 composite from valuation, profitability, leverage and
// income (yield). Bands (not sector-relative percentiles) since this is a lightweight
// client-side heuristic, not a substitute for real equity research.

function scoreBand(score) {
  if (score >= 70) return { label: 'Strong', cls: 'up' };
  if (score >= 45) return { label: 'Moderate', cls: 'neu' };
  return { label: 'Weak', cls: 'dn' };
}

function fundScoreBar(label, pct, cls) {
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  return '<div class="fs-row"><span class="fs-l">' + label + '</span><div class="fs-bar"><div class="fs-fill ' + (cls || '') + '" style="width:' + pct + '%"></div></div><span class="fs-v">' + pct + '</span></div>';
}

function renderFundScore(q, typ) {
  var wrap = $('a-fscore');
  if (!wrap) return;
  if (typ !== 'stock' && typ !== 'etf') { wrap.style.display = 'none'; return; }
  // Valuation: lower P/E scores higher (P/E 10 -> 100, P/E 60+ -> 0)
  var valS = q.pe ? Math.max(0, Math.min(100, 100 - ((q.pe - 10) / 50) * 100)) : 50;
  // Profitability: ROE 0% -> 0, 30%+ -> 100
  var profS = q.roe != null ? Math.max(0, Math.min(100, (q.roe * 100 / 30) * 100)) : 50;
  // Leverage: debt/mkt-cap ratio; 0 -> 100, 100%+ of mcap in debt -> 0
  var mcapCrForDebt = q.mcapCr || (q.mcap ? q.mcap / 1e7 : null);
  var debtRatio = (q.totalDebtCr && mcapCrForDebt) ? q.totalDebtCr / mcapCrForDebt : null;
  var levS = debtRatio != null ? Math.max(0, Math.min(100, 100 - debtRatio * 100)) : 60;
  // Income: dividend yield 0% -> 40 baseline, 4%+ -> 100
  var incS = q.divYield != null ? Math.max(0, Math.min(100, 40 + (q.divYield / 4) * 60)) : 40;
  var composite = Math.round(valS * 0.3 + profS * 0.3 + levS * 0.2 + incS * 0.2);
  var band = scoreBand(composite);
  wrap.style.display = 'block';
  wrap.innerHTML = '<div class="ict">Fundamental score <span class="' + band.cls + '" style="font-weight:700;text-transform:none;letter-spacing:0">' + composite + '/100 - ' + band.label + '</span></div>' +
    fundScoreBar('Valuation (P/E)', valS) + fundScoreBar('Profitability (ROE)', profS) + fundScoreBar('Leverage', levS) + fundScoreBar('Income (yield)', incS) +
    '<div class="note" style="margin-top:7px">Heuristic composite from absolute P/E, ROE, debt/mkt-cap and yield bands - not sector-relative, not investment advice.</div>';
}

// ---------- TECHNICAL INDICATORS ----------

function sma(d, n) { var out = []; for (var i = 0; i < d.length; i++) { if (i < n - 1) { out.push(null); continue; } var s = []; for (var j = i - n + 1; j <= i; j++) { if (d[j] != null) s.push(d[j]); } out.push(s.length ? Math.round((s.reduce(function (a, b) { return a + b; }, 0) / s.length) * 100) / 100 : null); } return out; }
function ema(d, n) { var k = 2 / (n + 1), p = null, out = []; for (var i = 0; i < d.length; i++) { var v = d[i]; if (v == null) { out.push(null); continue; } if (p == null) { p = v; out.push(v); continue; } p = Math.round((v * k + p * (1 - k)) * 100) / 100; out.push(p); } return out; }
function boll(d, n, m) { n = n || 20; m = m || 2; var out = []; for (var i = 0; i < d.length; i++) { if (i < n - 1) { out.push({ u: null, l: null }); continue; } var s = []; for (var j = i - n + 1; j <= i; j++) { if (d[j] != null) s.push(d[j]); } var mn = s.reduce(function (a, b) { return a + b; }, 0) / s.length; var sd = Math.sqrt(s.reduce(function (a, b) { return a + Math.pow(b - mn, 2); }, 0) / s.length); out.push({ u: Math.round((mn + m * sd) * 100) / 100, l: Math.round((mn - m * sd) * 100) / 100 }); } return out; }
function rsiCalc(d, n) { n = n || 14; var g = [], l = [], out = [null]; for (var i = 1; i < d.length; i++) { var diff = d[i] - d[i - 1]; g.push(diff > 0 ? diff : 0); l.push(diff < 0 ? -diff : 0); if (i < n) { out.push(null); continue; } var ag = 0, al = 0; for (var j = g.length - n; j < g.length; j++) { ag += g[j]; al += l[j]; } ag /= n; al /= n; out.push(al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 100) / 100); } return out; }
function macdCalc(d) { var e12 = ema(d, 12), e26 = ema(d, 26); var line = []; for (var i = 0; i < d.length; i++) { line.push((e12[i] != null && e26[i] != null) ? Math.round((e12[i] - e26[i]) * 100) / 100 : null); } var vals = []; for (var j = 0; j < line.length; j++) { if (line[j] != null) vals.push(line[j]); } var sig = ema(vals, 9); var si = 0, sigFull = []; for (var k = 0; k < line.length; k++) { if (line[k] == null) { sigFull.push(null); } else { sigFull.push(sig[si] != null ? sig[si] : null); si++; } } return { line: line, signal: sigFull }; }
function atrCalc(d, n) { n = n || 14; var tr = []; for (var i = 0; i < d.length; i++) { tr.push(i === 0 ? 0 : Math.abs(d[i] - (d[i - 1] || 0))); } return sma(tr, n); }
function lastVal(arr) { for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] != null) return arr[i]; } return null; }

function doT() {
  var sym = ($('t-sym').value || 'RELIANCE.NS').toUpperCase().trim();
  var per = $('t-per').value;
  $('t-load').style.display = 'block';
  $('t-main').style.display = 'none';
  $('t-err').style.display = 'none';
  fetchHistory(sym, per, function (hist, err) {
    $('t-load').style.display = 'none';
    if (err || !hist) { $('t-err').style.display = 'block'; $('t-err').textContent = 'Could not load data for ' + sym + '.'; return; }
    $('t-main').style.display = 'block';
    tdata = { sym: sym, closes: hist.prices, vols: hist.volumes || [], dates: hist.dates };
    renderT();
  });
}

function renderT() {
  if (!tdata) return;
  var closes = tdata.closes, vols = tdata.vols, dates = tdata.dates;
  var s20 = sma(closes, 20), s50 = sma(closes, 50), e12 = ema(closes, 12), e26 = ema(closes, 26);
  var bb = boll(closes), r = rsiCalc(closes), macdR = macdCalc(closes), at = atrCalc(closes);
  var ml = macdR.line, ms = macdR.signal;
  var ds = [{ label: 'Price', data: closes, borderColor: '#FF9933', borderWidth: 1.5, pointRadius: 0, fill: false, order: 10 }];
  if (inds.sma) { ds.push({ label: 'SMA 20', data: s20, borderColor: '#4ADE80', borderWidth: 1, pointRadius: 0, fill: false, order: 5, borderDash: [4, 2] }); ds.push({ label: 'SMA 50', data: s50, borderColor: '#F87171', borderWidth: 1, pointRadius: 0, fill: false, order: 4, borderDash: [6, 3] }); }
  if (inds.ema) { ds.push({ label: 'EMA 12', data: e12, borderColor: '#60A5FA', borderWidth: 1, pointRadius: 0, fill: false, order: 3, borderDash: [3, 1] }); ds.push({ label: 'EMA 26', data: e26, borderColor: '#C29CF0', borderWidth: 1, pointRadius: 0, fill: false, order: 2, borderDash: [5, 2] }); }
  if (inds.bb) { var bbU = [], bbL = []; for (var i = 0; i < bb.length; i++) { bbU.push(bb[i].u); bbL.push(bb[i].l); } ds.push({ label: 'BB upper', data: bbU, borderColor: 'rgba(194,156,240,0.5)', borderWidth: 1, pointRadius: 0, fill: false, order: 1, borderDash: [2, 2] }); ds.push({ label: 'BB lower', data: bbL, borderColor: 'rgba(194,156,240,0.5)', borderWidth: 1, pointRadius: 0, fill: '-1', backgroundColor: 'rgba(194,156,240,0.05)', order: 0, borderDash: [2, 2] }); }
  dC('t-c');
  CH['t-c'] = new Chart($('t-c').getContext('2d'), { type: 'line', data: { labels: dates, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#8892a4', font: { size: 10 }, boxWidth: 9, padding: 6 } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return 'Rs ' + v.toFixed(0); } } } } } });

  var subWrap = $('t-sw');
  dC('t-sub');
  var hasSub = inds.rsi || inds.macd || inds.vol || inds.atr;
  subWrap.style.display = hasSub ? 'block' : 'none';
  if (hasSub) {
    var sds = [];
    if (inds.rsi) { sds = [{ label: 'RSI 14', data: r, borderColor: '#4ADE80', borderWidth: 1.5, pointRadius: 0, fill: false }]; }
    else if (inds.macd) { sds = [{ label: 'MACD', data: ml, borderColor: '#FF9933', borderWidth: 1.5, pointRadius: 0, fill: false }, { label: 'Signal', data: ms, borderColor: '#F87171', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [4, 2] }]; }
    else if (inds.vol) { sds = [{ label: 'Volume', data: vols, backgroundColor: 'rgba(255,153,51,0.3)', borderColor: 'rgba(255,153,51,0.5)', borderWidth: 0, fill: true, type: 'bar' }]; }
    else if (inds.atr) { sds = [{ label: 'ATR 14', data: at, borderColor: '#FFB05C', borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [3, 2] }]; }
    CH['t-sub'] = new Chart($('t-sub').getContext('2d'), { type: 'line', data: { labels: dates, datasets: sds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return inds.vol ? fV(v) : f1(v); } } } } } });
  }

  var lastR = lastVal(r), lastML = lastVal(ml), lastMS = lastVal(ms), lp = lastVal(closes), ls20 = lastVal(s20), ls50 = lastVal(s50);
  var bbVals = []; for (var bi = 0; bi < bb.length; bi++) { if (bb[bi].u != null) bbVals.push(bb[bi]); }
  var lbb = bbVals.length ? bbVals[bbVals.length - 1] : null;
  var latr = lastVal(at);
  $('t-iv').innerHTML = ir('RSI (14)', lastR ? f1(lastR) : '--') + ir('MACD line', lastML ? f2(lastML) : '--') + ir('MACD signal', lastMS ? f2(lastMS) : '--') + ir('SMA 20', ls20 ? fINp(ls20) : '--') + ir('SMA 50', ls50 ? fINp(ls50) : '--') + ir('ATR (14)', latr ? f2(latr) : '--');
  var sigs = [];
  if (lastR != null) { if (lastR > 70) sigs.push('<span class="dn">RSI ' + f1(lastR) + ' - overbought</span>'); else if (lastR < 30) sigs.push('<span class="up">RSI ' + f1(lastR) + ' - oversold</span>'); else sigs.push('RSI ' + f1(lastR) + ' - neutral'); }
  if (ls20 && ls50) { if (ls20 > ls50) sigs.push('<span class="up">SMA 20 above 50 - bullish</span>'); else sigs.push('<span class="dn">SMA 20 below 50 - bearish</span>'); }
  if (lastML != null && lastMS != null) { if (lastML > lastMS) sigs.push('<span class="up">MACD above signal - bullish</span>'); else sigs.push('<span class="dn">MACD below signal - bearish</span>'); }
  if (lbb && lp) { if (lp > lbb.u) sigs.push('<span class="dn">Above BB upper - extended</span>'); else if (lp < lbb.l) sigs.push('<span class="up">Below BB lower - oversold</span>'); else sigs.push('Price inside Bollinger bands'); }
  $('t-sig').innerHTML = sigs.length ? sigs.map(function (s) { return '<div class="ir"><span>' + s + '</span></div>'; }).join('') : '<div class="ir"><span style="color:#8892a4">Toggle indicators above</span></div>';
}

function tog(k) {
  if (k === 'rsi' || k === 'macd' || k === 'vol' || k === 'atr') {
    if (inds[k]) { inds[k] = false; } else { inds.rsi = false; inds.macd = false; inds.vol = false; inds.atr = false; inds[k] = true; }
  } else { inds[k] = !inds[k]; }
  var chips = document.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) { var id = chips[i].getAttribute('data-ind'); chips[i].classList.toggle('on', !!inds[id]); }
  if (tdata) renderT();
}

// ---------- OPTIONS CHAIN (Black-Scholes) ----------

function bsm(S, K, T, r, sigma, type) {
  var d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  var d2 = d1 - sigma * Math.sqrt(T);
  function N(x) { var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911; var sign = x < 0 ? -1 : 1; x = Math.abs(x); var t2 = 1 / (1 + p * x); var y = 1 - (((((a5 * t2 + a4) * t2) + a3) * t2 + a2) * t2 + a1) * t2 * Math.exp(-x * x / 2); return 0.5 * (1 + sign * y); }
  var nd1 = N(d1), nd2 = N(d2), npd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  if (type === 'call') { var price = S * nd1 - K * Math.exp(-r * T) * nd2; var delta = nd1; var gamma = npd1 / (S * sigma * Math.sqrt(T)); var theta = (-S * npd1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nd2) / 365; var vega = S * npd1 * Math.sqrt(T) / 100; return { price: price, delta: delta, gamma: gamma, theta: theta, vega: vega }; }
  else { var price2 = K * Math.exp(-r * T) * N(-d2) - S * N(-d1); var delta2 = nd1 - 1; var gamma2 = npd1 / (S * sigma * Math.sqrt(T)); var theta2 = (-S * npd1 * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)) / 365; var vega2 = S * npd1 * Math.sqrt(T) / 100; return { price: price2, delta: delta2, gamma: gamma2, theta: theta2, vega: vega2 }; }
}

function updOptDefaults() { var idx = $('opt-idx').value; $('opt-price').value = idx === 'NIFTY' ? 23500 : 50800; }

function buildChain() {
  var idx = $('opt-idx').value;
  var S = parseFloat($('opt-price').value);
  var T = parseFloat($('opt-exp').value);
  var iv = parseFloat($('opt-vol').value) || 13.5;
  var sigma = iv / 100, r = RBI_REPO;
  if (!S) S = idx === 'NIFTY' ? 23500 : 50800;
  var lotSpacing = idx === 'NIFTY' ? 50 : 100;
  var strikes = []; for (var i = -5; i <= 5; i++) { strikes.push(Math.round((S + i * lotSpacing * 2) / lotSpacing) * lotSpacing); }
  var atm = bsm(S, S, T, r, sigma, 'call');
  $('og-call').textContent = fINp(atm.price);
  $('og-put').textContent = fINp(bsm(S, S, T, r, sigma, 'put').price);
  $('og-delta').textContent = f2(atm.delta);
  var tbody = $('opt-body'); tbody.innerHTML = '';
  for (var j = 0; j < strikes.length; j++) {
    var K = strikes[j];
    var c = bsm(S, K, T, r, sigma, 'call'), p = bsm(S, K, T, r, sigma, 'put');
    var itm = K < S;
    var spread = Math.max(c.price * 0.03, 0.5);
    var tr = document.createElement('tr'); if (itm) tr.className = 'itm';
    tr.innerHTML = '<td style="font-weight:700">' + K.toLocaleString('en-IN') + '</td><td>' + f2(c.price - spread / 2) + '</td><td>' + f2(c.price + spread / 2) + '</td><td>' + f2(c.delta) + '</td><td>' + c.gamma.toFixed(4) + '</td><td>' + f2(c.theta) + '</td><td>' + f2(c.vega) + '</td><td>' + f2(p.price - spread / 2) + '</td><td>' + f2(p.price + spread / 2) + '</td><td>' + f2(p.delta) + '</td>';
    tbody.appendChild(tr);
  }
}

// ---------- FORECAST (statistical projection, not a prediction) ----------
// Method: fit drift (mean) and volatility (stdev) from daily log returns over the
// trailing year, then project a geometric-Brownian-motion median path plus a 68%
// (+-1 sigma) and 90% (+-1.645 sigma) confidence cone out to the chosen horizon.
// This is a standard quantitative baseline (the same lognormal model underlies
// Black-Scholes) - it is NOT a market prediction and says so on the tab.

function normCDF(x) {
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var sign = x < 0 ? -1 : 1; x = Math.abs(x) / Math.sqrt(2);
  var t = 1 / (1 + p * x);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function genForwardBizDates(lastDateStr, n) {
  var d = new Date(lastDateStr + 'T00:00:00Z'), out = [];
  while (out.length < n) {
    d = new Date(d.getTime() + 86400000);
    var day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function runForecast(closes, dates, horizonDays) {
  var logR = [];
  for (var i = 1; i < closes.length; i++) { if (closes[i] > 0 && closes[i - 1] > 0) logR.push(Math.log(closes[i] / closes[i - 1])); }
  var n = logR.length;
  var mu = logR.reduce(function (a, b) { return a + b; }, 0) / n;
  var variance = logR.reduce(function (a, b) { return a + Math.pow(b - mu, 2); }, 0) / (n - 1);
  var sigma = Math.sqrt(variance);
  var S0 = closes[closes.length - 1];
  var fwdDates = genForwardBizDates(dates[dates.length - 1], horizonDays);
  var median = [], upper68 = [], lower68 = [], upper90 = [], lower90 = [];
  for (var t = 1; t <= horizonDays; t++) {
    var driftTerm = (mu - 0.5 * sigma * sigma) * t;
    var spread = sigma * Math.sqrt(t);
    median.push(Math.round(S0 * Math.exp(driftTerm) * 100) / 100);
    upper68.push(Math.round(S0 * Math.exp(driftTerm + spread) * 100) / 100);
    lower68.push(Math.round(S0 * Math.exp(driftTerm - spread) * 100) / 100);
    upper90.push(Math.round(S0 * Math.exp(driftTerm + 1.645 * spread) * 100) / 100);
    lower90.push(Math.round(S0 * Math.exp(driftTerm - 1.645 * spread) * 100) / 100);
  }
  var T = horizonDays;
  var probUp = 1 - normCDF((0 - (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T)));
  return {
    fwdDates: fwdDates, median: median, upper68: upper68, lower68: lower68, upper90: upper90, lower90: lower90,
    S0: S0, annVol: sigma * Math.sqrt(252) * 100, annDrift: mu * 252 * 100, probUp: probUp * 100,
    expPrice: median[median.length - 1], loRange: lower68[lower68.length - 1], hiRange: upper68[upper68.length - 1]
  };
}

function doForecast() {
  var sym = ($('fc-sym').value || 'RELIANCE.NS').toUpperCase().trim();
  var horizon = parseInt($('fc-horizon').value, 10) || 30;
  $('fc-load').style.display = 'block'; $('fc-main').style.display = 'none'; $('fc-err').style.display = 'none';
  fetchHistory(sym, '1y', function (hist, err) {
    $('fc-load').style.display = 'none';
    if (err || !hist || hist.prices.length < 30) { $('fc-err').style.display = 'block'; $('fc-err').textContent = 'Not enough history to project ' + sym + ' (need 30+ trading days).'; return; }
    $('fc-main').style.display = 'block';
    var fc = runForecast(hist.prices, hist.dates, horizon);
    var up = fc.expPrice >= fc.S0;
    $('fc-src').innerHTML = srcBadge(hist.src);
    $('fc-cur').textContent = fINp(fc.S0);
    var ee = $('fc-exp'); ee.textContent = fINp(fc.expPrice); ee.className = 'kv ' + (up ? 'up' : 'dn');
    $('fc-rng').textContent = fINp(fc.loRange) + ' - ' + fINp(fc.hiRange);
    $('fc-vol').textContent = f1(fc.annVol) + '%';
    $('fc-drift').textContent = (fc.annDrift >= 0 ? '+' : '') + f1(fc.annDrift) + '%';
    var pu = $('fc-prob'); pu.textContent = f1(fc.probUp) + '%'; pu.className = 'kv ' + (fc.probUp >= 50 ? 'up' : 'dn');

    var histLabels = hist.dates, allLabels = histLabels.concat(fc.fwdDates);
    var nHist = histLabels.length;
    function pad(arr, atEndVal) { var out = new Array(nHist - 1).fill(null); out.push(atEndVal); return out.concat(arr); }
    dC('fc-c');
    CH['fc-c'] = new Chart($('fc-c').getContext('2d'), {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          { label: 'Price (history)', data: hist.prices.concat(new Array(horizon).fill(null)), borderColor: '#FF9933', borderWidth: 1.5, pointRadius: 0, fill: false, order: 10 },
          { label: '90% upper', data: pad(fc.upper90, fc.S0), borderColor: 'rgba(96,165,250,0.35)', borderWidth: 1, pointRadius: 0, borderDash: [2, 2], fill: false, order: 1 },
          { label: '68% upper', data: pad(fc.upper68, fc.S0), borderColor: 'rgba(96,165,250,0.6)', borderWidth: 1, pointRadius: 0, borderDash: [3, 2], fill: '+1', backgroundColor: 'rgba(96,165,250,0.08)', order: 2 },
          { label: 'Median projection', data: pad(fc.median, fc.S0), borderColor: '#60A5FA', borderWidth: 2, pointRadius: 0, fill: false, order: 3 },
          { label: '68% lower', data: pad(fc.lower68, fc.S0), borderColor: 'rgba(96,165,250,0.6)', borderWidth: 1, pointRadius: 0, borderDash: [3, 2], fill: '-1', backgroundColor: 'rgba(96,165,250,0.08)', order: 4 },
          { label: '90% lower', data: pad(fc.lower90, fc.S0), borderColor: 'rgba(96,165,250,0.35)', borderWidth: 1, pointRadius: 0, borderDash: [2, 2], fill: '-1', backgroundColor: 'rgba(96,165,250,0.05)', order: 5 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#8892a4', font: { size: 9 }, boxWidth: 8, padding: 5, filter: function (item) { return item.text.indexOf('90%') === -1; } } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return 'Rs ' + v.toLocaleString('en-IN'); } } } } }
    });
  });
}

// ---------- MACRO ----------

function initMacro() {
  var g = $('mac-grid');
  var html = '';
  for (var i = 0; i < MACRO_DATA.length; i++) {
    var m = MACRO_DATA[i];
    html += '<div class="macro-c"><div class="macro-l">' + m.l + '</div><div class="macro-v" id="mac-v-' + i + '">' + m.v + '</div><div class="macro-s ' + m.c + '" id="mac-s-' + i + '">' + m.s + '</div></div>';
  }
  g.innerHTML = html;
  // Entries with a Yahoo ticker (INR/USD, India VIX) get live-fetched and overwritten
  // in place; everything else is a periodic official release with no ticker to poll,
  // shown pinned to its last release as any real terminal would.
  MACRO_DATA.forEach(function (m, i) {
    if (!m.ySym) return;
    fetchPriceOnly(m.ySym, function (q) {
      if (!q) return;
      var vEl = $('mac-v-' + i), sEl = $('mac-s-' + i);
      if (!vEl) return;
      vEl.textContent = f2(q.price);
      sEl.innerHTML = (q.chgPct >= 0 ? '+' : '') + f2(q.chgPct) + '% today ' + srcBadge(q.src);
      sEl.className = 'macro-s ' + (q.chgPct >= 0 ? 'up' : 'dn');
    });
  });
  $('mac-flows').innerHTML = ir('FII cash', '-Rs 1,240 Cr') + ir('DII cash', '+Rs 2,180 Cr') + ir('FII F and O net', '-Rs 3,450 Cr') + ir('FII month to date', '-Rs 8,920 Cr') + ir('DII month to date', '+Rs 14,600 Cr') + ir('Net institutional', 'DII-led support') + '<div class="note" style="margin-top:6px">NSE/NSDL publish these end-of-day, with no free live feed - shown as last known session, not real-time.</div>';
  $('mac-sp').innerHTML = ir('Repo vs 10Y spread', '+135bp') + ir('SDF rate', '5.25%') + ir('MSF rate', '5.75%') + ir('Call money rate', '5.48%') + ir('CD 3M rate', '6.20%') + ir('AAA corp spread', '45bp');
  dC('mac-c');
  var labels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  var cpi = [3.6, 3.65, 2.07, 2.36, 2.58, 3.04, 3.30, 3.34, 2.82, 3.16, 3.16, 3.16];
  var repo = [6.5, 6.5, 6.5, 6.5, 6.25, 6.25, 6.25, 6.0, 6.0, 6.0, 5.5, 5.5];
  CH['mac-c'] = new Chart($('mac-c').getContext('2d'), { type: 'line', data: { labels: labels, datasets: [{ label: 'CPI YoY %', data: cpi, borderColor: '#F87171', borderWidth: 1.5, pointRadius: 2, fill: false }, { label: 'RBI repo %', data: repo, borderColor: '#FF9933', borderWidth: 1.5, pointRadius: 2, fill: false, borderDash: [5, 3] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#8892a4', font: { size: 10 }, boxWidth: 10, padding: 8 } } }, scales: { x: { grid: { display: false }, ticks: { color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return v + '%'; } } } } } });
}

// ---------- EARNINGS ----------

function renderEarnings() {
  var filter = $('earn-filter').value;
  var items = EARNINGS_DATA.filter(function (e) { if (filter === 'beat') return e.beat === true; if (filter === 'miss') return e.beat === false; return true; });
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var e = items[i];
    var bdg = e.beat === true ? '<span class="bdg bs">Beat</span>' : e.beat === false ? '<span class="bdg bco">Miss</span>' : '<span class="bdg be">Expected</span>';
    html += '<div class="earn-item"><div><span style="font-weight:700;font-size:13px">' + e.sym + '</span> <span style="color:#8892a4;font-size:11px">' + e.name + '</span> ' + bdg + '</div><div style="text-align:right"><div style="font-size:11px;color:#8892a4">' + e.date + ' ' + e.day + '</div><div style="font-size:12px">EPS est: <strong>Rs ' + f2(e.epsEst) + '</strong> <span style="color:#8892a4">prev Rs ' + f2(e.epsPrev) + '</span></div><div style="font-size:11px;color:#8892a4">Rev: ' + e.revEst + '</div></div></div>';
  }
  $('earn-list').innerHTML = html;
}

// ---------- HEATMAP ----------

function buildHeatmap() {
  var view = $('hm-view').value;
  var data = HEATMAP_DATA[view] || [];
  var grid = $('hm-grid');
  var cols = (view === 'global' || view === 'indices') ? 3 : 5;
  grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  var html = '';
  for (var i = 0; i < data.length; i++) {
    var d = data[i];
    var up = d.chg > 0.2, dn = d.chg < -0.2, intensity = Math.min(Math.abs(d.chg) / 4, 1);
    var bg, tc;
    if (up) { bg = 'rgba(74,222,128,' + (0.1 + intensity * 0.4) + ')'; tc = '#1a3320'; }
    else if (dn) { bg = 'rgba(248,113,113,' + (0.1 + intensity * 0.4) + ')'; tc = '#3d1f1f'; }
    else { bg = 'rgba(136,146,164,0.12)'; tc = '#2c2c2a'; }
    html += '<div class="hm-cell" style="background:' + bg + '" data-sym="' + d.s + '"><div class="hm-sym" style="color:' + tc + '">' + d.s + '</div>' + (d.n ? '<div style="font-size:9px;color:' + tc + ';opacity:0.85">' + d.n + '</div>' : '') + '<div class="hm-chg" style="color:' + tc + '">' + (d.chg > 0 ? '+' : '') + f2(d.chg) + '%</div></div>';
  }
  grid.innerHTML = html;
  var cells = grid.querySelectorAll('.hm-cell');
  for (var j = 0; j < cells.length; j++) {
    cells[j].addEventListener('click', function () {
      var sym = this.getAttribute('data-sym');
      var full = (sym.indexOf('NIFTY') > -1) ? sym : sym + '.NS';
      $('a-sym').value = full; sw('a'); doA();
    });
  }
}

// ---------- NEWS ----------

function loadNews() {
  var sym = ($('news-sym').value || '').toUpperCase().trim();
  var sent = $('news-sent').value;
  var items = NEWS_DATA.filter(function (n) {
    if (sym && n.sym !== sym && n.title.toUpperCase().indexOf(sym) === -1) return false;
    if (sent !== 'all' && n.sentiment !== sent) return false;
    return true;
  });
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var n = items[i];
    var sc = n.sentiment === 'pos' ? 'up' : n.sentiment === 'neg' ? 'dn' : 'neu';
    var sl = n.sentiment === 'pos' ? 'Positive' : n.sentiment === 'neg' ? 'Negative' : 'Neutral';
    var bdgClass = n.sentiment === 'pos' ? 'bs' : n.sentiment === 'neg' ? 'bco' : 'be';
    html += '<div class="news-item"><div class="news-src">' + n.src + ' . ' + n.time + ' . <span class="bdg ' + bdgClass + '">' + n.sym + '</span></div><div class="news-title">' + n.title + '</div><div class="news-sentiment ' + sc + '">' + sl + ' sentiment</div></div>';
  }
  $('news-list').innerHTML = html;
}

// ---------- ALERTS ----------

function addAlert() {
  var sym = ($('al-sym').value || '').toUpperCase().trim();
  var cond = $('al-cond').value;
  var val = parseFloat($('al-val').value);
  if (!sym || isNaN(val)) { alert('Fill symbol and value'); return; }
  alerts.push({ id: Date.now(), sym: sym, cond: cond, val: val, triggered: false });
  renderAlerts();
  $('al-sym').value = ''; $('al-val').value = '';
}
function removeAlert(id) { alerts = alerts.filter(function (a) { return a.id !== id; }); renderAlerts(); }
function renderAlerts() {
  var el = $('al-list');
  if (!alerts.length) { el.innerHTML = '<div style="font-size:12px;color:#8892a4;padding:8px 0">No alerts set. Add one above.</div>'; return; }
  var html = '';
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    var cls = a.triggered ? 'alert-triggered' : 'alert-active';
    var condTxt = a.cond === 'above' ? 'above Rs ' : 'below Rs ';
    var status = a.triggered ? '<span class="dn">Triggered</span>' : '<span class="up">Active</span>';
    html += '<div class="alert-item ' + cls + '"><div><span style="font-weight:700">' + a.sym + '</span> <span style="color:#8892a4">' + condTxt + a.val.toLocaleString('en-IN') + '</span></div><div style="display:flex;align-items:center;gap:8px">' + status + '<button class="btn al-remove" style="padding:2px 6px;font-size:11px" data-id="' + a.id + '" aria-label="Remove alert"><i class="ti ti-trash" aria-hidden="true"></i></button></div></div>';
  }
  el.innerHTML = html;
  var btns = document.querySelectorAll('.al-remove');
  for (var j = 0; j < btns.length; j++) { btns[j].addEventListener('click', function () { removeAlert(parseFloat(this.getAttribute('data-id'))); }); }
}
function checkAlerts() {
  if (!alerts.length) return;
  var pending = alerts.filter(function (a) { return !a.triggered; });
  var checked = 0, changed = false;
  if (!pending.length) return;
  pending.forEach(function (a) {
    fetchPriceOnly(a.sym.indexOf('.') > -1 || a.sym.indexOf('^') > -1 ? a.sym : a.sym + '.NS', function (q) {
      checked++;
      if (q) {
        var hit = false;
        if (a.cond === 'above' && q.price > a.val) hit = true;
        if (a.cond === 'below' && q.price < a.val) hit = true;
        if (hit) { a.triggered = true; changed = true; }
      }
      if (checked === pending.length && changed) renderAlerts();
    });
  });
}

// ---------- BACKTEST ----------

function doBacktest() {
  var sym = ($('bt-sym').value || 'RELIANCE.NS').toUpperCase().trim();
  var strat = $('bt-strat').value;
  var period = $('bt-period').value;
  var capital = parseFloat($('bt-capital').value) || 100000;
  $('bt-load').style.display = 'block';
  $('bt-main').style.display = 'none';
  $('bt-err').style.display = 'none';
  fetchHistory(sym, period, function (hist, err) {
    $('bt-load').style.display = 'none';
    if (err || !hist) { $('bt-err').style.display = 'block'; $('bt-err').textContent = 'Could not load data for ' + sym + '.'; return; }
    $('bt-main').style.display = 'block';
    var closes = hist.prices, dates = hist.dates;
    var cash = capital, shares = 0, trades = 0, wins = 0, buyPrice = 0;
    var s20 = sma(closes, 20), s50 = sma(closes, 50), r = rsiCalc(closes), bb = boll(closes);
    var macdR = macdCalc(closes), ml = macdR.line, ms = macdR.signal;
    var equity = [capital];
    for (var k = 1; k < closes.length; k++) {
      var p = closes[k], prev = closes[k - 1];
      var buy = false, sell = false;
      if (strat === 'sma_cross') { var s2 = s20[k], s5 = s50[k], ps2 = s20[k - 1], ps5 = s50[k - 1]; if (s2 && s5 && ps2 && ps5) { if (ps2 <= ps5 && s2 > s5) buy = true; if (ps2 >= ps5 && s2 < s5) sell = true; } }
      else if (strat === 'rsi_ob') { var rv = r[k], rp = r[k - 1]; if (rv != null && rp != null) { if (rp >= 30 && rv < 30) buy = true; if (rp <= 70 && rv > 70) sell = true; } }
      else if (strat === 'bb_bounce') { var bv = bb[k], bp = bb[k - 1]; if (bv && bp && bv.u != null && bp.u != null) { if (prev <= bp.l && p > bv.l) buy = true; if (prev >= bp.u && p < bv.u) sell = true; } }
      else if (strat === 'macd_cross') { var mv = ml[k], sv = ms[k], mp = ml[k - 1], sp = ms[k - 1]; if (mv != null && sv != null && mp != null && sp != null) { if (mp <= sp && mv > sv) buy = true; if (mp >= sp && mv < sv) sell = true; } }
      else if (strat === 'buy_hold') { if (k === 1) buy = true; }
      if (buy && shares === 0 && cash > 0) { shares = Math.floor(cash / p); cash -= shares * p; buyPrice = p; if (shares > 0) trades++; }
      if (sell && shares > 0) { var gain = (p - buyPrice) * shares; if (gain > 0) wins++; cash += shares * p; shares = 0; trades++; }
      equity.push(Math.round((cash + shares * p) * 100) / 100);
    }
    if (shares > 0) { cash += shares * closes[closes.length - 1]; shares = 0; }
    var finalVal = cash; var ret = ((finalVal / capital - 1) * 100);
    var maxDD = 0, peak = equity[0];
    for (var m = 0; m < equity.length; m++) { if (equity[m] > peak) peak = equity[m]; var dd = (peak - equity[m]) / peak * 100; if (dd > maxDD) maxDD = dd; }
    var bhRet = ((closes[closes.length - 1] / closes[0] - 1) * 100);
    var daily = []; for (var n = 1; n < equity.length; n++) { daily.push((equity[n] - equity[n - 1]) / equity[n - 1]); }
    var avgD = daily.reduce(function (a, b) { return a + b; }, 0) / daily.length;
    var stdD = Math.sqrt(daily.reduce(function (a, b) { return a + Math.pow(b - avgD, 2); }, 0) / daily.length);
    var sharpe = stdD > 0 ? Math.round((avgD / stdD) * Math.sqrt(252) * 100) / 100 : 0;
    var totalTrades = Math.ceil(trades / 2);
    var winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    btResult = { sym: sym, strat: strat, capital: capital, finalVal: finalVal, ret: ret, maxDD: maxDD, trades: totalTrades, winRate: winRate, sharpe: sharpe, bhRet: bhRet };
    $('bt-fv').textContent = fIN(finalVal);
    var re = $('bt-ret'); re.textContent = (ret >= 0 ? '+' : '') + f1(ret) + '%'; re.className = 'kv ' + (ret >= 0 ? 'up' : 'dn');
    $('bt-dd').textContent = '-' + f1(maxDD) + '%';
    $('bt-tr').textContent = totalTrades;
    $('bt-wr').textContent = winRate + '%';
    $('bt-sh').textContent = f2(sharpe);
    var bhe = $('bt-bh'); var alpha = ret - bhRet; bhe.textContent = (alpha >= 0 ? '+' : '') + f1(alpha) + '% vs B&H'; bhe.className = 'kv ' + (alpha >= 0 ? 'up' : 'dn');
    dC('bt-c');
    var bhEquity = []; for (var bi = 0; bi < closes.length; bi++) { bhEquity.push(Math.round(capital * (closes[bi] / closes[0]) * 100) / 100); }
    CH['bt-c'] = new Chart($('bt-c').getContext('2d'), { type: 'line', data: { labels: dates.slice(0, equity.length), datasets: [{ label: 'Strategy', data: equity, borderColor: '#4ADE80', borderWidth: 1.5, pointRadius: 0, fill: false }, { label: 'Buy and hold', data: bhEquity, borderColor: '#8892a4', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5, 3] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#8892a4', font: { size: 10 }, boxWidth: 10, padding: 6 } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: '#8892a4', font: { size: 10 } } }, y: { grid: { color: 'rgba(136,146,164,0.1)' }, ticks: { color: '#8892a4', font: { size: 10 }, callback: function (v) { return fIN(v); } } } } } });
  });
}

// ---------- PORTFOLIO ----------

function addPos() {
  var sym = ($('p-sym').value || '').toUpperCase().trim();
  var qty = parseFloat($('p-qty').value);
  var cost = parseFloat($('p-cost').value);
  var typ = $('p-type').value;
  if (!sym || isNaN(qty) || isNaN(cost)) { alert('Fill symbol, qty, avg cost'); return; }
  var idx = -1; for (var i = 0; i < port.length; i++) { if (port[i].sym === sym) { idx = i; break; } }
  if (idx >= 0) { port[idx].qty = qty; port[idx].cost = cost; port[idx].typ = typ; }
  else { port.push({ sym: sym, qty: qty, cost: cost, typ: typ, price: null, dayChg: null }); }
  $('p-sym').value = ''; $('p-qty').value = ''; $('p-cost').value = '';
  renderP(); refreshP();
}
function delPos(sym) { port = port.filter(function (p) { return p.sym !== sym; }); renderP(); }

function refreshP() {
  var i = 0;
  function next() {
    if (i >= port.length) { renderP(); return; }
    var p = port[i];
    fetchQuote(p.sym, function (q) {
      if (q) { p.price = q.price; p.dayChg = q.chg; }
      i++; next();
    });
  }
  next();
}

function renderP() {
  var tbody = $('p-body'); var html = '';
  var tv = 0, tc = 0, dayT = 0;
  for (var i = 0; i < port.length; i++) {
    var p = port[i];
    var val = p.price ? p.price * p.qty : null;
    var cT = p.cost * p.qty;
    var pnl = val != null ? val - cT : null;
    var pnlP = val != null ? ((val / cT - 1) * 100) : null;
    var dc = (p.price && p.dayChg != null) ? p.dayChg * p.qty : 0;
    if (val != null) tv += val;
    tc += cT; dayT += dc;
    var up = pnl == null || pnl >= 0;
    var bk = 'b' + (p.typ ? p.typ.charAt(0) : 's');
    html += '<tr><td style="font-weight:700">' + p.sym.replace('.NS', '') + '</td><td><span class="bdg ' + bk + '">' + (p.typ || 'stock') + '</span></td><td>' + p.qty + '</td><td>' + (p.price ? fINp(p.price) : '...') + '</td><td>' + (val != null ? fIN(val) : '--') + '</td><td class="' + (up ? 'up' : 'dn') + '">' + (pnl != null ? (up ? '+' : '') + fIN(Math.abs(pnl)) : '--') + '</td><td class="' + (up ? 'up' : 'dn') + '">' + (pnlP != null ? (up ? '+' : '') + f1(pnlP) + '%' : '--') + '</td><td><button class="btn p-remove" style="padding:2px 5px;font-size:11px" data-sym="' + p.sym + '" aria-label="Remove"><i class="ti ti-trash" aria-hidden="true"></i></button></td></tr>';
  }
  tbody.innerHTML = html;
  var btns = document.querySelectorAll('.p-remove');
  for (var j = 0; j < btns.length; j++) { btns[j].addEventListener('click', function () { delPos(this.getAttribute('data-sym')); }); }
  var pnl = tv - tc, pnlP = tc ? (pnl / tc * 100) : 0, up = pnl >= 0, dup = dayT >= 0;
  $('p-tv').textContent = tv ? fIN(tv) : 'Rs 0';
  var pe = $('p-pnl'); pe.textContent = tc ? (up ? '+' : '') + fIN(Math.abs(pnl)) : '--'; pe.className = 'kv ' + (up ? 'up' : 'dn');
  $('p-pnlp').textContent = tc ? (up ? '+' : '') + f1(pnlP) + '%' : ''; $('p-pnlp').className = 'ks ' + (up ? 'up' : 'dn');
  var de = $('p-day'); de.textContent = tc ? (dup ? '+' : '') + fIN(Math.abs(dayT)) : '--'; de.className = 'kv ' + (dup ? 'up' : 'dn');
  $('p-cnt').textContent = port.length;
  dC('p-d');
  var hasPrices = port.filter(function (p) { return p.price; });
  if (hasPrices.length) {
    $('p-cw').style.display = 'block';
    var vals = hasPrices.map(function (p) { return Math.round(p.price * p.qty * 100) / 100; });
    var syms = hasPrices.map(function (p) { return p.sym.replace('.NS', ''); });
    var cols = ['#FF9933', '#4ADE80', '#60A5FA', '#C29CF0', '#F87171', '#FFB05C', '#6FE090', '#F0C36F'];
    CH['p-d'] = new Chart($('p-d').getContext('2d'), { type: 'doughnut', data: { labels: syms, datasets: [{ data: vals, backgroundColor: cols.slice(0, syms.length), borderWidth: 1, borderColor: 'rgba(136,146,164,0.15)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'right', labels: { color: '#8892a4', font: { size: 10 }, boxWidth: 10, padding: 5 } } } } });
  } else { $('p-cw').style.display = 'none'; }
}

// ---------- SCREENER ----------

function doSc() {
  var typ = $('sc-type').value, sec = $('sc-sec').value, sort = $('sc-sort').value;
  var maxPE = parseFloat($('sc-pe').value) || 9999, minY = parseFloat($('sc-y').value) || 0;
  var symbols = Object.keys(INSTRUMENTS);
  var res = symbols.map(function (s) { var inst = INSTRUMENTS[s]; return { sym: s, name: inst.name, type: inst.type, sector: inst.sector, price: inst.price, mcapCr: inst.mcapCr, pe: inst.pe, yield: inst.divYield }; });
  res = res.filter(function (a) {
    if (typ && a.type !== typ) return false;
    if (sec && a.sector !== sec) return false;
    if (a.pe && a.pe > maxPE) return false;
    if (minY > 0 && (a.yield || 0) < minY) return false;
    return true;
  });
  res.sort(function (a, b) {
    if (sort === 'pe') return (a.pe || 9999) - (b.pe || 9999);
    if (sort === 'yield') return (b.yield || 0) - (a.yield || 0);
    return (b.mcapCr || 0) - (a.mcapCr || 0);
  });
  var tbody = $('sc-body'); var html = '';
  for (var i = 0; i < res.length; i++) {
    var a = res[i];
    var q = getSeededQuote(a.sym);
    var chg = q ? q.chgPct : 0;
    var up = chg >= 0, bk = 'b' + a.type.charAt(0);
    html += '<tr class="ck" data-sym="' + a.sym + '" data-type="' + a.type + '"><td style="font-weight:700">' + a.sym.replace('.NS', '') + '</td><td><span class="bdg ' + bk + '">' + a.type + '</span></td><td style="color:#8892a4">' + a.name + '</td><td>Rs ' + a.price.toLocaleString('en-IN') + '</td><td class="' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + f2(chg) + '%</td><td>' + (a.mcapCr ? fMCr(a.mcapCr) : '--') + '</td><td>' + (a.pe || '--') + '</td><td>' + (a.yield ? a.yield + '%' : '--') + '</td><td style="color:#8892a4;font-size:10px">' + a.sector + '</td></tr>';
  }
  tbody.innerHTML = html;
  var rows = document.querySelectorAll('.ck');
  for (var j = 0; j < rows.length; j++) {
    rows[j].addEventListener('click', function () {
      $('a-sym').value = this.getAttribute('data-sym');
      $('a-type').value = this.getAttribute('data-type');
      sw('a'); doA();
    });
  }
}

// ---------- AI INTEGRATION ----------
// Note: calling the Anthropic API directly from a static front-end page requires
// either a backend proxy or a server-side function, since the API key cannot be
// safely exposed in client-side JS. The function below is structured for that:
// point ANTHROPIC_PROXY_URL at your own backend endpoint that forwards to
// https://api.anthropic.com/v1/messages with your API key attached server-side.

var ANTHROPIC_PROXY_URL = '/api/claude'; // replace with your backend proxy endpoint

function callClaude(prompt, onResult) {
  fetch(ANTHROPIC_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) { onResult((data.content && data.content[0] && data.content[0].text) || 'No response.', null); })
    .catch(function (e) { onResult(null, e); });
}

function doAI_A() {
  if (!curA) { doA(); return; }
  var a = curA, box = $('a-ai'); box.style.display = 'block'; box.textContent = 'Analyzing with AI...';
  var prompt = 'You are a concise Indian equity analyst. Analyze ' + a.sym + ' (' + a.typ + ') listed on NSE/BSE. Data: price Rs ' + (a.price ? a.price.toFixed(2) : 'NA') + ', day ' + (a.chg >= 0 ? '+' : '') + (a.chg ? a.chg.toFixed(2) : 'NA') + ' (' + (a.chgPct ? a.chgPct.toFixed(2) : 'NA') + '%), P/E ' + (a.pe ? a.pe.toFixed(1) : 'N/A') + ', beta ' + (a.beta ? a.beta.toFixed(2) : 'N/A') + '. Provide: 1-sentence summary, bull case, bear case, verdict BUY/HOLD/WATCH/AVOID. Max 100 words.';
  callClaude(prompt, function (text, err) {
    box.textContent = err ? 'AI unavailable. Connect this to your backend proxy at ' + ANTHROPIC_PROXY_URL + ' to enable live analysis.' : text;
  });
}
function doAI_T() {
  var sym = ($('t-sym').value || 'RELIANCE.NS').toUpperCase().trim();
  var prompt = 'Technical analysis for ' + sym + ' (NSE-listed):\n\nIndicators:\n' + $('t-iv').innerText + '\n\nSignals:\n' + $('t-sig').innerText + '\n\nInterpret these signals. What is the short-term and medium-term outlook?';
  console.log('AI prompt (connect a backend to send this to Claude):', prompt);
  alert('Connect ANTHROPIC_PROXY_URL in app.js to a backend that calls the Claude API to enable this.');
}
function doAI_BT() {
  if (!btResult) return;
  alert('Connect ANTHROPIC_PROXY_URL in app.js to a backend that calls the Claude API to enable this.');
}
function doAI_P() {
  if (!port.length) { alert('Add positions first'); return; }
  alert('Connect ANTHROPIC_PROXY_URL in app.js to a backend that calls the Claude API to enable this.');
}
function doAI_FC() { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI commentary on this forecast.'); }

// ---------- TICKER & CLOCK ----------

function buildTicker() {
  // Fetched sequentially, not in parallel: hammering the CORS-proxy fallback with many
  // simultaneous requests on page load tends to trigger its own rate limiting.
  var results = new Array(TICKER_SEED.length);
  var i = 0;
  function next() {
    if (i >= TICKER_SEED.length) { renderTicker(results); return; }
    var idx = i++;
    fetchPriceOnly(TICKER_SEED[idx].sym, function (q) { results[idx] = q; next(); });
  }
  next();
}
function renderTicker(results) {
  var html = '';
  for (var i = 0; i < TICKER_SEED.length; i++) {
    var t = TICKER_SEED[i], q = results[i];
    if (!q) continue;
    var up = q.chgPct >= 0;
    html += '<span class="ti-i"><span class="ts">' + t.s + '</span><span style="color:#8892a4">' + q.price.toLocaleString('en-IN') + '</span><span class="' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + f2(q.chgPct) + '%</span>' + (q.src === 'live' ? '<span class="src-dot" title="Live"></span>' : '') + '</span>';
  }
  $('strip').innerHTML = html + html;
}

// ---------- STOCK SEARCH ----------

function populateSymbolList() {
  var dl = $('stock-list');
  if (!dl) return;
  var html = '';
  for (var i = 0; i < SYMBOL_DIRECTORY.length; i++) {
    var e = SYMBOL_DIRECTORY[i];
    html += '<option value="' + e.sym + '">' + e.name + ' - ' + e.sector + '</option>';
  }
  dl.innerHTML = html;
}
function clock() { $('sclock').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST'; }

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', function () {
  var tabs = document.querySelectorAll('.tab');
  for (var ti = 0; ti < tabs.length; ti++) { tabs[ti].addEventListener('click', function () { sw(this.getAttribute('data-tab')); }); }

  $('live-mode-toggle').addEventListener('change', function () { LIVE_MODE = this.checked; updateStatusBar(); });

  $('a-fetch-btn').addEventListener('click', doA);
  $('a-ai-btn').addEventListener('click', doAI_A);
  $('t-load-btn').addEventListener('click', doT);
  $('t-ai-btn').addEventListener('click', doAI_T);
  $('fc-run-btn').addEventListener('click', doForecast);
  $('fc-ai-btn').addEventListener('click', doAI_FC);
  var chips = document.querySelectorAll('.chip');
  for (var ci = 0; ci < chips.length; ci++) { chips[ci].addEventListener('click', function () { tog(this.getAttribute('data-ind')); }); }
  $('opt-idx').addEventListener('change', updOptDefaults);
  $('opt-build-btn').addEventListener('click', buildChain);
  $('opt-ai-btn').addEventListener('click', function () { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI explanations.'); });
  $('mac-ai-btn').addEventListener('click', function () { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI macro analysis.'); });
  $('earn-refresh-btn').addEventListener('click', renderEarnings);
  $('earn-ai-btn').addEventListener('click', function () { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI earnings analysis.'); });
  $('hm-update-btn').addEventListener('click', buildHeatmap);
  $('hm-ai-btn').addEventListener('click', function () { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI sector analysis.'); });
  $('news-load-btn').addEventListener('click', loadNews);
  $('al-add-btn').addEventListener('click', addAlert);
  $('bt-run-btn').addEventListener('click', doBacktest);
  $('bt-ai-btn').addEventListener('click', doAI_BT);
  $('p-add-btn').addEventListener('click', addPos);
  $('p-refresh-btn').addEventListener('click', refreshP);
  $('p-ai-btn').addEventListener('click', doAI_P);
  $('sc-run-btn').addEventListener('click', doSc);
  $('sc-ai-btn').addEventListener('click', function () { alert('Connect ANTHROPIC_PROXY_URL in app.js to enable AI screener ranking.'); });

  populateSymbolList();
  updateStatusBar();
  buildTicker();
  initMacro();
  renderEarnings();
  buildHeatmap();
  loadNews();
  renderAlerts();
  renderP();
  doSc();
  buildChain();
  doA();
  clock();
  setInterval(clock, 1000);
  setInterval(checkAlerts, 30000);
  setInterval(buildTicker, 60000);
});
