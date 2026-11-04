# QuantLab Market Data Setup

QuantLab's market data path is React/Vite -> FastAPI -> IndianAPI. The provider key is read only by FastAPI and must never be placed in frontend environment variables.

## Configure IndianAPI

1. Rotate any previously exposed key and choose the API base URL included with the active subscription.
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `INDIAN_API_KEY` to the rotated key and `INDIAN_API_BASE_URL` to the subscribed host (the example uses `https://stock.indianapi.in`).
4. Keep `backend/.env` out of version control. `.gitignore` already excludes it.

## Run Locally

From the repository root, install the backend dependencies and start FastAPI:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, start the frontend:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the FastAPI server on port 8000.

## Market API

- `GET /api/market/quote?symbol=RELIANCE`
- `GET /api/market/history?symbol=RELIANCE&period=1yr&filter=default`
- `GET /api/market/intraday?symbol=RELIANCE`
- `GET /api/market/overview`
- `GET /api/market/quotes?symbols=RELIANCE,TCS,INFY`

Quotes refresh at 60-second intervals in the UI. Set the non-secret `VITE_MARKET_POLL_INTERVAL_MS` value to configure that interval; values below 60000 are raised to the 60-second minimum. Backend responses are cached for 60 seconds for quote/overview/intraday and 5 minutes for history. IndianAPI market data is delayed and may be stale while exchanges are closed; the UI displays provider timestamps and unavailable-plan states rather than inventing values.

## Checks

```powershell
python -m pytest backend/tests -q
Push-Location frontend
npm run build
Pop-Location
```

A real provider quote requires a valid `INDIAN_API_KEY` and access to the selected base URL/endpoints under the subscription plan. Missing credentials produce a configuration error; they do not fall back to mock data.
