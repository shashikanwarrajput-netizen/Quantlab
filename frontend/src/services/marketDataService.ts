// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetQuote {
  symbol: string;
  companyName: string;
  price: number | null;
  currency: string;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketStatus: string;
  dataStatus: string;
  source: string;
  timestamp: string | null;
}

export interface MarketHistoryPoint {
  datetime: string;
  close: number;
  volume: number | null;
  dma50: number | null;
  dma200: number | null;
}

export interface IntradayPoint {
  time: string;
  price: number;
}

export interface MarketOverview {
  source: string;
  indices: Array<Record<string, unknown>>;
  trending: { top_gainers?: Array<Record<string, unknown>>; top_losers?: Array<Record<string, unknown>> };
  nseMostActive: Array<Record<string, unknown>>;
  bseMostActive: Array<Record<string, unknown>>;
  weekHighLow: Record<string, unknown> | null;
  unavailable: string[];
}

export interface AlgorithmMetrics {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  cagrPct: number;
  sharpeRatio: number | null;
  maxDrawdownPct: number;
  totalTrades: number;
  winRatePct: number;
}

export interface EquityCurvePoint {
  date: string;
  close: number;
  strategyEquity: number;
  benchmarkEquity: number;
  drawdown: number;
  signal: number;
}

export interface QuantAlgorithmResult {
  id: string;
  timestamp: string;
  symbol: string;
  algorithm: string;
  algorithmName?: string;
  period: string;
  initialCapital: number;
  params: Record<string, unknown>;
  metrics: AlgorithmMetrics;
  equityCurve: EquityCurvePoint[];
}

export interface AIChatOptions {
  symbol?: string;
  apiKey?: string;
  provider?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIChatResponse {
  response: string;
  provider?: string;
  technical_summary?: {
    symbol: string;
    current_price: number;
    change_pct: number;
    rsi_14: number;
    sma_20: number;
    sma_50: number;
    regime: string;
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const configuredPollInterval = Number(import.meta.env.VITE_MARKET_POLL_INTERVAL_MS);
export const MARKET_POLL_INTERVAL_MS = Number.isFinite(configuredPollInterval)
  ? Math.max(60_000, configuredPollInterval)
  : 60_000;

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ─── Core fetch helper ───────────────────────────────────────────────────────

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail || payload?.message || payload?.error || 'Unable to retrieve market data.';
    throw new Error(typeof message === 'string' ? message : 'Unable to retrieve market data.');
  }
  return response.json() as Promise<T>;
}

// ─── Safely coerce IndianAPI string numbers to JS numbers ────────────────────

function toNum(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── Public service ──────────────────────────────────────────────────────────

export const marketDataService = {
  /**
   * GET /api/market/quote?symbol=XXX
   *
   * IndianAPI returns the raw stock object at the top level (no wrapping `quote` key).
   * Price lives at stockDetailsReusableData.price and currentPrice.NSE / .BSE.
   */
  async getQuote(symbol: string): Promise<AssetQuote> {
    const raw = await callApi<Record<string, any>>(
      `/market/quote?symbol=${encodeURIComponent(symbol)}`,
    );

    const sdr = raw?.stockDetailsReusableData ?? {};
    const cp = raw?.currentPrice ?? {};

    // Price: prefer stockDetailsReusableData.price, fall back to currentPrice.NSE then BSE
    const price = toNum(sdr.price) ?? toNum(cp.NSE) ?? toNum(cp.BSE);

    // Previous close = sdr.close (last session closing price)
    const previousClose = toNum(sdr.close);

    // Compute absolute change from close
    const change =
      price != null && previousClose != null ? +(price - previousClose).toFixed(2) : null;

    // Percent change comes directly from the API
    const changePercent = toNum(sdr.percentChange) ?? toNum(raw?.percentChange);

    // Timestamp: combine sdr.date + sdr.time if present
    const timestamp =
      sdr.date && sdr.time ? `${sdr.date} ${sdr.time}` : (sdr.date ?? null);

    return {
      symbol: symbol.toUpperCase(),
      companyName: raw?.companyName ?? symbol,
      price,
      currency: 'INR',
      change,
      changePercent,
      previousClose,
      open: null, // IndianAPI /stock does not expose an explicit open price
      dayHigh: toNum(sdr.high),
      dayLow: toNum(sdr.low),
      volume: null, // volume is in history datasets, not quote
      marketCap: toNum(sdr.marketCap),
      fiftyTwoWeekHigh: toNum(sdr.yhigh) ?? toNum(raw?.yearHigh),
      fiftyTwoWeekLow: toNum(sdr.ylow) ?? toNum(raw?.yearLow),
      marketStatus: 'DELAYED DATA',
      dataStatus: 'LIVE',
      source: 'IndianAPI',
      timestamp,
    };
  },

  /**
   * Batch quotes — fetches individually; Promise.allSettled so one failure doesn't wipe all.
   */
  async getQuotes(symbols: string[]): Promise<AssetQuote[]> {
    const uniqueSymbols = Array.from(
      new Set(symbols.filter(Boolean).map((s) => s.trim().toUpperCase())),
    ).slice(0, 12);
    if (uniqueSymbols.length === 0) return [];
    const results = await Promise.allSettled(
      uniqueSymbols.map((s) => marketDataService.getQuote(s)),
    );
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  },

  /**
   * GET /api/market/history?symbol=XXX&period=1yr&filter=default
   *
   * IndianAPI returns { datasets: [{ metric, label, values: [[date, value], ...] }] }.
   * We pivot these parallel arrays into MarketHistoryPoint objects.
   */
  async getHistory(
    symbol: string,
    period = '1yr',
    dataFilter = 'default',
  ): Promise<MarketHistoryPoint[]> {
    const raw = await callApi<Record<string, any>>(
      `/market/history?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&filter=${encodeURIComponent(dataFilter)}`,
    );

    const datasets: Array<{ metric: string; values: any[] }> = Array.isArray(raw?.datasets)
      ? raw.datasets
      : [];
    if (datasets.length === 0) return [];

    // Build lookup by uppercase metric name
    const byMetric: Record<string, unknown[][]> = {};
    for (const ds of datasets) {
      const key = String(ds.metric ?? '').toUpperCase();
      if (Array.isArray(ds.values)) byMetric[key] = ds.values;
    }

    // Use the Price dataset as the spine; other datasets align by index
    const priceValues = byMetric['PRICE'] ?? [];
    const dma50Values = byMetric['DMA50'] ?? [];
    const dma200Values = byMetric['DMA200'] ?? [];
    const volumeValues = byMetric['VOLUME'] ?? [];

    return priceValues
      .map((entry, i): MarketHistoryPoint | null => {
        const datetime = String(entry[0] ?? '');
        const close = toNum(entry[1]);
        if (!datetime || close == null) return null;
        return {
          datetime,
          close,
          dma50: toNum(dma50Values[i]?.[1]),
          dma200: toNum(dma200Values[i]?.[1]),
          // Volume entry is [date, number, { delivery: N }]
          volume: toNum(volumeValues[i]?.[1]),
        };
      })
      .filter((p): p is MarketHistoryPoint => p !== null);
  },

  /**
   * GET /api/market/intraday?symbol=XXX  — may 404 on free tier; treated as optional.
   */
  async getIntraday(
    symbol: string,
  ): Promise<{ symbol: string; source: string; timestamp: string; data: IntradayPoint[] }> {
    return callApi<{ symbol: string; source: string; timestamp: string; data: IntradayPoint[] }>(
      `/market/intraday?symbol=${encodeURIComponent(symbol)}`,
    );
  },

  /**
   * GET /api/market/overview — may 404 on free tier; treated as optional.
   */
  async getOverview(): Promise<MarketOverview> {
    return callApi('/market/overview');
  },

  /**
   * POST /api/market/run-algorithm
   * Runs quantitative strategy simulation and automatically persists to localStorage.
   */
  async runQuantAlgorithm(
    symbol: string,
    algorithm: string,
    period = '1yr',
    initialCapital = 100000,
    params: Record<string, unknown> = {},
  ): Promise<QuantAlgorithmResult> {
    const result = await callApi<QuantAlgorithmResult>('/market/run-algorithm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        period,
        algorithm,
        initial_capital: initialCapital,
        params,
      }),
    });

