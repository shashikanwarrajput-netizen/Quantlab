"""
Modular Offline Knowledge & Intent-Aware AI Engine for QuantLab.
Provides accurate, context-aware, distinct responses when no external LLM is configured.
"""

from __future__ import annotations

import re
from typing import Any, Optional


def evaluate_math_expression(query: str) -> Optional[str]:
    """Safely detect and evaluate basic mathematical expressions or percentages."""
    q = query.lower().strip()

    # Pattern: "Calculate 15% of 20,000" or "What is 15% of 20000" or "15% of 20,000"
    pct_match = re.search(r'(?:calculate|what is)?\s*([\d.]+)\s*%\s*of\s*([\d,.]+)', q)
    if pct_match:
        try:
            pct = float(pct_match.group(1))
            val_str = pct_match.group(2).replace(',', '')
            val = float(val_str)
            res = (pct / 100.0) * val
            # Format nicely
            res_str = f"{res:,.2f}".rstrip('0').rstrip('.')
            val_fmt = f"{val:,.2f}".rstrip('0').rstrip('.')
            return (
                "### Mathematical Calculation\n\n"
                f"$$\\frac{{{pct}}}{{100}} \\times {val_fmt} = \\mathbf{{{res_str}}}$$\n\n"
                f"**Result**: **{res_str}**\n\n"
                "*Step-by-step breakdown:*\n"
                f"1. Convert percentage to decimal: {pct} / 100 = {pct/100:.4f}\n"
                f"2. Multiply by base number: {pct/100:.4f} * {val_fmt} = {res_str}"
            )
        except Exception:
            pass

    # Pattern: Simple arithmetic expressions like "calculate 25 * 40", "what is 500 / 20"
    calc_match = re.search(r'(?:calculate|what is|solve)\s*([\d\s\+\-\*\/\.\(\)\^]+)', q)
    if calc_match:
        expr = calc_match.group(1).strip()
        # Ensure only safe mathematical characters
        if re.match(r'^[\d\s\+\-\*\/\.\(\)]+$', expr) and any(op in expr for op in ['+', '-', '*', '/']):
            try:
                # Safe evaluation of basic arithmetic
                result = eval(expr, {"__builtins__": {}}, {})
                res_formatted = f"{float(result):,.4f}".rstrip('0').rstrip('.')
                return (
                    "### Mathematical Calculation\n\n"
                    f"**Expression**: `{expr}`\n\n"
                    f"**Result**: **{res_formatted}**"
                )
            except Exception:
                pass

    return None


