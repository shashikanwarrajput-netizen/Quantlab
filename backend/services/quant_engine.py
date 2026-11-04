import math
import time
from datetime import datetime, timezone
from typing import Any, Optional


def parse_price_series(raw_history: Any) -> list[tuple[str, float]]:
    """Extract chronological (date, close) series from IndianAPI or standard payload."""
    if not isinstance(raw_history, dict):
        return []

    price_values: list[Any] = []
    datasets = raw_history.get("datasets", [])
    if isinstance(datasets, list):
        for ds in datasets:
            if isinstance(ds, dict) and str(ds.get("metric", "")).lower() == "price":
                price_values = ds.get("values", [])
                break

    # Also support already pivoted or alternative data format: {"data": [{"datetime": "...", "close": ...}]}
    if not price_values and isinstance(raw_history.get("data"), list):
        series = []
        for pt in raw_history["data"]:
            if isinstance(pt, dict) and pt.get("datetime") and pt.get("close") is not None:
                try:
                    series.append((str(pt["datetime"]), float(pt["close"])))
                except (ValueError, TypeError):
                    continue
        series.sort(key=lambda x: x[0])
        return series

    series: list[tuple[str, float]] = []
    for item in price_values:
        if isinstance(item, (list, tuple)) and len(item) >= 2 and item[0] is not None and item[1] is not None:
            date_str = str(item[0]).strip()
            try:
                price_val = float(str(item[1]).replace(",", "").strip())
                series.append((date_str, price_val))
            except (ValueError, TypeError):
                continue

    # Ensure chronological order
    series.sort(key=lambda x: x[0])
    return series


def calculate_sma(prices: list[float], window: int) -> list[Optional[float]]:
    """Compute Simple Moving Average for a series of prices."""
    smas: list[Optional[float]] = []
    for i in range(len(prices)):
        if i + 1 < window:
            smas.append(None)
        else:
            window_slice = prices[i + 1 - window : i + 1]
            smas.append(sum(window_slice) / window)
    return smas


def calculate_ema(prices: list[float], span: int) -> list[float]:
    """Compute Exponential Moving Average."""
    if not prices:
        return []
    alpha = 2.0 / (span + 1.0)
    ema_vals = [prices[0]]
    for p in prices[1:]:
        ema_vals.append(p * alpha + ema_vals[-1] * (1.0 - alpha))
    return ema_vals


