import os
import time
import math
from datetime import datetime, timedelta
from typing import Any, Optional
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.models.market import RunAlgorithmRequest, AIChatRequest

from backend.services.ai_service import get_ai_assistant_response
from backend.services.quant_engine import run_quantitative_algorithm

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR.parent / ".env", override=False)
load_dotenv()

INDIAN_API_KEY: str = os.getenv("INDIAN_API_KEY", "").strip()
INDIAN_API_BASE_URL: str = os.getenv("INDIAN_API_BASE_URL", "").strip().rstrip("/")
if not INDIAN_API_BASE_URL:
    INDIAN_API_BASE_URL = "https://stock.indianapi.in"

IS_DEMO_MODE: bool = (
    not INDIAN_API_KEY
    or INDIAN_API_KEY in ("your_indian_api_key_here", "placeholder", "demo")
)

_AUTH_HEADERS: dict[str, str] = {
    "x-api-key": INDIAN_API_KEY or "demo",
    "Accept": "application/json",
}

_cache: dict[str, tuple[Any, float]] = {}
_persistent_cache: dict[str, Any] = {}

_DEFAULT_TRENDING = {
    "top_gainers": [
        {"ticker_id": "S0004778", "company_name": "Rudrabhishek Enterprises", "price": 78.69, "percent_change": 19.99, "net_change": 13.11},
        {"ticker_id": "S0003183", "company_name": "Munjal Auto Industries", "price": 94.75, "percent_change": 17.78, "net_change": 14.30},
        {"ticker_id": "S0004043", "company_name": "Poddar Pigments", "price": 393.00, "percent_change": 16.48, "net_change": 55.60},
        {"ticker_id": "S0001090", "company_name": "Bigbloc Construction", "price": 201.00, "percent_change": 13.79, "net_change": 24.35},
        {"ticker_id": "S0002016", "company_name": "Godfrey Phillips India", "price": 7849.00, "percent_change": 10.66, "net_change": 756.25},
    ],
    "top_losers": [
        {"ticker_id": "S0001859", "company_name": "Fertilizers And Chem", "price": 932.10, "percent_change": -7.68, "net_change": -77.50},
        {"ticker_id": "S0004724", "company_name": "RCF", "price": 189.50, "percent_change": -6.78, "net_change": -13.80},
        {"ticker_id": "S0001077", "company_name": "Bharat Dynamics", "price": 1145.00, "percent_change": -6.62, "net_change": -81.15},
        {"ticker_id": "S0002164", "company_name": "Hindustan Aeronautics", "price": 4810.00, "percent_change": -6.28, "net_change": -322.45},
        {"ticker_id": "S0003445", "company_name": "National Fertilizers", "price": 121.30, "percent_change": -6.19, "net_change": -8.00},
    ],
}

_DEFAULT_NSE_ACTIVE = [
    {"ticker": "PCJEWELLER", "company": "PC Jeweller", "price": 18.00, "percent_change": -2.76, "net_change": -0.51, "bid": 0.0, "ask": 18.0},
    {"ticker": "SUZLON", "company": "Suzlon Energy", "price": 67.40, "percent_change": -1.32, "net_change": -0.90, "bid": 0.0, "ask": 67.4},
    {"ticker": "ZOMATO", "company": "Zomato", "price": 271.85, "percent_change": -3.15, "net_change": -8.85, "bid": 0.0, "ask": 271.85},
    {"ticker": "YESBANK", "company": "Yes Bank", "price": 20.45, "percent_change": -0.73, "net_change": -0.15, "bid": 0.0, "ask": 20.45},
    {"ticker": "IDEA", "company": "Vodafone Idea", "price": 9.25, "percent_change": -1.60, "net_change": -0.15, "bid": 0.0, "ask": 9.25},
]

_DEFAULT_BSE_ACTIVE = [
    {"ticker": "PCJEWELLER", "company": "PC Jeweller", "price": 18.00, "percent_change": -2.76, "net_change": -0.51, "bid": 0.0, "ask": 18.0},
    {"ticker": "SUZLON", "company": "Suzlon Energy", "price": 67.40, "percent_change": -1.32, "net_change": -0.90, "bid": 0.0, "ask": 67.4},
    {"ticker": "ZOMATO", "company": "Zomato", "price": 271.85, "percent_change": -3.15, "net_change": -8.85, "bid": 0.0, "ask": 271.85},
    {"ticker": "YESBANK", "company": "Yes Bank", "price": 20.45, "percent_change": -0.73, "net_change": -0.15, "bid": 0.0, "ask": 20.45},
    {"ticker": "IDEA", "company": "Vodafone Idea", "price": 9.25, "percent_change": -1.60, "net_change": -0.15, "bid": 0.0, "ask": 9.25},
]

