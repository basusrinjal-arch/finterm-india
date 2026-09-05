# FINTERM INDIA — NSE/BSE Financial Terminal

A live financial terminal for Indian equity markets, built from scratch with vanilla HTML, CSS, and JavaScript — no frameworks, no build step. Anyone can open the page and search any NSE/BSE-listed symbol for live quotes, technical analysis, a statistical price forecast, an options chain, and more.

**[Live demo →](#deploying)** (add your GitHub Pages URL here once deployed — see below)

## Features

- **Analyse** — live quote, price chart, valuation, fundamentals, and a heuristic Fundamental Score (0-100) for any NSE/BSE symbol
- **Technical** — SMA 20/50, EMA 12/26, Bollinger Bands, RSI 14, MACD, ATR, computed client-side from price history
- **Forecast** — a statistical price projection: fits drift and volatility from a year of daily returns, then projects a lognormal (geometric Brownian motion) median path with 68%/90% confidence cones out to your chosen horizon. Clearly labeled as a quantitative projection, not a prediction.
- **Options** — Black-Scholes options pricer for NIFTY and BANKNIFTY with live Greeks (Delta, Gamma, Theta, Vega), using the RBI repo rate as the risk-free rate and NSE-style strike spacing
- **Macro** — RBI repo rate, CPI, GDP, FII/DII flows, G-Sec yields, INR/USD, India VIX
- **Earnings** — upcoming quarterly results calendar with EPS estimates
- **Heatmap** — sector, NIFTY 50, Indian indices, and global market views
- **News** — curated headlines with sentiment tagging
- **Alerts** — price-based alerts checked on a timer against live quotes
- **Backtest** — SMA crossover, RSI, Bollinger bounce, MACD crossover, and buy & hold strategies with Sharpe ratio and max drawdown
- **Portfolio** — P&L tracker with allocation donut chart
- **Screener** — filter by type, sector, P/E, and yield
- **Search** — type-ahead over 40+ NSE symbols, or type any symbol directly (e.g. `TATAPOWER.NS`) — if Yahoo Finance has it, the terminal will fetch it live

## How live data actually works

The terminal fetches real quotes and price history from Yahoo Finance's public (unofficial) chart endpoint, with a resilient fallback chain so the page never breaks or lies about its data:

1. **Direct fetch** from the browser to `query1.finance.yahoo.com`. This is blocked by CORS on most hosts (including GitHub Pages), since Yahoo doesn't send `Access-Control-Allow-Origin` for arbitrary origins.
2. **Proxy fallback** through [`r.jina.ai`](https://r.jina.ai), a public read-only fetch proxy, when the direct call is blocked.
3. **Seeded fallback** — deterministic, realistic synthetic data — only if both of the above fail (e.g. you're offline, or the proxy is rate-limited).

Every quote is stamped with its actual source and shown honestly in the UI:

- 🟢 **LIVE** — this number came from Yahoo Finance just now
- **SIMULATED** — this number is seeded/synthetic, shown because live data wasn't reachable

Fundamentals (P/E, ROE, etc.) are the one exception: Yahoo's `quoteSummary` endpoint now requires an auth token it won't issue cross-origin, so those fields are patched in from a static seeded profile when a symbol has one. Ratios like P/E and ROE don't move intraday, so this stays honest while the live price and chart above it do not.

There's still a **Live mode** toggle in the top right (on by default) if you want to force pure simulated mode for demos or offline use.

**Honest note for anyone evaluating this project:** the Yahoo Finance endpoints used here are not an official, documented, or supported public API, and the `r.jina.ai` proxy is a free third-party service with its own rate limits. Both can change or go down without notice. This project uses no paid market data API and no API keys — that's a deliberate trade-off to keep it a zero-cost, zero-signup static site anyone can fork and deploy. For production use, swap in a licensed data vendor (see `fetchQuote`/`fetchHistory` in `app.js` — they're the only two functions that would need to change).

## Forecasting methodology

The Forecast tab is not a prediction engine — it's a transparent statistical baseline:

1. Compute daily log returns over the trailing year.
2. Fit drift (μ, the mean daily log return) and volatility (σ, the standard deviation).
3. Project forward using the same lognormal model that underlies Black-Scholes: `S(t) = S₀ · exp((μ − ½σ²)t ± zσ√t)`.
4. Show the median path plus 68% (z=1) and 90% (z=1.645) confidence cones, the implied probability of the price finishing higher, and the annualized drift/volatility that drove the projection.

This says nothing about earnings, news, or flows — it's a risk range built purely from recent price behavior, and the UI says so directly.

## AI integration

The Analyse, Technical, Forecast, Macro, Earnings, Heatmap, Backtest, Portfolio, and Screener tabs each have an "Ask AI" button intended to call the Claude API (`claude-sonnet-5`) for natural-language analysis.

**Important:** calling the Anthropic API directly from client-side JavaScript would require exposing an API key in the browser, which is insecure. The AI buttons are wired to call a placeholder backend proxy at `ANTHROPIC_PROXY_URL` (see `app.js`). To make them functional:

1. Stand up a small backend (e.g. a serverless function on Vercel/Netlify, or a tiny Express server) that accepts a prompt and forwards it to `https://api.anthropic.com/v1/messages` with your API key attached server-side.
2. Update `ANTHROPIC_PROXY_URL` in `app.js` to point to that endpoint.

Without this, the AI buttons show an explanatory alert rather than fail silently.

## Running locally

No build step, no dependencies required — it's plain HTML/CSS/JS. `fetch()` needs a real HTTP origin (not `file://`), so serve the folder with any static server:

```bash
# Python 3
python3 -m http.server 8000

# Node (no install needed)
npx serve .
```

```powershell
# Windows with nothing else installed — a zero-dependency server is included:
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:8000` (or `:8931` for `serve.ps1`).

## Deploying

### GitHub Pages (recommended — free, matches the included Actions workflow)

1. Push this repo to GitHub (see commands below if you haven't yet).
2. In the repo, go to **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` — `.github/workflows/pages.yml` builds and deploys automatically.
4. Your live site will be at `https://<your-username>.github.io/<repo-name>/`.

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

### Netlify / Vercel

Drag the folder into Netlify, or run `vercel` in this directory — both auto-detect static sites with no config needed.

No environment variables are needed for live or simulated market data. For the AI features, deploy the backend proxy described above alongside it.

## Tech stack

HTML5 · CSS3 · Vanilla JavaScript · Chart.js · Yahoo Finance (unofficial, via direct fetch + CORS-proxy fallback) · Anthropic Claude API (via backend proxy, optional)

## Project structure

```
finterm-india/
├── index.html              # markup for all 12 modules
├── style.css                # dark theme with saffron accent
├── data.js                  # seeded/fallback market data, symbol search directory
├── app.js                   # data layer (live+fallback), indicators, forecast model, charts
├── serve.ps1                 # zero-dependency local static server for Windows
├── .github/workflows/pages.yml  # GitHub Pages deploy on push to main
└── README.md
```
