from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import yfinance as yf

from backend.market_data_provider import MarketDataProvider


class YahooFinanceProvider(MarketDataProvider):
    def get_quote(self, symbol: str) -> dict[str, Any]:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        history = ticker.history(period='5d', interval='1d')

        latest = history.tail(1)
        previous_close = float(info.get('previous_close')) if info.get('previous_close') is not None else None
        open_price = float(info.get('open')) if info.get('open') is not None else None
        day_high = float(info.get('day_high')) if info.get('day_high') is not None else None
        day_low = float(info.get('day_low')) if info.get('day_low') is not None else None
        market_cap = float(info.get('market_cap')) if info.get('market_cap') is not None else None
        volume = int(info.get('last_volume')) if info.get('last_volume') is not None else None
        price = float(info.get('last_price')) if info.get('last_price') is not None else (float(latest['Close'].iloc[0]) if not latest.empty else None)

        if price is None and info.get('regularMarketPrice') is not None:
            price = float(info.get('regularMarketPrice'))

        quote = {
            'symbol': symbol.upper(),
            'companyName': info.get('shortName') or info.get('longName') or symbol.upper(),
            'price': price,
            'currency': info.get('currency') or 'USD',
            'change': None if price is None or previous_close in (None, 0) else round(float(price - previous_close), 2),
            'changePercent': None if price is None or previous_close in (None, 0) else round(((price - previous_close) / previous_close) * 100, 2),
            'previousClose': previous_close,
            'open': open_price,
            'dayHigh': day_high,
            'dayLow': day_low,
            'volume': volume,
            'marketCap': market_cap,
            'fiftyTwoWeekHigh': float(info.get('fiftyTwoWeekHigh')) if info.get('fiftyTwoWeekHigh') is not None else None,
            'fiftyTwoWeekLow': float(info.get('fiftyTwoWeekLow')) if info.get('fiftyTwoWeekLow') is not None else None,
            'marketStatus': self.get_market_status()['status'],
            'dataStatus': 'Live' if price is not None else 'Unavailable',
            'source': 'Yahoo Finance-compatible provider',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

        return quote

    def get_history(self, symbol: str, period: str = '1M') -> list[dict[str, Any]]:
        period_map = {
            '1D': '1d',
            '5D': '5d',
            '1M': '1mo',
            '6M': '6mo',
            '1Y': '1y',
            '5Y': '5y',
            'MAX': 'max',
        }

        interval_map = {
            '1D': '1m',
            '5D': '30m',
            '1M': '1d',
            '6M': '1d',
            '1Y': '1d',
            '5Y': '1wk',
            'MAX': '1mo',
        }

        yahoo_period = period_map.get(period, '1mo')
        interval = interval_map.get(period, '1d')
        data = yf.Ticker(symbol).history(period=yahoo_period, interval=interval)

        if data.empty:
            return []

        series = []
        for timestamp, row in data.iterrows():
            series.append({
                'date': timestamp.strftime('%Y-%m-%dT%H:%M:%S'),
                'close': round(float(row['Close']), 2),
                'volume': int(row.get('Volume', 0) or 0),
            })
        return series

    def get_market_status(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        status = 'Closed'
        if 9 <= now.hour <= 16:
            status = 'Market Open'
        return {
            'status': status,
            'source': 'Yahoo Finance-compatible provider',
            'timestamp': now.isoformat(),
        }

    def get_quotes(self, symbols: list[str]) -> list[dict[str, Any]]:
        quotes: list[dict[str, Any]] = []
        for symbol in symbols:
            if not symbol:
                continue
            try:
                quotes.append(self.get_quote(symbol))
            except Exception:
                quotes.append({
                    'symbol': symbol.upper(),
                    'companyName': symbol.upper(),
                    'price': None,
                    'currency': 'USD',
                    'change': None,
                    'changePercent': None,
                    'previousClose': None,
                    'open': None,
                    'dayHigh': None,
                    'dayLow': None,
                    'volume': None,
                    'marketCap': None,
                    'fiftyTwoWeekHigh': None,
                    'fiftyTwoWeekLow': None,
                    'marketStatus': 'Unavailable',
                    'dataStatus': 'Unavailable',
                    'source': 'Yahoo Finance-compatible provider',
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                })
        return quotes
