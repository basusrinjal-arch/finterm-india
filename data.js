// FINTERM INDIA - Seeded market data
// Used as fallback when live Yahoo Finance fetch fails or LIVE_MODE is off.
// Price histories are synthetic but built around realistic anchor prices and
// realistic volatility per asset class (large-cap stocks ~1.5-2.5% daily vol,
// bonds/G-Secs ~0.2-0.4%, indices ~1%).

function seededRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function genSeries(basePrice, days, volatility, seed, driftPerDay) {
  var rand = seededRandom(seed);
  var drift = driftPerDay || 0;
  var prices = [];
  var p = basePrice * (1 - drift * days * 0.5);
  for (var i = 0; i < days; i++) {
    var shock = (rand() - 0.5) * 2 * volatility;
    p = p * (1 + drift + shock);
    prices.push(Math.round(p * 100) / 100);
  }
  var scale = basePrice / prices[prices.length - 1];
  for (var j = 0; j < prices.length; j++) {
    prices[j] = Math.round(prices[j] * scale * 100) / 100;
  }
  return prices;
}

function genDates(days) {
  var dates = [];
  var d = new Date('2026-06-19');
  var count = 0;
  while (count < days) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.unshift(new Date(d).toISOString().slice(0, 10));
      count++;
    }
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