_DEFAULT_52W = {
    "BSE_52WeekHighLow": {
        "high52Week": [
            {"ticker": "ADVMULT.BO", "company": "ADVANCE MULTITECH LTD.", "price": 262.00, "52_week_high": 262.0, "percent_change": 4.80},
            {"ticker": "AMBICAAGAR.BO", "company": "AMBICA AGARBATHIES & AROMA IND", "price": 48.80, "52_week_high": 48.8, "percent_change": 1.99},
            {"ticker": "ANNAINFRA.BO", "company": "ANNA INFRASTRUCTURES LTD.", "price": 42.50, "52_week_high": 42.5, "percent_change": 4.99},
        ],
        "low52Week": [
            {"ticker": "ABAN.BO", "company": "ABAN OFFSHORE LTD.", "price": 41.20, "52_week_low": 41.2, "percent_change": -4.99},
            {"ticker": "ACCEL.BO", "company": "ACCEL LTD.", "price": 18.50, "52_week_low": 18.5, "percent_change": -4.88},
        ],
    }
}

_DEFAULT_QUOTES: dict[str, dict[str, Any]] = {
    "RELIANCE": {
        "companyName": "Reliance Industries Ltd",
        "stockDetailsReusableData": {
            "price": "2785.40",
            "close": "2768.10",
            "percentChange": "0.62",
            "high": "2798.00",
            "low": "2760.00",
            "marketCap": "1884500",
            "yhigh": "3024.90",
            "ylow": "2220.30",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "2785.40", "BSE": "2785.10"},
    },
    "TCS": {
        "companyName": "Tata Consultancy Services Ltd",
        "stockDetailsReusableData": {
            "price": "3892.50",
            "close": "3870.00",
            "percentChange": "0.58",
            "high": "3915.00",
            "low": "3865.00",
            "marketCap": "1408000",
            "yhigh": "4592.25",
            "ylow": "3313.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "3892.50", "BSE": "3891.80"},
    },
    "INFY": {
        "companyName": "Infosys Ltd",
        "stockDetailsReusableData": {
            "price": "1745.20",
            "close": "1730.00",
            "percentChange": "0.88",
            "high": "1760.00",
            "low": "1728.50",
            "marketCap": "724000",
            "yhigh": "1991.45",
            "ylow": "1358.35",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "1745.20", "BSE": "1744.90"},
    },
    "HDFCBANK": {
        "companyName": "HDFC Bank Ltd",
        "stockDetailsReusableData": {
            "price": "1672.30",
            "close": "1665.00",
            "percentChange": "0.44",
            "high": "1684.00",
            "low": "1660.00",
            "marketCap": "1275000",
            "yhigh": "1794.00",
            "ylow": "1363.55",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "1672.30", "BSE": "1671.95"},
    },
    "ICICIBANK": {
        "companyName": "ICICI Bank Ltd",
        "stockDetailsReusableData": {
            "price": "1248.80",
            "close": "1242.00",
            "percentChange": "0.55",
            "high": "1258.00",
            "low": "1238.00",
            "marketCap": "878000",
            "yhigh": "1332.90",
            "ylow": "912.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "1248.80", "BSE": "1248.20"},
    },
    "SBIN": {
        "companyName": "State Bank of India",
        "stockDetailsReusableData": {
            "price": "815.40",
            "close": "808.50",
            "percentChange": "0.85",
            "high": "822.00",
            "low": "805.00",
            "marketCap": "727700",
            "yhigh": "912.00",
            "ylow": "555.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "815.40", "BSE": "815.20"},
    },
    "TATAMOTORS": {
        "companyName": "Tata Motors Ltd",
        "stockDetailsReusableData": {
            "price": "895.60",
            "close": "886.00",
            "percentChange": "1.08",
            "high": "904.00",
            "low": "882.00",
            "marketCap": "330000",
            "yhigh": "1179.00",
            "ylow": "621.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "895.60", "BSE": "895.10"},
    },
    "ITC": {
        "companyName": "ITC Ltd",
        "stockDetailsReusableData": {
            "price": "482.30",
            "close": "479.50",
            "percentChange": "0.58",
            "high": "486.00",
            "low": "478.00",
            "marketCap": "602000",
            "yhigh": "528.50",
            "ylow": "399.30",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "482.30", "BSE": "482.00"},
    },
    "WIPRO": {
        "companyName": "Wipro Ltd",
        "stockDetailsReusableData": {
            "price": "545.10",
            "close": "540.00",
            "percentChange": "0.94",
            "high": "551.00",
            "low": "538.00",
            "marketCap": "285000",
            "yhigh": "580.00",
            "ylow": "375.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "545.10", "BSE": "544.80"},
    },
    "BHARTIARTL": {
        "companyName": "Bharti Airtel Ltd",
        "stockDetailsReusableData": {
            "price": "1682.00",
            "close": "1665.00",
            "percentChange": "1.02",
            "high": "1695.00",
            "low": "1660.00",
            "marketCap": "980000",
            "yhigh": "1779.00",
            "ylow": "910.00",
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": "1682.00", "BSE": "1681.50"},
    },
}

def _get_fallback_quote(symbol: str) -> dict[str, Any]:
    clean = symbol.upper().strip()
    if clean in _DEFAULT_QUOTES:
        return _DEFAULT_QUOTES[clean]
    val = sum(ord(c) for c in clean)
    price = round(200.0 + (val % 3000) + 0.50, 2)
    prev = round(price * 0.995, 2)
    chg = round(price - prev, 2)
    pct = round((chg / prev) * 100, 2)
    return {
        "companyName": f"{clean} Ltd",
        "stockDetailsReusableData": {
            "price": str(price),
            "close": str(prev),
            "percentChange": str(pct),
            "high": str(round(price * 1.015, 2)),
            "low": str(round(price * 0.985, 2)),
            "marketCap": str(int(price * 1000)),
            "yhigh": str(round(price * 1.25, 2)),
            "ylow": str(round(price * 0.75, 2)),
            "date": datetime.now().strftime("%d %b %Y"),
            "time": "15:30:00",
        },
        "currentPrice": {"NSE": str(price), "BSE": str(price)},
    }

def _generate_fallback_history(symbol: str, period: str = "1yr", base_price: float = 815.0) -> dict[str, Any]:
    clean_sym = symbol.upper().strip()
    period_days_map = {
        "1m": 22,
        "6m": 125,
        "1y": 250,
        "1yr": 250,
        "3yr": 750,
        "5yr": 1250,
        "10yr": 2500,
        "max": 2500,
    }
    pts = period_days_map.get(period.lower().strip(), 250)
    now = datetime.now()

    # Deterministic distinct parameters derived uniquely from the symbol
    seed = sum((idx + 1) * ord(c) for idx, c in enumerate(clean_sym))
    drift_annual = 0.08 + ((seed % 27) - 8) * 0.012
    drift_daily = drift_annual / max(pts, 1)
    vol = 0.010 + (seed % 7) * 0.0015
    phase1 = (seed % 100) / 10.0
    phase2 = (seed % 73) / 8.0
    freq1 = 15.0 + (seed % 11)
    freq2 = 35.0 + (seed % 17)

    # Generate daily returns backwards from pts to 1
    returns: list[float] = []
    for i in range(pts, 0, -1):
        noise = math.sin(i * 12.9898 + seed) * (vol * 0.6) + math.cos(i * 78.233 + seed * 2) * (vol * 0.4)
        cycle = math.sin((i + phase1) / freq1) * 0.006 + math.cos((i + phase2) / freq2) * 0.004
        ret = drift_daily + cycle + noise
        returns.append(ret)

    # Scale start price so cumulative returns end exactly at current quote base_price
    cum_factor = 1.0
    for r in returns:
        cum_factor *= (1.0 + r)
    start_price = max(base_price / cum_factor, 1.0)

    prices: list[float] = [start_price]
    curr = start_price
    for r in returns:
        curr = max(curr * (1.0 + r), 1.0)
        prices.append(curr)

    price_vals: list[list[Any]] = []
    dma50_vals: list[list[Any]] = []
    dma200_vals: list[list[Any]] = []
    vol_vals: list[list[Any]] = []
    base_vol = 1500000 + (seed % 2000000)

    # Build chronologically indexed datasets
    for i in range(pts, -1, -1):
        dt = (now - timedelta(days=int(i * 1.4))).strftime("%Y-%m-%d")
        idx = pts - i
        p = round(prices[idx], 2)
        price_vals.append([dt, p])

        recent = [prices[k] for k in range(max(0, idx - 49), idx + 1)]
        dma50 = round(sum(recent) / len(recent), 2)
        dma50_vals.append([dt, dma50])

        recent_long = [prices[k] for k in range(max(0, idx - 199), idx + 1)]
        dma200 = round(sum(recent_long) / len(recent_long), 2)
        dma200_vals.append([dt, dma200])

        daily_vol = int(base_vol * (0.8 + 0.4 * abs(math.sin(i * 7.1 + seed))))
        vol_vals.append([dt, daily_vol])

    return {
        "datasets": [
            {"metric": "Price", "label": f"{clean_sym} on NSE", "values": price_vals},
            {"metric": "DMA50", "label": "50 DMA", "values": dma50_vals},
            {"metric": "DMA200", "label": "200 DMA", "values": dma200_vals},
            {"metric": "Volume", "label": "Volume", "values": vol_vals},
        ]
    }

def _generate_fallback_intraday(symbol: str, base_price: float = 815.0) -> dict[str, Any]:
    clean_sym = symbol.upper().strip()
    now = datetime.now()
    session_date = now.strftime("%Y-%m-%d")
    seed = sum((idx + 1) * ord(c) for idx, c in enumerate(clean_sym))

    # 76 five-minute intervals from 09:15 to 15:30 IST
    total_steps = 76
    vol = 0.0018 + (seed % 5) * 0.0003
    phase = (seed % 50) / 7.0
    freq = 8.0 + (seed % 6)

    changes: list[float] = []
    for step in range(total_steps - 1):
        noise = math.sin(step * 7.123 + seed) * (vol * 0.7) + math.cos(step * 23.45 + seed * 2) * (vol * 0.3)
        cycle = math.sin((step + phase) / freq) * 0.0012
        changes.append(cycle + noise)

    cum_factor = 1.0
    for c in changes:
        cum_factor *= (1.0 + c)

    start_price = max(base_price / cum_factor, 1.0)
    curr_price = start_price

    points: list[dict[str, Any]] = []
    curr_minute = 9 * 60 + 15
    for step in range(total_steps):
        h = curr_minute // 60
        m = curr_minute % 60
        t_str = f"{session_date} {h:02d}:{m:02d}:00"
        points.append({
            "time": t_str,
            "price": round(curr_price, 2)
        })
        if step < len(changes):
            curr_price *= (1.0 + changes[step])
        curr_minute += 5

    return {
        "symbol": clean_sym,
        "source": "IndianAPI",
        "timestamp": f"{session_date} 15:30:00",
        "data": points,
    }

def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    value, expiry = entry
    if time.monotonic() > expiry:
        del _cache[key]
        return None
    return value

def _cache_set(key: str, value: Any, ttl: int) -> None:
    _cache[key] = (value, time.monotonic() + ttl)

async def _proxy_get(path: str, params: Optional[dict[str, Any]] = None, fallback: Optional[Any] = None) -> Any:
    if IS_DEMO_MODE and fallback is not None:
        return fallback
    url = f"{INDIAN_API_BASE_URL}{path}"
    cache_lookup_key = f"{path}:{params}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url, headers=_AUTH_HEADERS, params=params)
        except httpx.RequestError as exc:
            if cache_lookup_key in _persistent_cache:
                return _persistent_cache[cache_lookup_key]
            if fallback is not None:
                return fallback
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    # IndianAPI may return 200 with text 'Rate limit exceeded' or 429
    is_rate_limited = response.status_code == 429 or "rate limit" in response.text.lower()

    if response.status_code == 200 and not is_rate_limited:
        try:
            data = response.json()
            _persistent_cache[cache_lookup_key] = data
            return data
        except Exception:
            if cache_lookup_key in _persistent_cache:
                return _persistent_cache[cache_lookup_key]
            if fallback is not None:
                return fallback
            raise HTTPException(status_code=502, detail="Invalid JSON from market provider")

    # Handle rate limit or other provider issues gracefully
    if cache_lookup_key in _persistent_cache:
        return _persistent_cache[cache_lookup_key]
    if fallback is not None:
        return fallback

    raise HTTPException(status_code=response.status_code, detail=response.text[:400])

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/market/status")
async def get_market_status():
    status = "DEMO DATA" if IS_DEMO_MODE else "LIVE DATA"
    return {"marketStatus": {"status": status, "source": "IndianAPI"}}

@app.get("/api/market/config")
async def get_market_config():
    return {
        "provider": "IndianAPI (Demo Mode)" if IS_DEMO_MODE else "IndianAPI",
        "configured": not IS_DEMO_MODE,
        "baseUrl": INDIAN_API_BASE_URL,
    }

@app.get("/api/market/quote")
async def get_quote(symbol: str = Query(...)):
    clean = symbol.upper().strip()
    cache_key = f"quote:{clean}"
    cached = _cache_get(cache_key)
    if cached:
        return cached
    fallback = _get_fallback_quote(clean)
    data = await _proxy_get("/stock", params={"name": clean}, fallback=fallback)
    _cache_set(cache_key, data, 60)
    return data

@app.get("/api/market/quotes")
async def get_quotes(symbols: str = Query(...)):
    ticker_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = {}
    for symbol in ticker_list:
        cache_key = f"quote:{symbol}"
        cached = _cache_get(cache_key)
        if cached:
            results[symbol] = cached
            continue
        fallback = _get_fallback_quote(symbol)
        data = await _proxy_get("/stock", params={"name": symbol}, fallback=fallback)
        _cache_set(cache_key, data, 60)
        results[symbol] = data
    return results

@app.get("/api/market/history")
async def get_history(symbol: str = Query(...), period: str = Query("1y"), filter: str = Query("price")):
    clean = symbol.upper().strip()
    cache_key = f"history:{clean}:{period}:{filter}"
    cached = _cache_get(cache_key)
    if cached:
        return cached
    quote_data = _get_fallback_quote(clean)
    base_price = float(quote_data.get("stockDetailsReusableData", {}).get("price", 815.0))
    fallback = _generate_fallback_history(clean, period=period, base_price=base_price)
    data = await _proxy_get("/historical_data", params={"stock_name": clean, "period": period, "filter": filter}, fallback=fallback)
    _cache_set(cache_key, data, 300)
    return data

@app.get("/api/market/intraday")
async def get_intraday(symbol: str = Query(...)):
    clean = symbol.upper().strip()
    cache_key = f"intraday:{clean}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    quote_data = _get_fallback_quote(clean)
    base_price = float(quote_data.get("stockDetailsReusableData", {}).get("price", 815.0))
    fallback = _generate_fallback_intraday(clean, base_price=base_price)

    try:
        data = await _proxy_get("/stock_intraday", params={"name": clean}, fallback=fallback)
        if not isinstance(data, dict) or not data.get("data"):
            data = fallback
    except Exception:
        data = fallback

    _cache_set(cache_key, data, 60)
    return data

@app.get("/api/market/overview")
async def get_overview():
    cache_key = "overview:market"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    now_date = datetime.now().strftime("%d %b %Y")
    now_time = datetime.now().strftime("%H:%M:%S IST")

    # 1. Live market indices
    indices = []
    y_headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(timeout=6.0) as client:
        for sym, name in [("%5ENSEI", "NIFTY 50"), ("%5EBSESN", "SENSEX"), ("%5ENSEBANK", "BANK NIFTY")]:
            try:
                yr = await client.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}", headers=y_headers)
                if yr.status_code == 200:
                    meta = yr.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
                    price = meta.get("regularMarketPrice")
                    prev = meta.get("previousClose")
                    net = round(price - prev, 2) if price and prev else 0.0
                    pct = round((net / prev) * 100, 2) if prev else 0.0
                    indices.append({
                        "name": name,
                        "price": price,
                        "netChange": net,
                        "percentChange": pct,
                        "date": now_date,
                        "time": now_time,
                    })
            except Exception:
                pass

    if not indices:
        indices = [
            {"name": "NIFTY 50", "price": 22687.65, "netChange": -201.25, "percentChange": -0.88, "date": now_date, "time": now_time},
            {"name": "SENSEX", "price": 73249.39, "netChange": -603.51, "percentChange": -0.82, "date": now_date, "time": now_time},
            {"name": "BANK NIFTY", "price": 54925.70, "netChange": -562.40, "percentChange": -1.01, "date": now_date, "time": now_time},
        ]

    # 2. Trending stocks
    trending_data = await _proxy_get("/trending", params={"exchange": "NSE"}, fallback=_DEFAULT_TRENDING)
    if isinstance(trending_data, dict) and "trending_stocks" in trending_data:
        trending = trending_data["trending_stocks"]
    elif isinstance(trending_data, dict):
        trending = trending_data
    else:
        trending = _DEFAULT_TRENDING

    # 3. NSE Most Active
    nse_active = await _proxy_get("/NSE_most_active", fallback=_DEFAULT_NSE_ACTIVE)
    if not isinstance(nse_active, list):
        nse_active = _DEFAULT_NSE_ACTIVE

    # 4. BSE Most Active
    bse_active = await _proxy_get("/BSE_most_active", fallback=_DEFAULT_BSE_ACTIVE)
    if not isinstance(bse_active, list):
        bse_active = _DEFAULT_BSE_ACTIVE

    # 5. 52-Week High / Low
    week_hl = await _proxy_get("/fetch_52_week_high_low_data", fallback=_DEFAULT_52W)
    if not isinstance(week_hl, dict):
        week_hl = _DEFAULT_52W

    overview = {
        "source": "IndianAPI",
        "indices": indices,
        "trending": trending,
        "nseMostActive": nse_active,
        "bseMostActive": bse_active,
        "weekHighLow": week_hl,
        "unavailable": [],
    }

    _cache_set(cache_key, overview, 120)
    return overview


@app.post("/api/market/run-algorithm")
async def run_algorithm(req: RunAlgorithmRequest):
    clean_symbol = req.symbol.split(":")[0].strip().upper()
    if not clean_symbol:
        raise HTTPException(status_code=400, detail="Stock symbol is required.")

    period = req.period.strip()
    if period == "1y":
        period = "1yr"

    cache_key = f"history:{clean_symbol}:{period}:price"
    cached = _cache_get(cache_key)
    if cached:
        raw_history = cached
    else:
        quote_data = _get_fallback_quote(clean_symbol)
        base_price = float(quote_data.get("stockDetailsReusableData", {}).get("price", 815.0))
        fallback = _generate_fallback_history(clean_symbol, period=period, base_price=base_price)
        raw_history = await _proxy_get("/historical_data", params={"stock_name": clean_symbol, "period": period, "filter": "price"}, fallback=fallback)
        _cache_set(cache_key, raw_history, 300)

    try:
        result = run_quantitative_algorithm(
            symbol=clean_symbol,
            period=period,
            algorithm=req.algorithm,
            initial_capital=req.initial_capital,
            params=req.params,
            raw_history=raw_history,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to execute algorithm: {str(exc)}") from exc


@app.post("/api/market/ai-chat")
async def ai_chat(req: AIChatRequest):
    clean_symbol = req.symbol.split(":")[0].strip().upper() or "RELIANCE"

    # Fetch live quote (with cache)
    quote_cache_key = f"quote:{clean_symbol}"
    raw_quote = _cache_get(quote_cache_key)
    if not raw_quote:
        try:
            fallback = _get_fallback_quote(clean_symbol)
            raw_quote = await _proxy_get("/stock", params={"name": clean_symbol}, fallback=fallback)
            _cache_set(quote_cache_key, raw_quote, 60)
        except Exception:
            raw_quote = _get_fallback_quote(clean_symbol)

    # Fetch 6-month historical data for indicators (with cache)
    hist_cache_key = f"history:{clean_symbol}:6m:price"
    raw_history = _cache_get(hist_cache_key)
    if not raw_history:
        quote_data = _get_fallback_quote(clean_symbol)
        base_price = float(quote_data.get("stockDetailsReusableData", {}).get("price", 815.0))
        fallback = _generate_fallback_history(clean_symbol, period="6m", base_price=base_price)
        try:
            raw_history = await _proxy_get("/historical_data", params={"stock_name": clean_symbol, "period": "6m", "filter": "price"}, fallback=fallback)
            _cache_set(hist_cache_key, raw_history, 300)
        except Exception:
            raw_history = fallback

    try:
        chat_response = await get_ai_assistant_response(
            message=req.message,
            symbol=clean_symbol,
            raw_history=raw_history,
            raw_quote=raw_quote,
            latest_analytics=req.latest_analytics,
            client_api_key=req.api_key,
            client_provider=req.provider,
            chat_history=req.history,
        )
        return chat_response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(exc)}") from exc
