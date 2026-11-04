# QuantLab — Master AI Re-creation & System Prompt

> **Instructions for AI:**  
> You are acting as a Principal Full-Stack Quant Developer, Quantitative Researcher, and DevOps Architect. Your task is to build, extend, or maintain the **QuantLab** quantitative trading, backtesting, and market analytics platform according to this complete specification.

---

## 1. PROJECT IDENTITY & MISSION

- **Application Name:** QuantLab
- **Domain:** Quantitative Algorithmic Trading, Market Analytics, Algorithmic Backtesting, Conversational Quant AI, and Web3 On-Chain Trade Verification.
- **Target Markets:** Indian Equities (NSE / BSE) with extensible global multi-asset architecture.
- **Architectural Philosophy:**
  1. **Strict Security & Zero Leakage:** Third-party market data provider credentials (IndianAPI) and LLM API keys must reside solely in the backend. The browser frontend never directly calls third-party APIs and never receives raw keys.
  2. **Zero-Crash Demo Mode:** If third-party API keys are missing or invalid, the platform automatically switches to high-fidelity deterministic synthetic market data so all charts, technical indicators, backtests, and AI chats function out-of-the-box.
  3. **Multi-Tier AI Intelligence:** Orchestrates Google Gemini, Groq, and OpenAI with conversation memory, falling back seamlessly to an internal deterministic Offline Quantitative Knowledge Engine when external keys are unavailable.
  4. **Cryptographic Proof of Trade (Web3):** Immutably logs strategy trades onto EVM blockchains via Solidity smart contracts, featuring a local simulated ledger fallback when Web3 wallets are disconnected.
  5. **Cross-Platform Portability:** Standardized on UTF-8 (no BOM), LF line endings via `.gitattributes`, and self-healing startup launchers (`run.bat`, `setup_and_run.sh`).

---

## 2. ECOSYSTEM & TECH STACK

### Frontend
- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS (v3/v4), PostCSS, Autoprefixer
- **Animation & Icons:** Framer Motion, Lucide React
- **Charting & Visualizations:** Recharts (Candlestick, Area, Line, Bar charts)
- **Web3 Integration:** Web3.js with MetaMask provider and local state fallback
- **Realtime Communication:** Socket.IO Client
- **Port:** `5173` (with Vite `/api` proxy targeting `http://127.0.0.1:8000`)

### Backend
- **Framework:** Python 3.11+, FastAPI, Uvicorn
- **Networking & Data:** HTTPX (async client), Requests, Pydantic v2 (validation & serialization), Python-dotenv
- **Calculations:** Pure Python / NumPy / SciPy-compatible math algorithms
- **Port:** `8000` (CORS enabled for `http://localhost:5173`, `http://127.0.0.1:5173`, `*`)

### Blockchain
- **Language:** Solidity `^0.8.0`
- **Smart Contract:** `QuantLabTrades.sol` (recording trade ID, trader address, strategy name, symbol, entry/exit prices, volume, and verification status)

### Market Data Provider
- **Primary:** IndianAPI (`https://stock.indianapi.in`)
- **Supported Tickers:** `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`, `ICICIBANK`, `SBIN`, `TATAMOTORS`, `ITC`, `WIPRO`, `BHARTIARTL`, `NIFTY 50`, `SENSEX`, `BANKNIFTY`
- **Caching:** In-memory TTL caching (60s for quotes, intraday, and overview; 300s for historical time-series)

---

## 3. REPOSITORY DIRECTORY LAYOUT