var INSTRUMENTS = {
  'RELIANCE.NS': { name: 'Reliance Industries', type: 'stock', sector: 'Energy', price: 1485, mcapCr: 1985000, pe: 24.8, eps: 59.9, divYield: 0.4, beta: 0.92, roe: 0.091, grossMargin: 0.42, totalDebtCr: 312000, seed: 101, vol: 0.018 },
  'TCS.NS': { name: 'Tata Consultancy Services', type: 'stock', sector: 'IT', price: 3650, mcapCr: 1320000, pe: 27.1, eps: 134.7, divYield: 3.2, beta: 0.71, roe: 0.52, grossMargin: 0.45, totalDebtCr: 4200, seed: 102, vol: 0.014 },
  'HDFCBANK.NS': { name: 'HDFC Bank', type: 'stock', sector: 'Banking', price: 1720, mcapCr: 1280000, pe: 19.4, eps: 88.7, divYield: 1.1, beta: 1.05, roe: 0.165, grossMargin: null, totalDebtCr: null, seed: 103, vol: 0.016 },
  'INFY.NS': { name: 'Infosys', type: 'stock', sector: 'IT', price: 1520, mcapCr: 630000, pe: 24.2, eps: 62.8, divYield: 2.8, beta: 0.78, roe: 0.31, grossMargin: 0.34, totalDebtCr: 5400, seed: 104, vol: 0.015 },
  'ICICIBANK.NS': { name: 'ICICI Bank', type: 'stock', sector: 'Banking', price: 1295, mcapCr: 920000, pe: 18.6, eps: 69.6, divYield: 0.8, beta: 1.12, roe: 0.182, grossMargin: null, totalDebtCr: null, seed: 105, vol: 0.017 },
  'BHARTIARTL.NS': { name: 'Bharti Airtel', type: 'stock', sector: 'Telecom', price: 1810, mcapCr: 1050000, pe: 38.5, eps: 47.0, divYield: 0.6, beta: 0.88, roe: 0.21, grossMargin: 0.55, totalDebtCr: 198000, seed: 106, vol: 0.019 },
  'ITC.NS': { name: 'ITC Ltd', type: 'stock', sector: 'FMCG', price: 435, mcapCr: 545000, pe: 22.7, eps: 19.2, divYield: 3.4, beta: 0.58, roe: 0.28, grossMargin: 0.62, totalDebtCr: 1200, seed: 107, vol: 0.013 },
  'SBIN.NS': { name: 'State Bank of India', type: 'stock', sector: 'Banking', price: 825, mcapCr: 735000, pe: 9.8, eps: 84.2, divYield: 1.9, beta: 1.21, roe: 0.175, grossMargin: null, totalDebtCr: null, seed: 108, vol: 0.020 },
  'HINDUNILVR.NS': { name: 'Hindustan Unilever', type: 'stock', sector: 'FMCG', price: 2385, mcapCr: 560000, pe: 51.2, eps: 46.6, divYield: 1.7, beta: 0.45, roe: 0.78, grossMargin: 0.51, totalDebtCr: 800, seed: 109, vol: 0.012 },
  'LT.NS': { name: 'Larsen and Toubro', type: 'stock', sector: 'Energy', price: 3450, mcapCr: 485000, pe: 32.4, eps: 106.5, divYield: 0.8, beta: 1.18, roe: 0.142, grossMargin: 0.18, totalDebtCr: 145000, seed: 110, vol: 0.019 },
  'MARUTI.NS': { name: 'Maruti Suzuki', type: 'stock', sector: 'Auto', price: 13150, mcapCr: 415000, pe: 28.1, eps: 467.9, divYield: 1.2, beta: 0.85, roe: 0.144, grossMargin: 0.28, totalDebtCr: 2100, seed: 111, vol: 0.016 },
  'TATAMOTORS.NS': { name: 'Tata Motors', type: 'stock', sector: 'Auto', price: 805, mcapCr: 295000, pe: 9.5, eps: 84.7, divYield: 0.5, beta: 1.45, roe: 0.31, grossMargin: 0.32, totalDebtCr: 89000, seed: 112, vol: 0.024 },
  'SUNPHARMA.NS': { name: 'Sun Pharma', type: 'stock', sector: 'Pharma', price: 1775, mcapCr: 425000, pe: 33.2, eps: 53.5, divYield: 0.7, beta: 0.62, roe: 0.158, grossMargin: 0.71, totalDebtCr: 4800, seed: 113, vol: 0.015 },
  'AXISBANK.NS': { name: 'Axis Bank', type: 'stock', sector: 'Banking', price: 1155, mcapCr: 355000, pe: 14.2, eps: 81.3, divYield: 0.1, beta: 1.15, roe: 0.165, grossMargin: null, totalDebtCr: null, seed: 114, vol: 0.018 },
  'KOTAKBANK.NS': { name: 'Kotak Mahindra Bank', type: 'stock', sector: 'Banking', price: 2145, mcapCr: 425000, pe: 18.9, eps: 113.5, divYield: 0.1, beta: 0.98, roe: 0.142, grossMargin: null, totalDebtCr: null, seed: 115, vol: 0.017 },
  'WIPRO.NS': { name: 'Wipro', type: 'stock', sector: 'IT', price: 510, mcapCr: 265000, pe: 23.4, eps: 21.8, divYield: 2.1, beta: 0.74, roe: 0.165, grossMargin: 0.31, totalDebtCr: 12800, seed: 116, vol: 0.016 },
  'NIFTYBEES.NS': { name: 'NIFTY 50 ETF', type: 'etf', sector: 'Equity', price: 262, mcapCr: 14500, pe: 23.2, eps: null, divYield: 1.1, beta: 1.0, roe: null, grossMargin: null, totalDebtCr: null, seed: 117, vol: 0.011, expenseRatio: 0.05 },
  'GOLDBEES.NS': { name: 'Gold ETF', type: 'etf', sector: 'Commodities', price: 68.4, mcapCr: 9200, pe: null, eps: null, divYield: 0, beta: 0.05, roe: null, grossMargin: null, totalDebtCr: null, seed: 118, vol: 0.009, expenseRatio: 0.45 },
  'JUNIORBEES.NS': { name: 'Nifty Next 50 ETF', type: 'etf', sector: 'Equity', price: 685, mcapCr: 3100, pe: 26.4, eps: null, divYield: 0.9, beta: 1.08, roe: null, grossMargin: null, totalDebtCr: null, seed: 119, vol: 0.013, expenseRatio: 0.20 },
  '^NSEI': { name: 'NIFTY 50 Index', type: 'index', sector: 'Index', price: 23565, mcapCr: null, pe: 22.4, eps: null, divYield: null, beta: 1.0, roe: null, grossMargin: null, totalDebtCr: null, seed: 120, vol: 0.010 },
  '^BSESN': { name: 'BSE SENSEX', type: 'index', sector: 'Index', price: 77210, mcapCr: null, pe: 23.1, eps: null, divYield: null, beta: 1.0, roe: null, grossMargin: null, totalDebtCr: null, seed: 121, vol: 0.010 },
  'LIQUIDBEES.NS': { name: 'Liquid Bond ETF', type: 'bond', sector: 'Bonds', price: 1000, mcapCr: 6500, pe: null, eps: null, divYield: 6.2, beta: 0.02, roe: null, grossMargin: null, totalDebtCr: null, seed: 122, vol: 0.002, expenseRatio: 0.08 }
};

