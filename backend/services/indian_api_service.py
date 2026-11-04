from __future__ import annotations

import math
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR.parent / ".env", override=False)

SUPPORTED_PERIODS = {'1m', '6m', '1yr', '3yr', '5yr', '10yr', 'max'}
SUPPORTED_SYMBOLS = {
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
    'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL',
}


class IndianAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class IndianAPIService:
    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        self.api_key = (api_key if api_key is not None else os.getenv('INDIAN_API_KEY', '')).strip()
        self.base_url = (base_url or os.getenv('INDIAN_API_BASE_URL') or 'https://stock.indianapi.in').rstrip('/')
        self._cache: dict[str, tuple[float, Any]] = {}
        self._stock_ids: dict[str, str] | None = None

    def configuration_status(self) -> dict[str, Any]:
        return {
            'provider': 'IndianAPI',
            'configured': bool(self.api_key),
            'baseUrl': self.base_url,
        }

    @staticmethod
    def _number(value: Any) -> float | None:
        if value in (None, ''):
            return None
        try:
            number = float(str(value).replace(',', '').replace('%', '').strip())
        except (TypeError, ValueError):
            return None
        return number if number == number and abs(number) != float('inf') else None

    @staticmethod
    def _symbol(value: str) -> str:
        symbol = (value or '').strip().upper().split(':', 1)[0]
        if not symbol or not symbol.replace('.', '').isalnum():
            raise ValueError('Invalid or unsupported stock symbol.')
        return symbol

    def _request(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        method: str | None = None,
        ttl: int = 60,
        use_cache: bool = True,
    ) -> Any:
        if not self.api_key:
            raise IndianAPIError('Market data service is not configured.')

        cache_key = f"{path}?{urlencode(sorted((params or {}).items()))}|{body}"
        cached = self._cache.get(cache_key)
        if use_cache and cached and time.monotonic() - cached[0] < ttl:
            return cached[1]

        try:
            response = requests.request(
                method or ('POST' if body is not None else 'GET'),
                f"{self.base_url}/{path.lstrip('/')}",
                params=params,
                json=body,
                headers={'X-API-Key': self.api_key},
                timeout=20,
            )
        except requests.RequestException as exc:
            raise IndianAPIError('Unable to retrieve market data.') from exc

        if response.status_code == 429:
            raise IndianAPIError('API request limit reached.', 429)
        if response.status_code == 401:
            raise IndianAPIError('Invalid API credentials.', response.status_code)
        if response.status_code == 403:
            raise IndianAPIError('verify your subscription permissions', response.status_code)
        if response.status_code == 404 and path == 'get_stock_data':
            raise IndianAPIError('Invalid or unsupported stock symbol.', 404)
        if response.status_code == 404:
            raise IndianAPIError('Market data unavailable.', 404)
        if response.status_code >= 400:
            raise IndianAPIError('Unable to retrieve market data.', response.status_code)

        try:
            data = response.json()
        except ValueError as exc:
            raise IndianAPIError('Market data unavailable.') from exc

        if isinstance(data, dict) and (
            any(key in data for key in ('error', 'detail'))
            or str(data.get('status') or '').lower() == 'error'
        ):
            detail = str(data.get('error') or data.get('detail') or data.get('message') or '').lower()
            if 'symbol' in detail or 'stock' in detail or 'not found' in detail:
                raise IndianAPIError('Invalid or unsupported stock symbol.')
            if 'limit' in detail or 'rate' in detail:
                raise IndianAPIError('API request limit reached.', 429)
            if 'key' in detail or 'auth' in detail:
                raise IndianAPIError('Invalid API credentials.', 401)
            raise IndianAPIError('Market data unavailable.')

        self._cache[cache_key] = (time.monotonic(), data)
        if len(self._cache) > 100:
            oldest = min(self._cache, key=lambda key: self._cache[key][0])
            del self._cache[oldest]
        return data

    def _stock_identifier(self, symbol: str) -> str:
        if self._stock_ids is None:
            try:
                response = requests.get('https://dev.indianapi.in/static/all_stocks.json', timeout=20)
                response.raise_for_status()
                items = response.json()
            except (requests.RequestException, ValueError) as exc:
                raise IndianAPIError('Market data unavailable.') from exc
            self._stock_ids = {
                str(item.get('nse-code', '')).upper(): str(item.get('id', ''))
                for item in items
                if isinstance(item, dict) and item.get('nse-code') and item.get('id')
            }
        stock_id = self._stock_ids.get(symbol)
        if not stock_id:
            raise IndianAPIError('Invalid or unsupported stock symbol.')
        return stock_id

    @staticmethod
    def _quote_payload(payload: Any, symbol: str) -> dict[str, Any]:
        if isinstance(payload, list):
            payload = payload[0] if payload and isinstance(payload[0], dict) else {}
        if not isinstance(payload, dict):
            payload = {}
        for key in (symbol, symbol.upper(), symbol.lower()):
            if isinstance(payload.get(key), dict):
                payload = payload[key]
                break
        price = IndianAPIService._number(payload.get('ltp'))
        change = IndianAPIService._number(payload.get('day_change'))
        change_percent = IndianAPIService._number(payload.get('day_change_percent'))
        close = IndianAPIService._number(payload.get('close'))
        return {
            'symbol': symbol,
            'companyName': str(payload.get('company') or payload.get('company_name') or symbol),
            'price': price,
            'currency': 'INR',
            'change': change,
            'changePercent': change_percent,
            'previousClose': close,
            'open': IndianAPIService._number(payload.get('open')),
            'dayHigh': IndianAPIService._number(payload.get('high')),
            'dayLow': IndianAPIService._number(payload.get('low')),
            'volume': int(IndianAPIService._number(payload.get('volume')) or 0) or None,
            'marketCap': None,
            'fiftyTwoWeekHigh': IndianAPIService._number(payload.get('year_high') or payload.get('52_week_high')),
            'fiftyTwoWeekLow': IndianAPIService._number(payload.get('year_low') or payload.get('52_week_low')),
            'marketStatus': 'Market Closed' if IndianAPIService._market_is_closed() else 'Market Open',
            'dataStatus': 'DELAYED DATA',
            'source': 'IndianAPI',
            'timestamp': payload.get('timestamp') or payload.get('last_trade_time'),
        }

    @staticmethod
    def _market_is_closed() -> bool:
        india_timezone = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(india_timezone)
        return now.weekday() >= 5 or now.hour < 9 or (now.hour == 9 and now.minute < 15) or now.hour > 15 or (now.hour == 15 and now.minute > 30)

    def get_stock_quote(self, symbol: str) -> dict[str, Any]:
        normalized = self._symbol(symbol)
        if normalized not in SUPPORTED_SYMBOLS:
            raise IndianAPIError('Invalid or unsupported stock symbol.')
        payload = self._request('get_stock_data', params={'stock_name': normalized}, ttl=60)
        quote = self._quote_payload(payload, normalized)
        if quote['price'] is None:
            raise IndianAPIError('Market data unavailable.')
        return quote

    def get_nse_batch_quotes(self, symbols: list[str]) -> list[dict[str, Any]]:
        normalized_symbols = list(dict.fromkeys(self._symbol(symbol) for symbol in symbols))
        if not normalized_symbols or len(normalized_symbols) > 10:
            raise ValueError('Provide between one and ten stock symbols.')
        unsupported = [symbol for symbol in normalized_symbols if symbol not in SUPPORTED_SYMBOLS]
        if unsupported:
            raise IndianAPIError('Invalid or unsupported stock symbol.')
        payload = self._request(
            'nse_stock_batch_live_price',
            body={'stock_symbols': normalized_symbols},
            ttl=60,
        )
        if not isinstance(payload, dict):
            raise IndianAPIError('Market data unavailable.')
        quotes = []
        for symbol in normalized_symbols:
            raw = payload.get(symbol)
            if raw and isinstance(raw, dict) and (raw.get('ltp') is not None or raw.get('price') is not None):
                quote = self._quote_payload(raw, symbol)
                if quote['price'] is not None:
                    quotes.append(quote)
        return quotes

    def get_historical_data(self, symbol: str, period: str = '1yr', data_filter: str = 'default') -> dict[str, Any]:
        normalized = self._symbol(symbol)
        if normalized not in SUPPORTED_SYMBOLS:
            raise IndianAPIError('Invalid or unsupported stock symbol.')
        if period not in SUPPORTED_PERIODS:
            raise ValueError('Unsupported historical period.')
        if data_filter not in {'default', 'price', 'pe', 'sm', 'evebitda', 'ptb', 'mcs'}:
            raise ValueError('Unsupported historical filter.')
        payload = self._request(
            'historical_data',
            params={'stock_name': normalized, 'period': period, 'filter': data_filter},
            ttl=300,
        )
        datasets = payload.get('datasets', []) if isinstance(payload, dict) else []
        by_metric: dict[str, dict[str, float | None]] = {}
        for dataset in datasets:
            if not isinstance(dataset, dict):
                continue
            metric = str(dataset.get('metric') or '').lower()
            values = dataset.get('values')
            if not isinstance(values, list):
                continue
            points: dict[str, float | None] = {}
            for entry in values:
                if isinstance(entry, (list, tuple)) and len(entry) >= 2 and entry[0]:
                    points[str(entry[0])] = self._number(entry[1])
            by_metric[metric] = points

        price_series = by_metric.get('price', {})
        data = [
            {
                'datetime': date,
                'open': value,
                'high': value,
                'low': value,
                'close': value,
                'volume': by_metric.get('volume', {}).get(date),
                'dma50': by_metric.get('dma50', {}).get(date),
                'dma200': by_metric.get('dma200', {}).get(date),
            }
            for date, value in price_series.items()
            if value is not None
        ]
        data.sort(key=lambda item: item['datetime'])
        if not data:
            raise IndianAPIError('Market data unavailable.')
        return {'symbol': normalized, 'period': period, 'source': 'IndianAPI', 'data': data}

    def get_intraday_data(self, symbol: str) -> dict[str, Any]:
        normalized = self._symbol(symbol)
        if normalized not in SUPPORTED_SYMBOLS:
            raise IndianAPIError('Invalid or unsupported stock symbol.')
        stock_id = self._stock_identifier(normalized)
        payload = self._request('1D_intraday_data', params={'stock_id': stock_id}, method='POST', ttl=60)
        if isinstance(payload, list):
            record = next((item for item in payload if isinstance(item, dict)), {})
        elif isinstance(payload, dict):
            record = payload
        else:
            record = {}
        raw_values = record.get('values', [])
        points = [
            {'time': item.get('timeStamp'), 'price': self._number(item.get('price'))}
            for item in raw_values
            if isinstance(item, dict) and item.get('timeStamp') and self._number(item.get('price')) is not None
        ] if isinstance(raw_values, list) else []
        points.sort(key=lambda item: item['time'] or '')
        if not points:
            raise IndianAPIError('Market data unavailable.')
        return {
            'symbol': normalized,
            'source': 'IndianAPI',
            'timestamp': points[-1]['time'],
            'data': points,
        }

    def get_trending_stocks(self) -> Any:
        return self._request('trending', params={'exchange': 'NSE'}, ttl=60)

    def get_nse_most_active(self) -> Any:
        return self._request('NSE_most_active', ttl=60)

    def get_bse_most_active(self) -> Any:
        return self._request('BSE_most_active', ttl=60)

    def get_market_indices(self) -> Any:
        return self._request('indices', params={'index_type': 'POPULAR'}, ttl=60)

    def get_market_overview(self) -> dict[str, Any]:
        endpoints = {
            'indices': self.get_market_indices,
            'trending': self.get_trending_stocks,
            'nseMostActive': self.get_nse_most_active,
            'bseMostActive': self.get_bse_most_active,
            'weekHighLow': lambda: self._request('fetch_52_week_high_low_data', ttl=60),
        }
        responses: dict[str, Any] = {}
        unavailable: list[str] = []
        for name, fetch in endpoints.items():
            try:
                responses[name] = fetch()
            except IndianAPIError as exc:
                if exc.status_code not in (403, 404):
                    raise
                responses[name] = None
                unavailable.append(name)

        indices = responses['indices']
        trending = responses['trending']
        return {
            'source': 'IndianAPI',
            'indices': indices.get('indices', []) if isinstance(indices, dict) else indices,
            'trending': trending.get('trending_stocks', {}) if isinstance(trending, dict) else trending,
            'nseMostActive': responses['nseMostActive'],
            'bseMostActive': responses['bseMostActive'],
            'weekHighLow': responses['weekHighLow'],
            'unavailable': unavailable,
        }