    saveAnalyticsResult(result);
    return result;
  },

  /**
   * POST /api/market/ai-chat
   * Sends user query along with latest saved backtest analytics, optional LLM key, and chat history.
   */
  async sendAIChatMessage(
    message: string,
    options?: string | AIChatOptions,
  ): Promise<AIChatResponse> {
    const opts: AIChatOptions = typeof options === 'string' ? { symbol: options } : options || {};
    const symbol = opts.symbol || 'RELIANCE';
    const saved = getSavedAnalytics();
    const cleanSym = symbol.split(':')[0].trim().toUpperCase();
    const matchingRun = saved.find((item) => item.symbol.toUpperCase() === cleanSym) || saved[0];

    // Read client-stored API key if any
    const userKey = getActiveUserKey();
    const storedKey = typeof window !== 'undefined'
      ? (localStorage.getItem(`quantlab_ai_key_${userKey}`) || localStorage.getItem('quantlab_ai_key'))
      : null;
    const storedProvider = typeof window !== 'undefined'
      ? (localStorage.getItem(`quantlab_ai_provider_${userKey}`) || localStorage.getItem('quantlab_ai_provider'))
      : null;

    return callApi<AIChatResponse>('/market/ai-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        symbol: cleanSym,
        latest_analytics: matchingRun || null,
        api_key: opts.apiKey || storedKey || null,
        provider: opts.provider || storedProvider || 'auto',
        history: opts.history || null,
      }),
    });
  },
};

// ─── Analytics Persistence & Events ──────────────────────────────────────────

export const ANALYTICS_STORAGE_KEY = 'quantlab_analytics_history';

export function getActiveUserKey(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    const raw = localStorage.getItem('quantlab_user');
    if (raw) {
      const user = JSON.parse(raw);
      const email = user?.email ? String(user.email).trim().toLowerCase() : '';
      if (email) {
        return email.replace(/[^a-z0-9]/g, '_');
      }
      if (user?.id) {
        return String(user.id);
      }
    }
  } catch {
    // fallback
  }
  return 'guest';
}

export function getUserAnalyticsKey(): string {
  const userKey = getActiveUserKey();
  return `${ANALYTICS_STORAGE_KEY}_${userKey}`;
}

export function getSavedAnalytics(): QuantAlgorithmResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getUserAnalyticsKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse saved analytics:', e);
    return [];
  }
}

export function saveAnalyticsResult(result: QuantAlgorithmResult): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserAnalyticsKey();
    const history = getSavedAnalytics();
    const updated = [result, ...history.filter((item) => item.id !== result.id)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('quantlab-analytics-updated', { detail: result }));
  } catch (e) {
    console.error('Failed to persist analytics result:', e);
  }
}

export function clearSavedAnalytics(): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserAnalyticsKey();
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('quantlab-analytics-updated', { detail: null }));
  } catch (e) {
    console.error('Failed to clear saved analytics:', e);
  }
}