var DEFAULT_RANGE_DAYS = { '1mo': 22, '3mo': 65, '6mo': 130, '1y': 260, '2y': 520, '5y': 1300 };

function getSeededHistory(symbol, rangeKey) {
  var inst = INSTRUMENTS[symbol];
  if (!inst) return null;
  var days = DEFAULT_RANGE_DAYS[rangeKey] || 130;
  var prices = genSeries(inst.price, days, inst.vol, inst.seed, 0.0003);
  var dates = genDates(days);
  return { prices: prices, dates: dates };
}

function getSeededQuote(symbol) {
  var inst = INSTRUMENTS[symbol];
  if (!inst) return null;
  var hist = getSeededHistory(symbol, '3mo');
  var prices = hist.prices;
  var last = prices[prices.length - 1];
  var prev = prices[prices.length - 2];
  var chg = Math.round((last - prev) * 100) / 100;
  var chgPct = Math.round((chg / prev) * 10000) / 100;
  var yearHist = getSeededHistory(symbol, '1y');
  var lo52 = Math.min.apply(null, yearHist.prices);
  var hi52 = Math.max.apply(null, yearHist.prices);
  var rand = seededRandom(inst.seed + 7);
  var vol = Math.round((2000000 + rand() * 8000000));
  return {
    sym: symbol, name: inst.name, type: inst.type, sector: inst.sector,
    price: last, chg: chg, chgPct: chgPct,
    mcapCr: inst.mcapCr, mcap: inst.mcapCr ? inst.mcapCr * 1e7 : null,
    volume: vol, lo52: Math.round(lo52 * 100) / 100, hi52: Math.round(hi52 * 100) / 100,
    pe: inst.pe, eps: inst.eps, divYield: inst.divYield, beta: inst.beta,
    roe: inst.roe, grossMargin: inst.grossMargin, totalDebtCr: inst.totalDebtCr,
    expenseRatio: inst.expenseRatio || null
  };
}

var TICKER_SEED = [
  { s: 'NIFTY 50', sym: '^NSEI' }, { s: 'SENSEX', sym: '^BSESN' },
  { s: 'RELIANCE', sym: 'RELIANCE.NS' }, { s: 'TCS', sym: 'TCS.NS' },
  { s: 'HDFCBANK', sym: 'HDFCBANK.NS' }, { s: 'INFY', sym: 'INFY.NS' },
  { s: 'SBIN', sym: 'SBIN.NS' }, { s: 'ICICIBANK', sym: 'ICICIBANK.NS' }
];