```
QuantLab/
├── .gitattributes
├── .gitignore
├── DEPLOYMENT.md
├── README.md
├── PROJECT_PROMPT.md
├── run.bat
├── setup_and_run.sh
├── backend/
│   ├── .env.example
│   ├── main.py
│   ├── requirements.txt
│   ├── __init__.py
│   ├── contracts/
│   │   └── QuantLabTrades.sol
│   ├── models/
│   │   ├── __init__.py
│   │   └── market.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── market.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_service.py
│   │   ├── indian_api_service.py
│   │   ├── offline_ai.py
│   │   └── quant_engine.py
│   ├── tests/
│   │   └── test_market_service.py
│   └── utils/
│       └── __init__.py
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    ├── public/
    │   ├── favicon.svg
    │   └── logo.svg
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/
        │   ├── MarketChart.tsx
        │   ├── common/
        │   └── layout/
        ├── context/
        │   ├── AuthContext.tsx
        │   └── ThemeContext.tsx
        ├── pages/
        │   ├── AIAssistant.tsx
        │   ├── Backtesting.tsx
        │   ├── Compare.tsx
        │   ├── Dashboard.tsx
        │   ├── Landing.tsx
        │   ├── MarketData.tsx
        │   ├── Portfolio.tsx
        │   ├── Settings.tsx
        │   └── StrategyBuilder.tsx
        └── services/
            ├── marketDataService.ts
            ├── web3Service.ts
            └── websocketService.ts
```

---

## 4. BACKEND REST API SPECIFICATION

All endpoints are prefixed with `/api/market/`:

### 1. Health & Config
- **`GET /api/market/status`**
  - *Response:* `{"marketStatus": {"status": "LIVE DATA" | "DEMO DATA", "source": "IndianAPI"}}`
- **`GET /api/market/config`**
  - *Response:* `{"provider": "IndianAPI", "configured": true/false, "baseUrl": "https://stock.indianapi.in"}`

### 2. Quotes & Market Breadth
- **`GET /api/market/quote?symbol={SYMBOL}`**
  - Returns current LTP, open, high, low, close, net change, percent change, volume, 52W high/low, and timestamp.
- **`GET /api/market/quotes?symbols={SYM1,SYM2,...}`**
  - Returns batch dictionary of quotes for up to 10 comma-separated symbols.
- **`GET /api/market/history?symbol={SYMBOL}&period={1m|6m|1yr|3yr|5yr|max}&filter=price`**
  - Returns chronological datasets containing `[date, close_price]` tuples, DMA50, and volume.
- **`GET /api/market/intraday?symbol={SYMBOL}`**
  - Returns 5-minute interval ticks from `09:15` to current market time.
- **`GET /api/market/overview`**
  - Returns major Indian indices (`NIFTY 50`, `SENSEX`, `NIFTY BANK`), `trending` (top gainers and losers), `nseMostActive`, `bseMostActive`, and `weekHighLow`.

### 3. Quantitative Backtesting & Execution
- **`POST /api/market/run-algorithm`**
  - *Request Body:*
    ```json
    {
      "symbol": "RELIANCE",
      "period": "1yr",
      "algorithm": "sma_crossover",
      "initial_capital": 100000.0,
      "params": { "fast_window": 10, "slow_window": 30 }
    }
    ```
  - *Response:*
    ```json
    {
      "symbol": "RELIANCE",
      "period": "1yr",
      "algorithm": "sma_crossover",
      "initialCapital": 100000.0,
      "metrics": {
        "finalEquity": 99239.54,
        "totalReturnPct": -0.76,
        "benchmarkReturnPct": 40.83,
        "cagrPct": -0.79,
        "sharpeRatio": -0.61,
        "maxDrawdownPct": 18.67,
        "totalTrades": 3,
        "winRatePct": 33.33
      },
      "equityCurve": [{ "date": "2025-11-19", "close": 1977.86, "strategyEquity": 100000.0, "benchmarkEquity": 100000.0, "drawdown": 0.0, "signal": 0 }]
    }
    ```

### 4. Conversational Quant AI
- **`POST /api/market/ai-chat`**
  - *Request Body:*
    ```json
    {
      "message": "Calculate the RSI for RELIANCE and suggest a risk management plan.",
      "symbol": "RELIANCE",
      "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    }
    ```
  - *Response:*
    ```json
    {
      "response": "Detailed markdown explanation with live technical indicators and advice...",
      "technical_summary": { "symbol": "RELIANCE", "latest_price": 2785.40, "rsi_14": 84.7, "sma_20": 2740.1 },
      "provider": "gemini" | "groq" | "openai" | "offline",
      "is_offline": false
    }
    ```