def resolve_conversation_followup(
    query: str,
    chat_history: Optional[list[dict[str, str]]],
    symbol: str,
) -> Optional[str]:
    """Inspect recent conversation history to provide intelligent follow-up answers."""
    if not chat_history or len(chat_history) < 1:
        return None

    q = query.lower().strip()
    last_assistant_msg = ""
    last_user_msg = ""

    for msg in reversed(chat_history):
        role = msg.get("role", "")
        content = msg.get("content", "").lower()
        if role == "assistant" and not last_assistant_msg:
            last_assistant_msg = content
        elif role == "user" and not last_user_msg:
            last_user_msg = content
        if last_assistant_msg and last_user_msg:
            break

    combined_context = f"{last_user_msg} {last_assistant_msg}"

    # Follow-up: "What happens if I change the threshold to 20?" (referring to RSI)
    if re.search(r'threshold.*20|change.*(threshold|parameter|level).*20', q):
        if "rsi" in combined_context or "oversold" in combined_context:
            return f"""### Follow-Up Analysis: Lowering RSI Oversold Threshold to 20

Lowering the RSI buy threshold from standard **30** to **20** has significant strategic implications for mean-reversion trading:

1. **Higher Selectivity**: A level below 20 represents an extreme capitulation sell-off. The strategy will only buy when market selling is extraordinarily intense.
2. **Reduced Trade Frequency**: Because an RSI $< 20$ occurs much less frequently than $< 30$, your strategy will execute substantially fewer trades over a year.
3. **Higher Profit Expectancy per Trade**: Dips below 20 frequently produce sharper, high-probability rebound bounces once buyers step in.
4. **Risk of Cash Drag**: In sustained trending markets, mild pullbacks that bottom at RSI 25–28 will be missed completely, leaving your capital in cash while the asset moves higher.

*Recommendation*: In QuantLab, test this directly on **{symbol}** by selecting **RSI Mean Reversion** in the **Strategy Builder**, modifying the `Oversold Threshold` from 30 to 20, and comparing the resulting Sharpe ratio and total return."""

    # Follow-up: "How can I test that in QuantLab?"
    if re.search(r'how (can|do) i test (that|this) in quantlab', q):
        return f"""### Testing Strategies in QuantLab

You can test any parameter modification or algorithmic rule directly in the platform:

1. **Open Strategy Builder**: Click **Strategy Builder** in the navigation bar.
2. **Select the Algorithm**: Choose between **SMA Crossover**, **RSI Mean Reversion**, **Bollinger Bands**, **MACD Momentum**, or **Buy & Hold**.
3. **Configure Parameters**:
   - Ticker: Select **{symbol}** or another NSE asset.
   - Lookback Period: Choose `6m`, `1yr`, or `3yr`.
   - Dynamic Parameters: Adjust windows or thresholds (e.g. SMA Fast/Slow windows, RSI levels).
4. **Execute Simulation**: Click **"Execute Strategy"** to generate the dual equity curve, drawdown analysis, and Sharpe ratio.
5. **Inspect Saved Analytics**: All runs are automatically saved to your history table at the bottom of the page for instant comparison."""

    return None


def handle_why_underperformed(
    latest_analytics: Optional[dict[str, Any]],
    symbol: str,
) -> str:
    """Explain why a strategy underperformed the benchmark, grounded in real metrics when available."""
    if latest_analytics and latest_analytics.get("metrics"):
        m = latest_analytics["metrics"]
        strat_ret = m.get("totalReturnPct", 0.0)
        bench_ret = m.get("benchmarkReturnPct", 0.0)
        algo = latest_analytics.get("algorithm", "Strategy").upper().replace("_", " ")
        trades = m.get("totalTrades", 0)
        win_rate = m.get("winRatePct", 0.0)
        mdd = m.get("maxDrawdownPct", 0.0)
        sharpe = m.get("sharpeRatio")

        underperf = bench_ret - strat_ret
        return f"""### Diagnostic: Why Your {algo} Underperformed the Benchmark on {symbol}

Based on your actual backtest metrics (**Strategy: {strat_ret:+.2f}%** vs **Benchmark: {bench_ret:+.2f}%**, Underperformance: **-{underperf:.2f}%**):

1. **Cash Drag During Trending Momentum**:
   - Buy-and-Hold captures 100% of upside rallies. If {symbol} had a strong directional bull phase while your strategy was in cash (signal = 0), the benchmark pulled ahead.
2. **Trade Frequency & Whipsaws**:
   - Total Trades: **{trades}** with a Win Rate of **{win_rate:.1f}%**.
   - If win rate is below 50%, the algorithm incurred repeated small losses entering false breakout or crossover signals that quickly reversed.
3. **Lag in Moving Averages / Filters**:
   - Active quantitative strategies require indicator confirmation before buying, causing delayed entries after the initial explosive move has already occurred.
4. **Drawdown Comparison**:
   - Strategy Max Drawdown was **{mdd:.2f}%** with an annualized Sharpe ratio of **{sharpe if sharpe is not None else 'N/A'}**.
   - *Key takeaway*: Even when active strategies lag total return in secular bull markets, they often provide capital preservation during severe bear markets.

*Optimization Idea*: Consider combining trend filters with tighter stop-loss rules or testing shorter lookback windows in the **Strategy Builder**."""

    return f"""### Common Reasons Quantitative Strategies Underperform Buy & Hold

When an active algorithmic strategy lags behind a buy-and-hold benchmark, the primary causes are typically:

1. **Cash Drag in Strong Bull Markets**: When the underlying asset trends strongly upward, any days the strategy spends in cash (waiting for indicator confirmation) lag the benchmark.
2. **Whipsaws in Choppy / Sideways Markets**: Moving average crossovers and breakout models generate false entry signals during consolidations, getting stopped out repeatedly.
3. **Indicator Lag**: Technical indicators like SMAs and MACD are lagging by mathematical definition; they enter after a bottom has formed and exit after a top has peaked.
4. **Execution & Volatility Noise**: Narrow stop-losses can trigger premature exits before the primary trend resumes.

*To diagnose your specific strategy*: Run a backtest in the **Strategy Builder** or **Backtesting** tab. The AI will then read your exact Total Return, Sharpe Ratio, and Win Rate to provide a personalized evaluation!"""