// Entries with `ySym` are fetched live from Yahoo Finance (FX and volatility index
// tickers exist there) and overwrite `v`/`s` on load - `v`/`s` here are just the
// seeded fallback shown until that resolves (or if live fetch fails). Entries without
// `ySym` are periodic official releases (RBI/MOSPI) with no market ticker to poll -
// these stay pinned to their last known release, same as any real terminal would show
// them, and are labeled "as of" rather than implied to be live.
var MACRO_DATA = [
  { l: 'RBI repo rate', v: '5.50%', s: 'As of Apr 2026 review - periodic release', c: 'neu' },
  { l: 'CPI inflation YoY', v: '3.16%', s: 'As of latest release - within RBI 2-6% band', c: 'up' },
  { l: 'India GDP growth', v: '7.4%', s: 'Q4 FY26 - periodic release', c: 'up' },
  { l: 'Unemployment', v: '7.0%', s: 'PLFS estimate - periodic release', c: 'neu' },
  { l: '10Y G-Sec yield', v: '6.85%', s: 'As of latest session - periodic release', c: 'neu' },
  { l: 'INR per USD', v: '86.42', s: 'Simulated fallback', c: 'dn', ySym: 'INR=X' },
  { l: 'India VIX', v: '12.8', s: 'Simulated fallback', c: 'up', ySym: '^INDIAVIX' },
  { l: 'WPI inflation', v: '2.05%', s: 'Wholesale prices - periodic release', c: 'up' },
  { l: 'Forex reserves', v: 'USD 645B', s: 'RBI weekly statistical supplement', c: 'up' }
];

var EARNINGS_DATA = [
  { sym: 'RELIANCE', name: 'Reliance Industries', date: 'Jul 18', day: 'Sat', epsEst: 24.5, epsPrev: 21.2, revEst: 'Rs 2,45,000 Cr', beat: null },
  { sym: 'TCS', name: 'Tata Consultancy', date: 'Jul 10', day: 'Fri', epsEst: 33.2, epsPrev: 30.8, revEst: 'Rs 64,500 Cr', beat: true },
  { sym: 'HDFCBANK', name: 'HDFC Bank', date: 'Jul 19', day: 'Sun', epsEst: 22.8, epsPrev: 21.1, revEst: 'Rs 76,200 Cr', beat: null },
  { sym: 'INFY', name: 'Infosys', date: 'Jul 16', day: 'Thu', epsEst: 16.4, epsPrev: 15.7, revEst: 'Rs 41,200 Cr', beat: true },
  { sym: 'ICICIBANK', name: 'ICICI Bank', date: 'Jul 22', day: 'Wed', epsEst: 14.2, epsPrev: 12.9, revEst: 'Rs 46,500 Cr', beat: null },
  { sym: 'BHARTIARTL', name: 'Bharti Airtel', date: 'Jul 30', day: 'Thu', epsEst: 18.6, epsPrev: 14.2, revEst: 'Rs 47,800 Cr', beat: true },
  { sym: 'ITC', name: 'ITC Ltd', date: 'Jul 25', day: 'Sat', epsEst: 4.2, epsPrev: 4.5, revEst: 'Rs 18,400 Cr', beat: false },
  { sym: 'SBIN', name: 'State Bank of India', date: 'Aug 5', day: 'Wed', epsEst: 21.5, epsPrev: 18.9, revEst: 'Rs 1,28,000 Cr', beat: null }
];

