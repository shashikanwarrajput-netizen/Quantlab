from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class MarketDataProvider(ABC):
    @abstractmethod
    def get_quote(self, symbol: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_history(self, symbol: str, period: str = '1M') -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def get_market_status(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_quotes(self, symbols: list[str]) -> list[dict[str, Any]]:
        raise NotImplementedError