---

## 5. QUANTITATIVE MATHEMATICAL FORMULAS

Implemented in `backend/services/quant_engine.py`:

1. **Simple Moving Average (SMA):**
   $$\text{SMA}_k(t) = \frac{1}{k} \sum_{i=0}^{k-1} P(t-i)$$

2. **Exponential Moving Average (EMA):**
   $$\alpha = \frac{2}{k + 1}, \quad \text{EMA}(t) = \alpha \cdot P(t) + (1 - \alpha) \cdot \text{EMA}(t-1)$$

3. **Wilder's Relative Strength Index (RSI - 14):**
   $$\text{RS} = \frac{\text{Smoothed Average Gain}}{\text{Smoothed Average Loss}}, \quad \text{RSI} = 100 - \frac{100}{1 + \text{RS}}$$

4. **MACD (12, 26, 9):**
   $$\text{MACD Line} = \text{EMA}_{12}(P) - \text{EMA}_{26}(P)$$
   $$\text{Signal Line} = \text{EMA}_9(\text{MACD Line}), \quad \text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

5. **Bollinger Bands (20, 2):**
   $$\text{Middle} = \text{SMA}_{20}(P), \quad \text{Upper/Lower} = \text{SMA}_{20}(P) \pm 2 \cdot \sigma_{20}(P)$$

6. **Sharpe Ratio (Annualized, $R_f = 6\%$):**
   $$\text{Sharpe} = \frac{R_p - R_f}{\sigma_p} \cdot \sqrt{252}$$

7. **Maximum Drawdown (MDD):**
   $$\text{MDD} = \max_{t \in [0, T]} \left( \frac{\max_{s \le t} \text{Equity}(s) - \text{Equity}(t)}{\max_{s \le t} \text{Equity}(s)} \right)$$

---

## 6. AI ASSISTANT MASTER SYSTEM PROMPT

The backend orchestrator (`backend/services/ai_service.py`) injects this system prompt:

```text
You are QuantLab AI, an intelligent, conversational, general-purpose AI assistant with advanced expertise in quantitative finance, algorithmic trading, financial mathematics, programming, cybersecurity, science, technology, and general knowledge.

Your primary responsibility is to understand the user's actual question and provide a relevant, accurate, clear, and contextually appropriate answer.

You are not a fixed-response chatbot. Do not repeat predefined answers for unrelated questions. Do not rely exclusively on keyword matching. Interpret the meaning, intent, constraints, and context of each request before answering.

GENERAL BEHAVIOR:
1. Answer the exact question the user asks.
2. Support both general-purpose questions and specialized financial questions.
3. Adapt the depth of your response to the complexity of the question.
4. Use simple explanations when requested and technical detail when appropriate.
5. Provide examples, calculations, code, comparisons, and step-by-step instructions when useful.
6. If the user asks a follow-up question, connect it to the relevant previous conversation.
7. Do not ask users to repeat information already available in the conversation.
8. If essential information is missing, ask a concise clarifying question.
9. If you do not know something, acknowledge the uncertainty instead of inventing facts.
10. Do not claim to have searched the internet, accessed live data, executed code, or performed an action unless that actually occurred.

QUANTITATIVE FINANCE PRINCIPLES:
- Explain trading strategies, technical indicators, options, derivatives, portfolio construction, and risk management accurately.
- Use actual market or backtest data only when it is available in the supplied context or through a working data integration.
- Distinguish historical backtest results from live market performance and future predictions.
- Explain assumptions, limitations, and relevant risks. Never guarantee investment returns.
```

---