var HEATMAP_DATA = {
  sector: [
    { s: 'RELIANCE', n: 'Energy', chg: 0.85 }, { s: 'LT', n: 'L and T', chg: 0.42 },
    { s: 'TCS', n: 'TCS', chg: -0.32 }, { s: 'INFY', n: 'Infosys', chg: 0.18 }, { s: 'WIPRO', n: 'Wipro', chg: -0.85 },
    { s: 'HDFCBANK', n: 'HDFC Bk', chg: 0.61 }, { s: 'ICICIBANK', n: 'ICICI', chg: 0.94 }, { s: 'SBIN', n: 'SBI', chg: 1.02 }, { s: 'AXISBANK', n: 'Axis', chg: -0.22 },
    { s: 'ITC', n: 'ITC', chg: -0.18 }, { s: 'HINDUNILVR', n: 'HUL', chg: 0.34 },
    { s: 'MARUTI', n: 'Maruti', chg: 1.45 }, { s: 'TATAMOTORS', n: 'Tata Mtr', chg: 2.18 },
    { s: 'SUNPHARMA', n: 'Sun Pharma', chg: -0.55 }, { s: 'BHARTIARTL', n: 'Airtel', chg: 0.72 }
  ],
  nifty50: [
    { s: 'TATAMOTORS', chg: 2.18 }, { s: 'MARUTI', chg: 1.45 }, { s: 'SBIN', chg: 1.02 }, { s: 'ICICIBANK', chg: 0.94 },
    { s: 'RELIANCE', chg: 0.85 }, { s: 'BHARTIARTL', chg: 0.72 }, { s: 'HDFCBANK', chg: 0.61 }, { s: 'HINDUNILVR', chg: 0.34 },
    { s: 'LT', chg: 0.42 }, { s: 'INFY', chg: 0.18 }, { s: 'NIFTY50', chg: 0.42 }, { s: 'TCS', chg: -0.32 },
    { s: 'AXISBANK', chg: -0.22 }, { s: 'ITC', chg: -0.18 }, { s: 'SUNPHARMA', chg: -0.55 }, { s: 'WIPRO', chg: -0.85 },
    { s: 'KOTAKBANK', chg: 0.28 }, { s: 'M&M', chg: 1.12 }, { s: 'ASIANPAINT', chg: -0.41 }, { s: 'TITAN', chg: 0.66 },
    { s: 'ULTRACEMCO', chg: 0.51 }, { s: 'NESTLEIND', chg: -0.12 }, { s: 'BAJFINANCE', chg: 0.88 }, { s: 'POWERGRID', chg: 0.22 }, { s: 'NTPC', chg: 0.35 }
  ],
  indices: [
    { s: 'NIFTY50', n: 'NSE', chg: 0.42 }, { s: 'SENSEX', n: 'BSE', chg: 0.38 }, { s: 'NIFTYBANK', n: 'Banking', chg: 0.55 },
    { s: 'NIFTYIT', n: 'IT', chg: -0.28 }, { s: 'NIFTYAUTO', n: 'Auto', chg: 1.32 }, { s: 'NIFTYFMCG', n: 'FMCG', chg: 0.15 },
    { s: 'NIFTYPHARMA', n: 'Pharma', chg: -0.48 }, { s: 'NIFTYMETAL', n: 'Metal', chg: 0.92 }, { s: 'NIFTYREALTY', n: 'Realty', chg: 1.08 },
    { s: 'NIFTYENERGY', n: 'Energy', chg: 0.61 }, { s: 'NIFTYMIDCAP', n: 'Midcap', chg: 0.78 }, { s: 'NIFTYSMLCAP', n: 'Smallcap', chg: 0.95 }
  ],
  global: [
    { s: 'NIFTY50', n: 'India', chg: 0.42 }, { s: 'SPX', n: 'S and P 500', chg: 0.31 }, { s: 'DJI', n: 'Dow', chg: 0.24 },
    { s: 'IXIC', n: 'Nasdaq', chg: 0.49 }, { s: 'N225', n: 'Nikkei', chg: -0.55 }, { s: 'HSI', n: 'HangSeng', chg: 1.22 },
    { s: 'FTSE', n: 'FTSE', chg: -0.18 }, { s: 'DAX', n: 'DAX', chg: 0.82 }, { s: 'SSE', n: 'Shanghai', chg: -0.42 },
    { s: 'KOSPI', n: 'S.Korea', chg: 0.68 }, { s: 'BVSP', n: 'Brazil', chg: -0.88 }, { s: 'AXJO', n: 'Australia', chg: 0.27 }
  ]
};