def handle_stock_price_query(
    symbol: str,
    tech: dict[str, Any],
) -> str:
    """Return verified live stock quote or explain unavailability."""
    cur_p = tech.get("current_price")
    change_pct = tech.get("change_pct", 0.0)
    sym = symbol.upper()

    if cur_p and cur_p > 0:
        return f"""### Live Market Quote: {sym} (NSE)

- **Current Price**: **₹{cur_p:,.2f}**
- **Day Change**: **{change_pct:+.2f}%**
- **Market Regime**: **{tech.get('regime', 'Neutral')}**
- **14-Day RSI**: **{tech.get('rsi_14', 50.0):.1f}**
- **Key Averages**: 20-DMA at **₹{tech.get('sma_20', cur_p):,.2f}** | 50-DMA at **₹{tech.get('sma_50', cur_p):,.2f}**

*Data Source: Official Indian market feeds via IndianAPI. Prices reflect latest market session closing or live trading tick.*"""

    return f"""### Market Data Status for {sym}

Live market price data for **{sym}** is currently unavailable from the IndianAPI feed.

*Possible reasons:*
- Market is closed outside active trading hours (09:15 AM - 03:30 PM IST).
- Delayed feed or temporary upstream API latency.
- Invalid or unsupported ticker symbol.

Please verify the ticker in the top selector or test during active trading hours."""