def calculate_rsi_series(prices: list[float], window: int = 14) -> list[float]:
    """Compute Wilder's RSI series."""
    n = len(prices)
    if n == 0:
        return []
    if n < window + 1:
        return [50.0] * n

    rsi_values: list[float] = [50.0] * n
    gains: list[float] = [0.0]
    losses: list[float] = [0.0]

    for i in range(1, n):
        diff = prices[i] - prices[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    avg_gain = sum(gains[1 : window + 1]) / window
    avg_loss = sum(losses[1 : window + 1]) / window

    if avg_loss == 0:
        rsi_values[window] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi_values[window] = 100.0 - (100.0 / (1.0 + rs))

    for i in range(window + 1, n):
        avg_gain = (avg_gain * (window - 1) + gains[i]) / window
        avg_loss = (avg_loss * (window - 1) + losses[i]) / window
        if avg_loss == 0:
            rsi_values[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_values[i] = 100.0 - (100.0 / (1.0 + rs))

    return rsi_values


def generate_algorithm_signals(
    algorithm: str,
    prices: list[float],
    params: dict[str, Any],
) -> list[int]:
    """
    Generate trade holding signals (1 = hold asset, 0 = cash) for each day.
    5 Established Algorithms:
      1. sma_crossover: Golden/Death Cross (short_window=20, long_window=50)
      2. rsi_reversion: RSI Mean Reversion (rsi_window=14, oversold=30, overbought=70)
      3. bollinger_breakout: Bollinger Bands Reversion (window=20, num_std=2.0)
      4. macd_momentum: MACD (12, 26, 9)
      5. buy_and_hold: Benchmark baseline
    """
    n = len(prices)
    algo_key = (algorithm or "").strip().lower()

    if algo_key in ("buy_and_hold", "benchmark", "buy-and-hold"):
        return [1] * n

    if algo_key in ("sma_crossover", "sma", "moving_average_crossover"):
        short_w = int(params.get("short_window", 20))
        long_w = int(params.get("long_window", 50))
        if short_w > long_w:
            short_w, long_w = long_w, short_w
        short_sma = calculate_sma(prices, short_w)
        long_sma = calculate_sma(prices, long_w)

        signals: list[int] = []
        for i in range(n):
            if short_sma[i] is None or long_sma[i] is None:
                signals.append(0)
            else:
                signals.append(1 if short_sma[i] > long_sma[i] else 0)
        return signals

    if algo_key in ("rsi_reversion", "rsi", "rsi_mean_reversion"):
        rsi_window = int(params.get("rsi_window", 14))
        oversold = float(params.get("oversold", 30))
        overbought = float(params.get("overbought", 70))
        rsi_vals = calculate_rsi_series(prices, rsi_window)

        signals: list[int] = []
        position = 0
        for i in range(n):
            # Dip below oversold triggers buy entry
            if rsi_vals[i] <= oversold:
                position = 1
            # Rise above overbought triggers exit
            elif rsi_vals[i] >= overbought:
                position = 0
            signals.append(position)
        return signals

    if algo_key in ("bollinger_breakout", "bollinger", "bollinger_bands"):
        window = int(params.get("window", 20))
        num_std = float(params.get("num_std", 2.0))

        signals: list[int] = []
        position = 0
        for i in range(n):
            if i + 1 < window:
                signals.append(0)
                continue
            slice_p = prices[i + 1 - window : i + 1]
            mean_p = sum(slice_p) / window
            std_p = math.sqrt(sum((x - mean_p) ** 2 for x in slice_p) / window)
            lower_band = mean_p - num_std * std_p
            upper_band = mean_p + num_std * std_p

            if prices[i] <= lower_band:
                position = 1  # Dip below lower band triggers buy
            elif prices[i] >= upper_band:
                position = 0  # Above upper band triggers exit

            signals.append(position)
        return signals

    if algo_key in ("macd_momentum", "macd"):
        fast_period = int(params.get("fast_period", 12))
        slow_period = int(params.get("slow_period", 26))
        signal_period = int(params.get("signal_period", 9))

        fast_ema = calculate_ema(prices, fast_period)
        slow_ema = calculate_ema(prices, slow_period)
        macd_line = [f - s for f, s in zip(fast_ema, slow_ema)]
        signal_line = calculate_ema(macd_line, signal_period)

        signals: list[int] = []
        for i in range(n):
            if i < slow_period:
                signals.append(0)
            else:
                signals.append(1 if macd_line[i] > signal_line[i] else 0)
        return signals

    # Default fallback: buy and hold
    return [1] * n


def run_quantitative_algorithm(
    symbol: str,
    period: str,
    algorithm: str,
    initial_capital: float,
    params: dict[str, Any],
    raw_history: Any,
) -> dict[str, Any]:
    """Execute complete backtesting simulation with risk metrics and daily equity curves."""
    series = parse_price_series(raw_history)
    if len(series) < 2:
        raise ValueError(f"Insufficient historical data for symbol '{symbol}'. Found {len(series)} points.")

    dates = [pt[0] for pt in series]
    prices = [pt[1] for pt in series]
    n = len(prices)

    signals = generate_algorithm_signals(algorithm, prices, params)

    # Portfolio Simulation
    strategy_equity: list[float] = [initial_capital]
    benchmark_equity: list[float] = [initial_capital]
    drawdowns: list[float] = [0.0]
    peak_equity = initial_capital

    for i in range(1, n):
        prev_p = prices[i - 1]
        curr_p = prices[i]
        daily_ret = (curr_p - prev_p) / prev_p if prev_p > 0 else 0.0

        # Holding signal active entering day i (signal at close of day i-1)
        # If day 0 signal is 1, holding for day 1
        pos = signals[i - 1]
        new_strat_equity = strategy_equity[-1] * (1.0 + daily_ret * pos)
        new_bench_equity = benchmark_equity[-1] * (1.0 + daily_ret)

        strategy_equity.append(new_strat_equity)
        benchmark_equity.append(new_bench_equity)

        if new_strat_equity > peak_equity:
            peak_equity = new_strat_equity
        dd = ((peak_equity - new_strat_equity) / peak_equity * 100.0) if peak_equity > 0 else 0.0
        drawdowns.append(dd)

    # Trade Execution Counting & Win Rate
    trades: list[float] = []
    in_position = False
    entry_price = 0.0

    for i in range(n):
        sig = signals[i]
        if sig == 1 and not in_position:
            in_position = True
            entry_price = prices[i]
        elif sig == 0 and in_position:
            in_position = False
            exit_price = prices[i]
            ret = (exit_price - entry_price) / entry_price if entry_price > 0 else 0.0
            trades.append(ret)

    # Close open trade at final price
    if in_position and entry_price > 0:
        ret = (prices[-1] - entry_price) / entry_price
        trades.append(ret)

    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t > 0)
    win_rate_pct = (winning_trades / total_trades * 100.0) if total_trades > 0 else 0.0

    final_strat_equity = strategy_equity[-1]
    final_bench_equity = benchmark_equity[-1]

    total_return_pct = ((final_strat_equity - initial_capital) / initial_capital) * 100.0
    benchmark_return_pct = ((final_bench_equity - initial_capital) / initial_capital) * 100.0
    max_drawdown_pct = max(drawdowns) if drawdowns else 0.0

    # Compound Annual Growth Rate (CAGR %)
    try:
        d0 = datetime.fromisoformat(dates[0].split(" ")[0])
        d1 = datetime.fromisoformat(dates[-1].split(" ")[0])
        span_years = max((d1 - d0).days / 365.25, 0.05)
    except Exception:
        span_years = max(n / 252.0, 0.05)

    if final_strat_equity > 0:
        cagr_pct = ((final_strat_equity / initial_capital) ** (1.0 / span_years) - 1.0) * 100.0
    else:
        cagr_pct = -100.0

    # Sharpe Ratio: 6% risk-free rate, 252 trading days
    rf_daily = 0.06 / 252.0
    daily_strat_returns: list[float] = []
    for i in range(1, len(strategy_equity)):
        prev_eq = strategy_equity[i - 1]
        curr_eq = strategy_equity[i]
        daily_strat_returns.append((curr_eq - prev_eq) / prev_eq if prev_eq > 0 else 0.0)

    if len(daily_strat_returns) > 1:
        excess_returns = [r - rf_daily for r in daily_strat_returns]
        mean_excess = sum(excess_returns) / len(excess_returns)
        var_excess = sum((r - mean_excess) ** 2 for r in excess_returns) / (len(excess_returns) - 1)
        std_excess = math.sqrt(var_excess)
        sharpe_ratio: Optional[float] = (
            round((mean_excess / std_excess) * math.sqrt(252.0), 2) if std_excess > 1e-9 else 0.0
        )
    else:
        sharpe_ratio = 0.0

    equity_curve: list[dict[str, Any]] = []
    for i in range(n):
        equity_curve.append(
            {
                "date": dates[i],
                "close": round(prices[i], 2),
                "strategyEquity": round(strategy_equity[i], 2),
                "benchmarkEquity": round(benchmark_equity[i], 2),
                "drawdown": round(drawdowns[i], 2),
                "signal": signals[i],
            }
        )

    metrics = {
        "initialCapital": round(initial_capital, 2),
        "finalEquity": round(final_strat_equity, 2),
        "totalReturnPct": round(total_return_pct, 2),
        "benchmarkReturnPct": round(benchmark_return_pct, 2),
        "cagrPct": round(cagr_pct, 2),
        "sharpeRatio": sharpe_ratio,
        "maxDrawdownPct": round(max_drawdown_pct, 2),
        "totalTrades": total_trades,
        "winRatePct": round(win_rate_pct, 2),
    }

    return {
        "id": f"run_{int(time.time() * 1000)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "symbol": symbol.upper(),
        "algorithm": algorithm,
        "period": period,
        "initialCapital": initial_capital,
        "params": params,
        "metrics": metrics,
        "equityCurve": equity_curve,
    }


def compute_live_technical_summary(
    symbol: str,
    raw_history: Any,
    raw_quote: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Compute live 14-day RSI, 20-DMA, 50-DMA, and Market Regime."""
    series = parse_price_series(raw_history)
    prices = [pt[1] for pt in series]

    # Live quote price resolution
    quote_price: Optional[float] = None
    change_pct: Optional[float] = None
    if isinstance(raw_quote, dict):
        sdr = raw_quote.get("stockDetailsReusableData") or {}
        cp = raw_quote.get("currentPrice") or {}
        candidates = (
            raw_quote.get("price"),
            raw_quote.get("current_price"),
            raw_quote.get("last_price"),
            raw_quote.get("close"),
            sdr.get("price") if isinstance(sdr, dict) else None,
            cp.get("NSE") if isinstance(cp, dict) else None,
            cp.get("BSE") if isinstance(cp, dict) else None,
        )
        for candidate in candidates:
            if candidate not in (None, "", "-"):
                try:
                    quote_price = float(str(candidate).replace(",", ""))
                    break
                except (ValueError, TypeError):
                    pass

        pct_candidates = (
            raw_quote.get("change_percent"),
            raw_quote.get("change_pct"),
            raw_quote.get("percentChange"),
            raw_quote.get("pChange"),
            sdr.get("percentChange") if isinstance(sdr, dict) else None,
        )
        for pct_cand in pct_candidates:
            if pct_cand not in (None, "", "-"):
                try:
                    change_pct = float(str(pct_cand).replace("%", "").strip())
                    break
                except (ValueError, TypeError):
                    pass

    if quote_price is None and prices:
        quote_price = prices[-1]

    if change_pct is None and len(prices) >= 2 and prices[-2] > 0:
        change_pct = ((prices[-1] - prices[-2]) / prices[-2]) * 100.0

    # Moving averages
    eval_prices = list(prices)
    if quote_price is not None and (not eval_prices or eval_prices[-1] != quote_price):
        eval_prices.append(quote_price)

    sma_20 = None
    if len(eval_prices) >= 20:
        sma_20 = round(sum(eval_prices[-20:]) / 20.0, 2)
    elif eval_prices:
        sma_20 = round(sum(eval_prices) / len(eval_prices), 2)

    sma_50 = None
    if len(eval_prices) >= 50:
        sma_50 = round(sum(eval_prices[-50:]) / 50.0, 2)
    elif eval_prices:
        sma_50 = round(sum(eval_prices) / len(eval_prices), 2)

    rsi_14 = 50.0
    if len(eval_prices) >= 15:
        rsi_series = calculate_rsi_series(eval_prices, 14)
        rsi_14 = round(rsi_series[-1], 2)

    # Determine Regime
    regime = "Neutral / Consolidating"
    cur = quote_price or (eval_prices[-1] if eval_prices else 0.0)

    if sma_20 is not None and sma_50 is not None:
        if cur > sma_20 and sma_20 > sma_50:
            regime = "Strong Bullish Trend"
        elif cur < sma_20 and sma_20 < sma_50:
            regime = "Strong Bearish Trend"
        elif cur > sma_20 and cur > sma_50 and sma_20 <= sma_50:
            regime = "Bullish Reversal / Accumulation"
        elif cur < sma_20 and cur < sma_50 and sma_20 >= sma_50:
            regime = "Bearish Breakdown"
        elif cur > sma_50 and cur < sma_20:
            regime = "Bullish Pullback / Mean Reversion Opportunity"
        elif cur < sma_50 and cur > sma_20:
            regime = "Relief Rally into Resistance"

    return {
        "symbol": symbol.upper(),
        "current_price": round(cur, 2),
        "change_pct": round(change_pct, 2) if change_pct is not None else 0.0,
        "rsi_14": rsi_14,
        "sma_20": sma_20 or round(cur, 2),
        "sma_50": sma_50 or round(cur, 2),
        "regime": regime,
    }


def generate_ai_chat_response(
    message: str,
    symbol: str,
    raw_history: Any,
    raw_quote: Optional[dict[str, Any]] = None,
    latest_analytics: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate structured, context-aware quantitative analyst markdown response."""
    tech = compute_live_technical_summary(symbol, raw_history, raw_quote)
    user_msg_lower = (message or "").lower()

    # Determine recommended algorithm based on technical regime & RSI
    rec_algo = "sma_crossover"
    rec_reason = ""
    rsi_val = tech["rsi_14"]
    regime = tech["regime"]
    cur_p = tech["current_price"]
    s20 = tech["sma_20"]
    s50 = tech["sma_50"]

    if rsi_val <= 32:
        rec_algo = "rsi_reversion"
        rec_reason = f"RSI is oversold at {rsi_val:.1f}, indicating strong mean-reversion bounce probabilities."
    elif rsi_val >= 68:
        rec_algo = "bollinger_breakout"
        rec_reason = f"RSI is stretched at {rsi_val:.1f}; volatility bands will capture exhaustion and safe exit points."
    elif "Bullish" in regime:
        rec_algo = "sma_crossover" if cur_p > s20 else "macd_momentum"
        rec_reason = f"Market is in a {regime} with Price ₹{cur_p:.2f} relative to 20-DMA (₹{s20:.2f}) and 50-DMA (₹{s50:.2f})."
    elif "Bearish" in regime:
        rec_algo = "rsi_reversion"
        rec_reason = f"In a {regime}, waiting for oversold flushes via RSI Mean Reversion avoids getting caught holding trends."
    else:
        rec_algo = "bollinger_breakout"
        rec_reason = "Range-bound / consolidating structure favors Bollinger Band mean-reversion trading around statistical standard deviations."

    # Backtest evaluation section
    analytics_section = ""
    if isinstance(latest_analytics, dict) and latest_analytics.get("metrics"):
        m = latest_analytics["metrics"]
        algo_used = latest_analytics.get("algorithm", "Strategy")
        tot_ret = m.get("totalReturnPct", 0.0)
        bench_ret = m.get("benchmarkReturnPct", 0.0)
        sharpe = m.get("sharpeRatio")
        mdd = m.get("maxDrawdownPct", 0.0)
        win_rate = m.get("winRatePct", 0.0)
        trades = m.get("totalTrades", 0)

        outperformance = tot_ret - bench_ret
        outperf_str = f"+{outperformance:.2f}%" if outperformance >= 0 else f"{outperformance:.2f}%"
        sharpe_str = f"{sharpe:.2f}" if sharpe is not None else "N/A"

        sharpe_comment = (
            "Outstanding risk-adjusted efficiency (Sharpe > 1.5)"
            if sharpe and sharpe > 1.5
            else "Healthy risk-adjusted profile (Sharpe > 1.0)"
            if sharpe and sharpe > 1.0
            else "Moderate risk-adjusted efficiency; consider tightening stops"
        )

        analytics_section = f"""
### [Performance] Backtest Evaluation ({algo_used.upper()} on {latest_analytics.get('symbol', symbol)})
- **Strategy Return vs Benchmark**: **{tot_ret:+.2f}%** vs **{bench_ret:+.2f}%** ({outperf_str} alpha)
- **Sharpe Ratio (Risk-free 6%)**: **{sharpe_str}** -- *{sharpe_comment}*
- **Max Drawdown**: **{mdd:.2f}%** | **Win Rate**: **{win_rate:.1f}%** ({trades} total trades)
- **Risk Assessment**: {"Strategy demonstrated solid downside capital preservation with a low drawdown." if mdd < 15 else "Drawdown was elevated; incorporating dynamic stop-loss or ATR-based positioning is advised."}
"""

    # Custom answers for frequent prompt intents
    specific_answer = ""
    if "risk" in user_msg_lower or "drawdown" in user_msg_lower:
        specific_answer = f"""
### [Risk & Capital Preservation]
- **Current Technical Volatility**: With 20-DMA at Rs {s20:.2f} and 50-DMA at Rs {s50:.2f}, immediate support lies around Rs {min(s20, s50):.2f}.
- **Suggested Position Sizing**: Keep individual position exposure capped at 2-3% risk of total capital per trade.
- **Stop Loss Guidance**: A protective stop under the 50-DMA (Rs {s50:.2f}) limits tail risk in case the regime shifts.
"""
    elif "rsi" in user_msg_lower:
        zone = "Oversold (<30)" if rsi_val <= 30 else "Overbought (>70)" if rsi_val >= 70 else "Neutral Zone (30-70)"
        specific_answer = f"""
### [RSI Indicator Breakdown for {symbol}]
- **Current 14-day RSI**: **{rsi_val:.1f}** ({zone})
- **Historical Behavior**: Assets in this RSI zone typically exhibit {"sharp mean-reversion bounces once buying volume confirms" if rsi_val <= 35 else "continued momentum if moving averages remain aligned" if rsi_val >= 60 else "sideways consolidation with low directional conviction"}.
- **Recommended Trigger**: Wait for RSI to cross back above 30 from below before committing long capital.
"""
    elif "compare" in user_msg_lower or "benchmark" in user_msg_lower:
        specific_answer = f"""
### [Strategy vs Benchmark Comparison]
- Quantitative active strategies aim to capture market upside while stepping aside into cash during severe downturns to reduce drawdowns.
- Unlike Buy & Hold which takes 100% of market drawdowns, algorithmic rules like **{rec_algo.upper()}** systematically protect capital when indicators roll over.
"""

    markdown_response = f"""## QuantLab AI Analyst: {symbol} Market Report

### [Technical Regime & Key Indicators]
- **Current Price**: **Rs {cur_p:.2f}** ({tech['change_pct']:+.2f}%)
- **Market Regime**: **{regime}**
- **14-Day RSI**: **{rsi_val:.1f}** ({'Oversold' if rsi_val <= 30 else 'Overbought' if rsi_val >= 70 else 'Neutral'})
- **Key Averages**: 20-DMA at **Rs {s20:.2f}** | 50-DMA at **Rs {s50:.2f}**
{analytics_section}
{specific_answer}
### [Quantitative Algorithm Recommendation]
- **Recommended Algorithm**: **`{rec_algo.upper()}`**
- **Rationale**: {rec_reason}
- **Execution Plan**: Test this strategy in the **Strategy Builder** or **Backtesting** tab with default parameters to verify historical expectancy before deploying live capital.
""".strip()

    return {
        "response": markdown_response,
        "technical_summary": tech,
    }