var NEWS_DATA = [
  { sym: 'RELIANCE', src: 'Economic Times', title: 'Reliance Jio adds 4M subscribers in May as tariff hikes settle, ARPU improves sequentially', sentiment: 'pos', time: '2h ago' },
  { sym: 'RBI', src: 'Mint', title: 'RBI holds repo rate at 5.50%, signals data-dependent stance amid stable inflation outlook', sentiment: 'neu', time: '3h ago' },
  { sym: 'TCS', src: 'Bloomberg', title: 'TCS wins multi-year cloud transformation deal with European banking client', sentiment: 'pos', time: '4h ago' },
  { sym: 'INR', src: 'Economic Times', title: 'Rupee slips to near record low against dollar as crude prices firm up', sentiment: 'neg', time: '5h ago' },
  { sym: 'FII', src: 'Moneycontrol', title: 'FIIs continue selling in cash markets for third straight session, DIIs absorb the supply', sentiment: 'neg', time: '6h ago' },
  { sym: 'HDFCBANK', src: 'BusinessLine', title: 'HDFC Bank Q4 loan growth picks up as deposit mobilisation improves', sentiment: 'pos', time: '7h ago' },
  { sym: 'AUTO', src: 'Economic Times', title: 'Auto sector retail sales rise 8% YoY in May on rural demand recovery', sentiment: 'pos', time: '8h ago' },
  { sym: 'ITC', src: 'Mint', title: 'ITC cigarette volumes flat amid elevated taxation, FMCG margins improve steadily', sentiment: 'neu', time: '9h ago' },
  { sym: 'INFY', src: 'Reuters', title: 'Infosys raises FY27 revenue guidance on strong deal pipeline in BFSI', sentiment: 'pos', time: '10h ago' },
  { sym: 'CRUDE', src: 'Economic Times', title: 'Brent crude rises above 74 dollars on supply concerns, raises CAD worries', sentiment: 'neg', time: '11h ago' },
  { sym: 'SBIN', src: 'Moneycontrol', title: 'SBI asset quality improves further as gross NPA ratio falls to multi-year low', sentiment: 'pos', time: '12h ago' },
  { sym: 'NIFTY', src: 'BusinessLine', title: 'NIFTY hovers near record highs, market breadth turns positive led by banks and auto', sentiment: 'pos', time: '13h ago' }
];