def get_offline_response(
    query: str,
    symbol: str,
    tech: dict[str, Any],
    latest_analytics: Optional[dict[str, Any]] = None,
    chat_history: Optional[list[dict[str, str]]] = None,
) -> str:
    """
    Main dispatch engine for QuantLab Offline Knowledge Mode.
    Produces intelligent, accurate answers across all supported domains.
    """
    q = query.lower().strip()
    sym = symbol.upper()

    # 1. Check for mathematical calculation
    math_res = evaluate_math_expression(query)
    if math_res:
        return math_res

    # 2. Check for conversation follow-up
    followup_res = resolve_conversation_followup(query, chat_history, sym)
    if followup_res:
        return followup_res

    # 3. "What is Python?" / General Programming Language Query
    if re.search(r'\bwhat is python\b|\bexplain python\b|\btell me about python\b', q):
        return """### Overview of the Python Programming Language

**Python** is a high-level, general-purpose, interpreted programming language created by Guido van Rossum and released in 1991. It emphasizes code readability with its notable use of significant indentation.

#### Key Characteristics:
- **Clean & Expressive Syntax**: Allows programmers to express concepts in fewer lines of code than languages like C++ or Java.
- **Dynamically Typed & Interpreted**: Code executes line-by-line, accelerating rapid prototyping and development.
- **"Batteries Included" Standard Library**: Rich built-in modules for networking, math, file I/O, serialization, and concurrency.
- **Expansive Ecosystem**:
  - **Data Science & Analytics**: `pandas`, `numpy`, `scipy`, `matplotlib`.
  - **Machine Learning & AI**: `pytorch`, `tensorflow`, `scikit-learn`.
  - **Web Development & APIs**: `FastAPI`, `Django`, `Flask`.
  - **Automation & Scripting**: Built-in modules like `os`, `sys`, `json`, `asyncio`.

```python
# Example: Expressive data processing in Python
def get_even_squares(numbers: list[int]) -> list[int]:
    \"\"\"Return squares of even numbers using a list comprehension.\"\"\"
    return [n ** 2 for n in numbers if n % 2 == 0]

data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
print(f"Even squares: {get_even_squares(data)}")
# Output: [4, 16, 36, 64, 100]
```"""

    # 4. Cybersecurity: "What is SQL injection?"
    if re.search(r'\bsql injection\b|\bsqli\b', q):
        return """### Cybersecurity: Understanding SQL Injection (SQLi)

**SQL Injection (SQLi)** is a critical web security vulnerability that allows an attacker to interfere with the queries that an application makes to its database. It typically occurs when untrusted user input is directly concatenated into dynamic SQL queries without sanitization or parameterization.

#### How It Works:
Consider a vulnerable login query:
```sql
SELECT * FROM users WHERE username = 'INPUT_USER' AND password = 'INPUT_PASSWORD';
```
If an attacker inputs `' OR '1'='1' --` as the username, the query evaluates to:
```sql
SELECT * FROM users WHERE username = '' OR '1'='1' -- AND password = '...';
```
Since `'1'='1'` is always true, authentication is bypassed.

#### Primary Defense Strategies:
1. **Parameterized Queries (Prepared Statements)**: Separates SQL code from user-supplied data so input is never treated as executable code.
2. **Object-Relational Mapping (ORM)**: Tools like SQLAlchemy, Prisma, or Hibernate safely parameterize queries by default.
3. **Principle of Least Privilege**: Ensure the database user account used by the web application has minimal necessary permissions.
4. **Input Validation & Allowlisting**: Validate and type-check all incoming API parameters."""

    # 5. Technical Indicators: "Explain RSI in trading"
    if re.search(r'\bexplain rsi\b|\bwhat is rsi\b|\brsi in trading\b', q):
        rsi_val = tech.get("rsi_14", 50.0)
        return (
            "### Relative Strength Index (RSI) in Trading\n\n"
            "The **Relative Strength Index (RSI)** is a momentum oscillator developed by J. Welles Wilder Jr. in 1978. "
            "It measures the speed and change of price movements on a scale from **0 to 100**.\n\n"
            "#### 1. Core Mathematical Formula\n"
            "$$RSI = 100 - \\left( \\frac{100}{1 + RS} \\right)$$\n"
            "$$\\text{Where } RS = \\frac{\\text{Wilder's Smoothed Average Gain}}{\\text{Wilder's Smoothed Average Loss}} \\text{ over } n \\text{ periods (standard } n=14\\text{)}$$\n\n"
            "#### 2. Key Trading Benchmarks\n"
            "- **Overbought (RSI >= 70)**: Indicates asset price momentum has expanded rapidly; potential for consolidation or mean-reverting pullback.\n"
            "- **Oversold (RSI <= 30)**: Indicates intense selling pressure; potential for technical relief bounce.\n"
            "- **Centerline (RSI = 50)**: Confirms trend direction—values above 50 suggest net bullish momentum.\n\n"
            "#### 3. Advanced Usage: Divergences\n"
            "- **Bullish Divergence**: Price makes a lower low, but RSI forms a higher low (signals fading downside momentum).\n"
            "- **Bearish Divergence**: Price makes a higher high, but RSI forms a lower high (signals buyer exhaustion).\n\n"
            f"*Current Live Reference for {sym}*: 14-day RSI is currently **{rsi_val:.1f}**."
        )

    # 6. Quantitative Ratios: "Sharpe vs Sortino"
    if re.search(r'sharpe.*sortino|difference between sharpe and sortino', q):
        return """### Comparison: Sharpe Ratio vs. Sortino Ratio

Both metrics evaluate risk-adjusted return, but they treat market volatility in fundamentally different ways.

| Feature | Sharpe Ratio | Sortino Ratio |
| :--- | :--- | :--- |
| **Formula** | $\\frac{R_p - R_f}{\\sigma_p}$ | $\\frac{R_p - R_f}{\\sigma_d}$ |
| **Denominator** | Total Volatility (Standard Deviation) | Downside Semi-Deviation Only |
| **Upside Spikes** | Penalized as risk | Not penalized (rewarded) |
| **Best Used For** | Normal/symmetric return distributions | Asymmetric, option-like, or momentum returns |

#### The Fundamental Difference:
- **Sharpe Ratio** treats **all** volatility as risk. If your strategy has huge upside breakout days, standard deviation increases, which ironically *lowers* your Sharpe score.
- **Sortino Ratio** only measures **harmful volatility** (returns below risk-free rate $R_f$). It gives a more accurate picture of downside capital preservation.

*Interpretation Standard*:
- $> 1.0$: Acceptable / Good
- $> 1.5$: Strong Risk-Adjusted Profile
- $> 2.0$: Institutional / Elite"""

    # 7. "Why did my strategy underperform the benchmark?"
    if re.search(r'underperform.*benchmark|why did my strategy (lose|fail|underperform)|strategy.*underperformed', q):
        return handle_why_underperformed(latest_analytics, sym)

    # 8. Live Stock Price Query: "What is the current price of RELIANCE?"
    if re.search(r'(current|latest|today|live)?\s*(share|stock)?\s*price\s*of|price\s*of\s*([a-zA-Z0-9]+)|(?:what is|how much is)\s+([a-zA-Z0-9]+)\s*(?:share|stock)?\s*price', q):
        explicit_sym_match = re.search(r'price\s*of\s*([a-zA-Z0-9]+)|(?:what is|how much is)\s+([a-zA-Z0-9]+)\s*(?:share|stock)?\s*price', q)
        target_sym = sym
        if explicit_sym_match:
            cand = (explicit_sym_match.group(1) or explicit_sym_match.group(2) or "").upper()
            if cand and cand not in ("THE", "A", "THIS", "STOCK", "SHARE", "CURRENT", "LATEST"):
                target_sym = cand
        return handle_stock_price_query(target_sym, tech if target_sym == sym else {"current_price": None})

    # 9. Options & Derivatives
    if any(k in q for k in ["option", "greeks", "delta", "gamma", "theta", "vega", "straddle", "iron condor", "black scholes"]):
        cur_p = tech.get("current_price", 0)
        regime = tech.get("regime", "Neutral")
        return (
            "### Options & Derivatives Engineering Guide\n\n"
            "#### The Core Greeks:\n"
            "- **Delta (Δ)**: Rate of change of option premium per Re 1 move in underlying.\n"
            "- **Gamma (Γ)**: Acceleration of Delta; highest for At-The-Money (ATM) options near expiry.\n"
            "- **Theta (Θ)**: Daily time decay. Collect premium as an option seller; lose premium as a buyer.\n"
            "- **Vega (ν)**: Sensitivity to a 1% change in Implied Volatility (IV).\n\n"
            "#### High-Probability Setups:\n"
            "- **Short Straddle / Strangle**: Sell ATM Call & Put when IV Rank > 50% to capture rapid theta decay during range-bound regimes.\n"
            "- **Bull Call / Bear Put Spread**: Defined-risk vertical spreads that cap losses during unexpected market gaps.\n"
            "- **Iron Condor**: Market-neutral credit strategy collecting premium between standard deviation boundaries.\n\n"
            f"*Underlying Asset ({sym})*: Currently trading at **₹{cur_p:,.2f}** in a **{regime}** regime."
        )

    # 10. General Python Backtesting Script
    if any(k in q for k in ["python code", "write python", "python script", "code for"]):
        return """### Python Quantitative Backtesting Engine

Here is a clean, production-ready vector backtesting template using `pandas` and `numpy`:

```python
import numpy as np
import pandas as pd

def backtest_strategy(df: pd.DataFrame, initial_capital: float = 100000.0):
    # 1. Compute 20 and 50 Moving Averages
    df['SMA20'] = df['Close'].rolling(20).mean()
    df['SMA50'] = df['Close'].rolling(50).mean()

    # 2. Generate Position Signal (1 = Long, 0 = Cash)
    df['Signal'] = np.where(df['SMA20'] > df['SMA50'], 1, 0)

    # 3. Daily Returns
    df['Asset_Return'] = df['Close'].pct_change()
    df['Strategy_Return'] = df['Asset_Return'] * df['Signal'].shift(1)

    # 4. Equity Curves
    df['Strategy_Equity'] = initial_capital * (1 + df['Strategy_Return']).cumprod()
    df['Benchmark_Equity'] = initial_capital * (1 + df['Asset_Return']).cumprod()

    # 5. Performance Attribution
    total_strat = (df['Strategy_Equity'].iloc[-1] - initial_capital) / initial_capital * 100
    total_bench = (df['Benchmark_Equity'].iloc[-1] - initial_capital) / initial_capital * 100

    print(f"Strategy Return: {total_strat:.2f}% | Benchmark: {total_bench:.2f}%")
    return df
```"""

    # 11. Indian Stock Market Rules & Taxation
    if any(k in q for k in ["tax", "stcg", "ltcg", "stt", "trading hours", "market timing"]):
        return """### Indian Stock Market (NSE/BSE) Regulations & Taxation

#### 1. Trading Sessions (IST)
- **Pre-Open Session**: 09:00 AM - 09:08 AM
- **Normal Trading**: 09:15 AM - 03:30 PM
- **Closing Auction**: 03:30 PM - 04:00 PM

#### 2. Capital Gains Tax (Union Budget Updates)
- **Short-Term Capital Gains (STCG)**: **20%** on listed equity held under 12 months.
- **Long-Term Capital Gains (LTCG)**: **12.5%** on listed equity held over 12 months (annual exemption up to ₹1.25 Lakh).
- **Securities Transaction Tax (STT)**: 0.1% on delivery equity; 0.02% on futures; 0.1% on option premiums."""

    # 12. Friendly Greeting / Introduction
    if re.search(r'^(hi|hello|hey|greetings|who are you|help)\b', q):
        return f"""### Welcome to QuantLab AI Assistant

I am your quantitative analytics and trading copilot. I can assist with:
- **Technical & Algorithmic Analysis**: Evaluate moving averages, RSI, and Bollinger bands on **{sym}**.
- **Financial Engineering**: Option Greeks, portfolio risk ratios, and backtest diagnostics.
- **Python Code Generation**: Vectorized trading scripts and algorithmic implementations.
- **General Technical Knowledge**: Science, cybersecurity, mathematics, and programming.

*Try asking: "Explain RSI in trading", "Calculate 15% of 20,000", or "What is Python?"*"""

    # 13. Transparent, Honest Offline Fallback
    return f"""### ℹ️ QuantLab Offline Knowledge Mode

I am currently running in **QuantLab Offline Knowledge Engine** mode. I have direct built-in knowledge for:
- **Quantitative Trading & Algorithms** (SMA, RSI, Bollinger Bands, MACD)
- **Risk Metrics** (Sharpe, Sortino, Drawdown, Kelly Criterion)
- **Options & Derivatives** (Greeks, Straddles, Iron Condor)
- **Python Programming & Code Generation**
- **Indian Market Data & Taxation** (STCG, LTCG, STT, NSE rules)
- **Mathematical Calculations** (e.g. "Calculate 15% of 20,000")

Your query *"**{query}**"* requires full generative reasoning beyond this offline rule base.

**To enable full generative conversational AI:**
1. Click the **"AI Model Key"** button in the header above.
2. Enter a free API key from **Google Gemini** (get one at [aistudio.google.com](https://aistudio.google.com)) or **Groq** ([console.groq.com](https://console.groq.com)).
3. Click **"Save & Apply"** to activate full conversational intelligence on any topic!"""