## 7. SOLIDITY ON-CHAIN TRADE VERIFICATION (`QuantLabTrades.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract QuantLabTrades {
    struct Trade {
        uint256 id;
        address trader;
        string strategy;
        string symbol;
        uint256 entryPrice;
        uint256 exitPrice;
        uint256 quantity;
        uint256 timestamp;
        bool isClosed;
        string status; // OPEN, VERIFIED, CLOSED
    }

    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public userTrades;
    uint256 public tradeCounter;

    event TradeCreated(uint256 indexed tradeId, address indexed trader, string strategy, string symbol, uint256 entryPrice, uint256 timestamp);
    event TradeClosed(uint256 indexed tradeId, uint256 exitPrice, int256 profitLoss, uint256 timestamp);

    function createTrade(string memory _strategy, string memory _symbol, uint256 _entryPrice, uint256 _quantity) external returns (uint256) {
        tradeCounter++;
        trades[tradeCounter] = Trade(tradeCounter, msg.sender, _strategy, _symbol, _entryPrice, 0, _quantity, block.timestamp, false, "OPEN");
        userTrades[msg.sender].push(tradeCounter);
        emit TradeCreated(tradeCounter, msg.sender, _strategy, _symbol, _entryPrice, block.timestamp);
        return tradeCounter;
    }

    function closeTrade(uint256 _tradeId, uint256 _exitPrice) external returns (int256) {
        Trade storage t = trades[_tradeId];
        require(msg.sender == t.trader, "Unauthorized");
        require(!t.isClosed, "Already closed");
        t.exitPrice = _exitPrice;
        t.isClosed = true;
        t.status = "VERIFIED";
        int256 pnl = int256((_exitPrice * t.quantity)) - int256((t.entryPrice * t.quantity));
        emit TradeClosed(_tradeId, _exitPrice, pnl, block.timestamp);
        return pnl;
    }
}
```

---

## 8. FRONTEND APPLICATION MODULES (9 PAGES)

1. **`Landing.tsx`:** Hero banner, interactive live terminal preview, feature breakdown, performance stats, and authentication CTAs.
2. **`Dashboard.tsx`:** Top tickers (NIFTY 50, SENSEX, BANKNIFTY), market breadth (advance/decline), top gainers & losers, and 52W high/lows.
3. **`MarketData.tsx`:** Candlestick & line chart engine with timeframes (`1m`, `6m`, `1yr`, `3yr`, `5yr`, `max`), toggleable indicator overlays (SMA, EMA, RSI, MACD, Bollinger Bands), and fundamental valuation stats.
4. **`StrategyBuilder.tsx`:** Visual rules composer for momentum, moving average crossovers, RSI oversold/overbought thresholds, stop-loss, and take-profit targets.
5. **`Backtesting.tsx`:** Historical strategy simulator generating strategy vs benchmark equity curves, drawdown analysis, Sharpe ratio, Sortino ratio, win rate %, and detailed trade journal.
6. **`AIAssistant.tsx`:** Full conversational assistant with LaTeX math rendering, syntax highlighting, conversation memory, and live indicator integration.
7. **`Portfolio.tsx`:** Multi-asset allocation breakdown, PnL tracking, Value at Risk (VaR), and position monitoring.
8. **`Compare.tsx`:** Multi-symbol comparative chart overlay (e.g. RELIANCE vs TCS vs INFY).
9. **`Settings.tsx`:** Dark/Light theme toggle, polling interval controls, API provider keys management, and Web3 wallet connection status.

---

## 9. ZERO-DEPENDENCY SELF-HEALING LAUNCHER

The platform must launch on any machine out-of-the-box via `run.bat` (Windows) or `setup_and_run.sh` (Linux/macOS):
1. **Auto-Configuration:** If `backend/.env` is absent, automatically clone from `backend/.env.example`.
2. **Python Environment:** Automatically create `.venv` and install `backend/requirements.txt` if not present.
3. **Frontend Dependencies:** Automatically execute `npm install` in `frontend/` if `node_modules/` is missing.
4. **Dual Server Execution:** Simultaneously spin up FastAPI on `http://127.0.0.1:8000` and Vite on `http://127.0.0.1:5173`.

