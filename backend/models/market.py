from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class MarketStatus(BaseModel):
    status: str = Field(..., description="Market connection status (LIVE DATA, DEMO DATA, DELAYED DATA)")
    source: str = Field("IndianAPI", description="Data provider source name")


class MarketStatusResponse(BaseModel):
    marketStatus: MarketStatus


class MarketConfigResponse(BaseModel):
    provider: str
    configured: bool
    baseUrl: str


class StockDetailsReusableData(BaseModel):
    price: Optional[str] = None
    close: Optional[str] = None
    percentChange: Optional[str] = None
    netChange: Optional[str] = None
    high: Optional[str] = None
    low: Optional[str] = None
    open: Optional[str] = None
    volume: Optional[str] = None
    marketCap: Optional[str] = None
    yhigh: Optional[str] = None
    ylow: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None


class StockQuote(BaseModel):
    companyName: Optional[str] = None
    industry: Optional[str] = None
    stockDetailsReusableData: Optional[StockDetailsReusableData] = None
    currentPrice: Optional[dict[str, str]] = None


class QuoteResponse(BaseModel):
    quote: Optional[Any] = None


class BatchQuotesResponse(BaseModel):
    quotes: dict[str, Any] = Field(default_factory=dict)


class HistoricalDataResponse(BaseModel):
    datasets: Optional[list[dict[str, Any]]] = None
    data: Optional[list[dict[str, Any]]] = None


class MarketOverviewResponse(BaseModel):
    trending: Optional[dict[str, Any]] = None
    nse_active: Optional[list[dict[str, Any]]] = None
    bse_active: Optional[list[dict[str, Any]]] = None
    fifty_two_week: Optional[dict[str, Any]] = None


class RunAlgorithmRequest(BaseModel):
    symbol: str = Field(..., description="Stock ticker symbol, e.g. RELIANCE, TCS")
    period: str = Field("1yr", description="Timeframe: 1m, 6m, 1yr, 3yr, 5yr, max")
    algorithm: str = Field("sma_crossover", description="Algorithm identifier (sma_crossover, rsi_strategy, momentum, buy_and_hold)")
    initial_capital: float = Field(100000.0, description="Initial backtesting capital")
    params: dict[str, Any] = Field(default_factory=dict, description="Custom parameters like fast_window, slow_window, rsi_period")


class AlgorithmMetrics(BaseModel):
    total_return_pct: float
    cagr_pct: float
    annualized_volatility_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    profit_factor: float
    total_trades: int


class RunAlgorithmResponse(BaseModel):
    symbol: str
    period: str
    algorithm: str
    metrics: dict[str, Any]
    equity_curve: list[dict[str, Any]]
    drawdown_curve: list[dict[str, Any]]
    trade_journal: list[dict[str, Any]]
    signals: list[dict[str, Any]]


class AIChatRequest(BaseModel):
    message: str = Field(..., description="User query or message")
    symbol: str = Field("RELIANCE", description="Focused stock symbol")
    latest_analytics: Optional[dict[str, Any]] = None
    api_key: Optional[str] = None
    provider: Optional[str] = None
    history: Optional[list[dict[str, str]]] = None


class AIChatResponse(BaseModel):
    response: str
    provider: str
    timestamp: str
    sources: Optional[list[str]] = None
