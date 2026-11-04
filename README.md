# QuantLab

QuantLab is a React and FastAPI trading analytics application. Indian equity market data is fetched by FastAPI from IndianAPI; browser code never calls the provider directly and never receives the API credential.

## Requirements

- Node.js and npm
- Python 3.10+
- An IndianAPI subscription/key with access to the selected endpoints

## Configure the Provider

Copy `backend/.env.example` to `backend/.env`, then set `INDIAN_API_KEY` to a newly rotated key. Set `INDIAN_API_BASE_URL` to the host for the active plan. The example uses `https://stock.indianapi.in`. Never place the key in a `VITE_*` variable or commit an environment file.

## Run Locally

From the repository root, start FastAPI:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, start React/Vite:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to FastAPI on port 8000.

## Market Data API

- `GET /api/market/quote?symbol=RELIANCE`
- `GET /api/market/history?symbol=RELIANCE&period=1yr&filter=default`
- `GET /api/market/intraday?symbol=RELIANCE`
- `GET /api/market/overview`
- `GET /api/market/quotes?symbols=RELIANCE,TCS,INFY`

Supported periods are `1m`, `6m`, `1yr`, `3yr`, `5yr`, `10yr`, and `max`. Quote, index, trending, active-stock, and intraday data use conservative 60-second caching/polling; history is cached for five minutes. Set the non-secret `VITE_MARKET_POLL_INTERVAL_MS` value to configure the UI interval; values below 60000 are raised to the 60-second minimum. Provider timestamps are retained, and missing or plan-restricted data is shown as unavailable rather than replaced with generated values.

IndianAPI's quote and batch endpoints provide delayed market data. Data can be stale when exchanges are closed. Backtesting currently calculates a buy-and-hold result from the selected stock's actual historical price series; it does not model a signal strategy, fees, or slippage. Historical results do not guarantee future returns.

## Validation

```powershell
python -m pytest backend/tests -q
Push-Location frontend
npm run build
Pop-Location
```

A working provider key is required for live quote/history requests. Without one, FastAPI returns a configuration error and does not use mock market data.