// ---------- SEARCH DIRECTORY ----------
// Used to power the stock-search autocomplete across the terminal. Covers far more
// symbols than INSTRUMENTS (which only carries seeded fundamentals for offline mode) —
// anything here (or typed fresh) can still be fetched live by symbol.
var SYMBOL_DIRECTORY = (function () {
  var extra = [
    { sym: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Diversified' },
    { sym: 'ADANIPORTS.NS', name: 'Adani Ports and SEZ', sector: 'Infrastructure' },
    { sym: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'FMCG' },
    { sym: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Financials' },
    { sym: 'BAJAJFINSV.NS', name: 'Bajaj Finserv', sector: 'Financials' },
    { sym: 'BPCL.NS', name: 'Bharat Petroleum', sector: 'Energy' },
    { sym: 'CIPLA.NS', name: 'Cipla', sector: 'Pharma' },
    { sym: 'COALINDIA.NS', name: 'Coal India', sector: 'Energy' },
    { sym: 'DIVISLAB.NS', name: 'Divis Laboratories', sector: 'Pharma' },
    { sym: 'DRREDDY.NS', name: 'Dr Reddys Labs', sector: 'Pharma' },
    { sym: 'EICHERMOT.NS', name: 'Eicher Motors', sector: 'Auto' },
    { sym: 'GRASIM.NS', name: 'Grasim Industries', sector: 'Materials' },
    { sym: 'HCLTECH.NS', name: 'HCL Technologies', sector: 'IT' },
    { sym: 'HDFCLIFE.NS', name: 'HDFC Life Insurance', sector: 'Financials' },
    { sym: 'HEROMOTOCO.NS', name: 'Hero MotoCorp', sector: 'Auto' },
    { sym: 'HINDALCO.NS', name: 'Hindalco Industries', sector: 'Materials' },
    { sym: 'INDUSINDBK.NS', name: 'IndusInd Bank', sector: 'Banking' },
    { sym: 'JSWSTEEL.NS', name: 'JSW Steel', sector: 'Materials' },
    { sym: 'M&M.NS', name: 'Mahindra and Mahindra', sector: 'Auto' },
    { sym: 'NESTLEIND.NS', name: 'Nestle India', sector: 'FMCG' },
    { sym: 'NTPC.NS', name: 'NTPC Ltd', sector: 'Energy' },
    { sym: 'ONGC.NS', name: 'Oil and Natural Gas Corp', sector: 'Energy' },
    { sym: 'POWERGRID.NS', name: 'Power Grid Corp', sector: 'Energy' },
    { sym: 'SBILIFE.NS', name: 'SBI Life Insurance', sector: 'Financials' },
    { sym: 'SHREECEM.NS', name: 'Shree Cement', sector: 'Materials' },
    { sym: 'TATACONSUM.NS', name: 'Tata Consumer Products', sector: 'FMCG' },
    { sym: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Materials' },
    { sym: 'TECHM.NS', name: 'Tech Mahindra', sector: 'IT' },
    { sym: 'TITAN.NS', name: 'Titan Company', sector: 'FMCG' },
    { sym: 'ULTRACEMCO.NS', name: 'UltraTech Cement', sector: 'Materials' },
    { sym: 'UPL.NS', name: 'UPL Ltd', sector: 'Chemicals' },
    { sym: 'ZOMATO.NS', name: 'Eternal (Zomato)', sector: 'Consumer' },
    { sym: 'DMART.NS', name: 'Avenue Supermarts (DMart)', sector: 'Retail' },
    { sym: 'PAYTM.NS', name: 'One 97 Communications (Paytm)', sector: 'Fintech' },
    { sym: 'IRCTC.NS', name: 'Indian Railway Catering and Tourism', sector: 'Services' },
    { sym: 'PIDILITIND.NS', name: 'Pidilite Industries', sector: 'Chemicals' },
    { sym: 'DLF.NS', name: 'DLF Ltd', sector: 'Realty' },
    { sym: 'VEDL.NS', name: 'Vedanta Ltd', sector: 'Materials' },
    { sym: 'PNB.NS', name: 'Punjab National Bank', sector: 'Banking' },
    { sym: 'BANKBARODA.NS', name: 'Bank of Baroda', sector: 'Banking' },
    { sym: 'YESBANK.NS', name: 'Yes Bank', sector: 'Banking' },
    { sym: 'IDEA.NS', name: 'Vodafone Idea', sector: 'Telecom' },
    { sym: '^NSEBANK', name: 'NIFTY BANK Index', sector: 'Index' },
    { sym: '^CNXIT', name: 'NIFTY IT Index', sector: 'Index' }
  ];
  var seen = {}, out = [];
  Object.keys(INSTRUMENTS).forEach(function (s) {
    seen[s] = true;
    out.push({ sym: s, name: INSTRUMENTS[s].name, sector: INSTRUMENTS[s].sector });
  });
  extra.forEach(function (e) { if (!seen[e.sym]) { seen[e.sym] = true; out.push(e); } });
  out.sort(function (a, b) { return a.sym < b.sym ? -1 : 1; });
  return out;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INSTRUMENTS: INSTRUMENTS, getSeededHistory: getSeededHistory, getSeededQuote: getSeededQuote, TICKER_SEED: TICKER_SEED, MACRO_DATA: MACRO_DATA, EARNINGS_DATA: EARNINGS_DATA, HEATMAP_DATA: HEATMAP_DATA, NEWS_DATA: NEWS_DATA, SYMBOL_DIRECTORY: SYMBOL_DIRECTORY };
}
