from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from backend.models.market import RunAlgorithmRequest, AIChatRequest

from backend.services.ai_service import get_ai_assistant_response
from backend.services.indian_api_service import IndianAPIError, IndianAPIService
from backend.services.quant_engine import run_quantitative_algorithm

router = APIRouter(prefix='/api/market')
service = IndianAPIService()


@router.get('/config')
def get_market_configuration() -> dict[str, object]:
    return service.configuration_status()


@router.get('/history')
def get_market_history(
    symbol: str = Query(..., min_length=1),
    period: str = Query('1yr'),
    data_filter: str = Query('default', alias='filter'),
) -> dict[str, object]:
    try:
        return service.get_historical_data(symbol, period, data_filter)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc


@router.get('/quote')
def get_market_quote(symbol: str = Query(..., min_length=1)) -> dict[str, object]:
    try:
        return {'quote': service.get_stock_quote(symbol)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc


@router.get('/quotes')
def get_market_quotes(symbols: str = Query(...)) -> dict[str, object]:
    symbol_list = [item.strip() for item in symbols.split(',') if item.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail='At least one symbol is required.')

    try:
        quotes = service.get_nse_batch_quotes(symbol_list[:10])
        return {'quotes': quotes}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc


@router.get('/intraday')
def get_market_intraday(symbol: str = Query(..., min_length=1)) -> dict[str, object]:
    try:
        return service.get_intraday_data(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc


@router.get('/overview')
def get_market_overview() -> dict[str, object]:
    try:
        return service.get_market_overview()
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc


@router.get('/status')
def get_market_status() -> dict[str, object]:
    return {'marketStatus': {'status': 'DELAYED DATA', 'source': 'IndianAPI'}}


def _provider_http_error(error: IndianAPIError) -> HTTPException:
    if error.status_code == 429:
        return HTTPException(status_code=429, detail='API request limit reached.')
    if error.status_code == 401:
        return HTTPException(status_code=401, detail=str(error))
    if error.status_code == 403:
        return HTTPException(status_code=403, detail=str(error))
    if 'Invalid or unsupported' in str(error):
        return HTTPException(status_code=404, detail='Invalid or unsupported stock symbol.')
    if 'not configured' in str(error):
        return HTTPException(status_code=503, detail='Market data service is not configured.')
    return HTTPException(status_code=502, detail=str(error))


class RouteRunAlgorithmRequest(BaseModel):
    symbol: str
    period: str = '1yr'
    algorithm: str
    initial_capital: float = 100000.0
    params: dict[str, Any] = Field(default_factory=dict)


class RouteAIChatRequest(BaseModel):
    message: str
    symbol: str = 'RELIANCE'
    latest_analytics: Optional[dict[str, Any]] = None
    api_key: Optional[str] = None
    provider: Optional[str] = None
    history: Optional[list[dict[str, str]]] = None


@router.post('/run-algorithm')
def run_algorithm_route(req: RunAlgorithmRequest) -> dict[str, Any]:
    clean_symbol = req.symbol.split(':')[0].strip().upper()
    if not clean_symbol:
        raise HTTPException(status_code=400, detail='Stock symbol is required.')

    period = req.period.strip()
    if period == '1y':
        period = '1yr'

    try:
        raw_history = service._request(
            'historical_data',
            params={'stock_name': clean_symbol, 'period': period, 'filter': 'price'},
            ttl=300,
        )
    except IndianAPIError as exc:
        raise _provider_http_error(exc) from exc

    try:
        return run_quantitative_algorithm(
            symbol=clean_symbol,
            period=period,
            algorithm=req.algorithm,
            initial_capital=req.initial_capital,
            params=req.params,
            raw_history=raw_history,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to execute algorithm: {str(exc)}') from exc


@router.post('/ai-chat')
async def ai_chat_route(req: AIChatRequest) -> dict[str, Any]:
    clean_symbol = req.symbol.split(':')[0].strip().upper() or 'RELIANCE'

    raw_quote = None
    try:
        raw_quote = service._request('get_stock_data', params={'stock_name': clean_symbol}, ttl=60)
    except Exception:
        pass

    raw_history = None
    try:
        raw_history = service._request(
            'historical_data',
            params={'stock_name': clean_symbol, 'period': '6m', 'filter': 'price'},
            ttl=300,
        )
    except Exception:
        try:
            raw_history = service._request(
                'historical_data',
                params={'stock_name': clean_symbol, 'period': '1yr', 'filter': 'price'},
                ttl=300,
            )
        except Exception:
            raw_history = {}

    try:
        return await get_ai_assistant_response(
            message=req.message,
            symbol=clean_symbol,
            raw_history=raw_history,
            raw_quote=raw_quote,
            latest_analytics=req.latest_analytics,
            client_api_key=req.api_key,
            client_provider=req.provider,
            chat_history=req.history,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'AI chat error: {str(exc)}') from exc

