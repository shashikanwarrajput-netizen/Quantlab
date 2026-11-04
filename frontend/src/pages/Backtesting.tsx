import React, { useEffect, useState } from 'react';
import { Play, History, Trash2, CheckCircle2, Sliders, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import {
  marketDataService,
  getSavedAnalytics,
  clearSavedAnalytics,
  type QuantAlgorithmResult,
} from '../services/marketDataService';

interface AlgoOption {
  id: string;
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  paramFields: Array<{ key: string; label: string; step?: number; min?: number }>;
}

const ALGORITHMS: AlgoOption[] = [
  {
    id: 'sma_crossover',
    name: 'SMA Crossover (20/50)',
    description: 'Golden / Death cross trend system. Buys when 20-SMA > 50-SMA.',
    defaultParams: { short_window: 20, long_window: 50 },
    paramFields: [
      { key: 'short_window', label: 'Short Window', min: 1 },
      { key: 'long_window', label: 'Long Window', min: 1 },
    ],
  },
  {
    id: 'rsi_reversion',
    name: 'RSI Mean Reversion (14, 30/70)',
    description: 'Oversold bounce strategy. Buys when RSI < 30, exits when RSI > 70.',
    defaultParams: { rsi_window: 14, oversold: 30, overbought: 70 },
    paramFields: [
      { key: 'rsi_window', label: 'RSI Period', min: 1 },
      { key: 'oversold', label: 'Oversold Level', min: 1 },
      { key: 'overbought', label: 'Overbought Level', min: 1 },
    ],
  },
  {
    id: 'bollinger_breakout',
    name: 'Bollinger Band Reversion (20, 2σ)',
    description: 'Mean reversion buying dips below the lower band and selling above the upper band.',
    defaultParams: { window: 20, num_std: 2.0 },
    paramFields: [
      { key: 'window', label: 'Window', min: 1 },
      { key: 'num_std', label: 'Std Dev (σ)', step: 0.1, min: 0.1 },
    ],
  },
  {
    id: 'macd_momentum',
    name: 'MACD Momentum (12/26/9)',
    description: 'Momentum strategy entering when MACD crosses above Signal line.',
    defaultParams: { fast_period: 12, slow_period: 26, signal_period: 9 },
    paramFields: [
      { key: 'fast_period', label: 'Fast EMA', min: 1 },
      { key: 'slow_period', label: 'Slow EMA', min: 1 },
      { key: 'signal_period', label: 'Signal EMA', min: 1 },
    ],
  },
  {
    id: 'buy_and_hold',
    name: 'Buy & Hold Benchmark',
    description: 'Passive baseline holding 100% long from day one.',
    defaultParams: {},
    paramFields: [],
  },
];

const POPULAR_TICKERS = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL',
];

const formatINR = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

const formatCommaNumber = (val: string | number): string => {
  const digits = String(val).replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return isNaN(num) ? '' : num.toLocaleString('en-IN');
};

export const Backtesting: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedAlgo, setSelectedAlgo] = useState<string>('sma_crossover');
  const [symbol, setSymbol] = useState<string>('RELIANCE');
  const [period, setPeriod] = useState<string>('1yr');
  const [initialCapital, setInitialCapital] = useState<string>('10,000');
  const [params, setParams] = useState<Record<string, string | number>>(ALGORITHMS[0].defaultParams);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<QuantAlgorithmResult | null>(null);
  const [history, setHistory] = useState<QuantAlgorithmResult[]>([]);

  useEffect(() => {
    const refreshHistory = () => {
      const saved = getSavedAnalytics();
      setHistory(saved);
      if (saved.length > 0) {
        setActiveResult((prev) => (prev && saved.some((s) => s.id === prev.id) ? prev : saved[0]));
      } else {
        setActiveResult(null);
      }
    };

    refreshHistory();

    const handleUpdate = () => {
      refreshHistory();
    };

    window.addEventListener('quantlab-analytics-updated', handleUpdate);
    window.addEventListener('quantlab-auth-changed', handleUpdate);
    return () => {
      window.removeEventListener('quantlab-analytics-updated', handleUpdate);
      window.removeEventListener('quantlab-auth-changed', handleUpdate);
    };
  }, []);

  const handleAlgoChange = (algoId: string) => {
    setSelectedAlgo(algoId);
    const found = ALGORITHMS.find((a) => a.id === algoId);
    if (found) {
      setParams(found.defaultParams);
    }
  };

  const handleParamUpdate = (key: string, val: string) => {
    // Strip leading zeros before digits (e.g. "03" -> "3", "007" -> "7")
    const clean = val.replace(/^0+(?=\d)/, '');
    setParams((prev) => ({
      ...prev,
      [key]: clean,
    }));
  };

  const handleParamBlur = (key: string, defVal: number, minVal?: number) => {
    setParams((prev) => {
      const raw = prev[key];
      if (raw === '' || raw === undefined || raw === null) {
        return { ...prev, [key]: defVal };
      }
      const num = parseFloat(String(raw));
      if (isNaN(num)) {
        return { ...prev, [key]: defVal };
      }
      const clamped = minVal != null ? Math.max(minVal, num) : num;
      return { ...prev, [key]: clamped };
    });
  };

  const handleRunBacktest = async (): Promise<void> => {
    const cleanSym = symbol.split(':')[0].trim().toUpperCase();
    if (!cleanSym) {
      setError('Invalid or unsupported stock symbol.');
      return;
    }
    const cap = parseFloat(initialCapital.replace(/,/g, ''));
    if (isNaN(cap) || cap <= 0) {
      setError('Initial capital must be greater than zero.');
      return;
    }

    const numericParams: Record<string, number> = {};
    for (const [k, v] of Object.entries(params)) {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      numericParams[k] = isNaN(num) ? (activeAlgoDef.defaultParams[k] ?? 1) : num;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await marketDataService.runQuantAlgorithm(
        cleanSym,
        selectedAlgo,
        period,
        cap,
        numericParams
      );
      setActiveResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete backtest simulation.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all saved backtest analytics history?')) {
      clearSavedAnalytics();
      setHistory([]);
      setActiveResult(null);
    }
  };

  const activeAlgoDef = ALGORITHMS.find((a) => a.id === selectedAlgo) || ALGORITHMS[0];

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-8 p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Quantitative Backtesting</h1>
              <p className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>
                Simulate quantitative strategies against official Indian market data with risk and alpha metrics.
              </p>
            </div>
            {history.length > 0 && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border self-start sm:self-auto ${isDark ? 'bg-[#2563EB]/20 text-[#60A5FA] border-[#2563EB]/40' : 'bg-[#EEF4FF] text-[#2563EB] border-[#B9CFF5]'}`}>
                {history.length} Runs Saved in Analytics
              </span>
            )}
          </div>

          {/* Configuration Card */}
          <div className={`rounded-3xl border p-6 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
            <h2 className={`mb-5 text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              <Sliders size={20} className="text-[#2563EB]" />
              Backtest Parameters
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Algorithm Dropdown */}
              <label className="space-y-1.5">
                <span className={`text-xs uppercase tracking-wider font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Quantitative Algorithm</span>
                <select
                  value={selectedAlgo}
                  onChange={(e) => handleAlgoChange(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}
                >
                  {ALGORITHMS.map((algo) => (
                    <option key={algo.id} value={algo.id}>
                      {algo.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Symbol */}
              <label className="space-y-1.5">
                <span className={`text-xs uppercase tracking-wider font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Symbol</span>
                <div className="flex gap-2">
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}
                  >
                    {POPULAR_TICKERS.map((t) => (
                      <option key={t} value={t}>{t} (NSE)</option>
                    ))}
                  </select>
                </div>
              </label>

              {/* Period */}
              <label className="space-y-1.5">
                <span className={`text-xs uppercase tracking-wider font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Lookback Period</span>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}
                >
                  <option value="1m">1 Month</option>
                  <option value="6m">6 Months</option>
                  <option value="1yr">1 Year</option>
                  <option value="3yr">3 Years</option>
                  <option value="5yr">5 Years</option>
                </select>
              </label>

              {/* Initial Capital */}
              <label className="space-y-1.5">
                <span className={`text-xs uppercase tracking-wider font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Initial Capital (INR)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(formatCommaNumber(e.target.value))}
                  placeholder="10,000"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}
                />
              </label>
            </div>

            {/* Dynamic Algorithm Parameters */}
            {activeAlgoDef.paramFields.length > 0 && (
              <div className={`mt-5 pt-4 border-t ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider block mb-3 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                  Tuning Parameters: {activeAlgoDef.name}
                </span>
                <div className="grid sm:grid-cols-3 gap-4">
                  {activeAlgoDef.paramFields.map((f) => (
                    <div key={f.key}>
                      <label className={`block text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{f.label}</label>
                      <input
                        type="number"
                        step={f.step || 1}
                        min={f.min || 1}
                        value={params[f.key] !== undefined ? params[f.key] : (activeAlgoDef.defaultParams[f.key] ?? '')}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/^0+(?=\d)/, '');
                          if (e.target.value !== clean) {
                            e.target.value = clean;
                          }
                          handleParamUpdate(f.key, clean);
                        }}
                        onBlur={() => handleParamBlur(f.key, activeAlgoDef.defaultParams[f.key] ?? 1, f.min || 1)}
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-[#7A8699]">
                {activeAlgoDef.description}
              </p>
              <button
                type="button"
                onClick={() => void handleRunBacktest()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] disabled:opacity-60 transition-all"
              >
                <Play size={16} />
                {loading ? 'Simulating Strategy...' : 'Run Backtest'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
              <ShieldAlert size={20} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Backtest Results */}
          {activeResult && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    {activeResult.algorithm.toUpperCase().replace('_', ' ')} on {activeResult.symbol}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                    Simulated {activeResult.equityCurve.length} trading days ({activeResult.period}) · Run ID: {activeResult.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    activeResult.metrics.totalReturnPct >= activeResult.metrics.benchmarkReturnPct
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeResult.metrics.totalReturnPct >= activeResult.metrics.benchmarkReturnPct ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    Alpha: {(activeResult.metrics.totalReturnPct - activeResult.metrics.benchmarkReturnPct).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                {[
                  { label: 'Initial Capital', value: formatINR(activeResult.metrics.initialCapital) },
                  { label: 'Final Capital', value: formatINR(activeResult.metrics.finalEquity) },
                  {
                    label: 'Total Return',
                    value: `${activeResult.metrics.totalReturnPct > 0 ? '+' : ''}${activeResult.metrics.totalReturnPct.toFixed(2)}%`,
                    isPositive: activeResult.metrics.totalReturnPct >= 0,
                  },
                  {
                    label: 'Benchmark Return',
                    value: `${activeResult.metrics.benchmarkReturnPct > 0 ? '+' : ''}${activeResult.metrics.benchmarkReturnPct.toFixed(2)}%`,
                  },
                  { label: 'CAGR', value: `${activeResult.metrics.cagrPct.toFixed(2)}%` },
                  {
                    label: 'Sharpe Ratio',
                    value: activeResult.metrics.sharpeRatio != null ? activeResult.metrics.sharpeRatio.toFixed(2) : 'N/A',
                  },
                  {
                    label: 'Max Drawdown',
                    value: `${activeResult.metrics.maxDrawdownPct.toFixed(2)}%`,
                    isDanger: activeResult.metrics.maxDrawdownPct > 20,
                  },
                  {
                    label: 'Trades (Win %)',
                    value: `${activeResult.metrics.totalTrades} (${activeResult.metrics.winRatePct.toFixed(1)}%)`,
                  },
                ].map((item, idx) => (
                  <div key={idx} className={`rounded-2xl border p-3 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                    <div className={`text-[10px] uppercase tracking-wider font-medium truncate ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{item.label}</div>
                    <div className={`mt-1 text-base font-bold truncate ${
                      item.isPositive === true ? 'text-[#10B981]' :
                      item.isPositive === false ? 'text-[#EF4444]' :
                      item.isDanger ? 'text-[#F59E0B]' : (isDark ? 'text-white' : 'text-[#0F172A]')
                    }`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recharts Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={`rounded-3xl border p-5 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                  <h3 className={`mb-4 text-base font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Equity Curve (Strategy vs Benchmark)</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeResult.equityCurve}>
                        <defs>
                          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1F2937" : "#E2E8F0"} />
                        <XAxis
                          dataKey="date"
                          stroke={isDark ? "#94A3B8" : "#64748B"}
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          minTickGap={30}
                        />
                        <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(val: any, name: any) => [formatINR(Number(val)), name === 'strategyEquity' ? 'Strategy Equity' : 'Benchmark']}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="strategyEquity" name="Strategy Equity" stroke="#3B82F6" fillOpacity={1} fill="url(#eqFill)" strokeWidth={2} />
                        <Area type="monotone" dataKey="benchmarkEquity" name="Benchmark" stroke="#94A3B8" fillOpacity={0} strokeDasharray="4 4" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={`rounded-3xl border p-5 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                  <h3 className={`mb-4 text-base font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Daily Drawdown Risk (%)</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeResult.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1F2937" : "#E2E8F0"} />
                        <XAxis
                          dataKey="date"
                          stroke={isDark ? "#94A3B8" : "#64748B"}
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          minTickGap={30}
                        />
                        <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Drawdown']}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Bar dataKey="drawdown" name="Drawdown %" fill="#EF4444" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Saved Analytics History Table */}
          <div className={`space-y-4 pt-6 border-t ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                <History size={20} className="text-[#2563EB]" />
                Saved Analytics History
              </h2>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition"
                >
                  <Trash2 size={14} />
                  Clear All History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className={`rounded-2xl border p-8 text-center ${isDark ? 'border-[#1F2937] bg-[#111827] text-[#94A3B8]' : 'border-[#E2E8F0] bg-white text-[#64748B]'}`}>
                <p className="text-sm font-medium">No saved analytics found</p>
                <p className="text-xs text-[#7A8699] mt-1">
                  Run a strategy backtest above to automatically persist the top 20 execution histories across sessions.
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                <table className="w-full text-left text-sm">
                  <thead className={`text-[11px] font-semibold uppercase tracking-wider border-b ${isDark ? 'bg-[#0B0F19] text-[#94A3B8] border-[#1F2937]' : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'}`}>
                    <tr>
                      <th className="py-3 px-4">Date/Time</th>
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Algorithm</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Return %</th>
                      <th className="py-3 px-4 text-right">Sharpe</th>
                      <th className="py-3 px-4 text-right">Max DD</th>
                      <th className="py-3 px-4 text-right">Trades</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1F2937]' : 'divide-[#E2E8F0]'}`}>
                    {history.map((item) => {
                      const isCurrent = activeResult?.id === item.id;
                      const isPositive = item.metrics.totalReturnPct >= 0;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#F1F5F9] transition cursor-pointer ${
                            isCurrent ? 'bg-[#EEF4FF]' : ''
                          }`}
                          onClick={() => setActiveResult(item)}
                        >
                          <td className={`py-3 px-4 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{item.symbol}</td>
                          <td className={`py-3 px-4 text-xs font-semibold ${isDark ? 'text-[#60A5FA]' : 'text-[#2563EB]'}`}>
                            {item.algorithm.replace('_', ' ').toUpperCase()}
                          </td>
                          <td className={`py-3 px-4 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{item.period}</td>
                          <td className={`py-3 px-4 text-right font-bold text-xs ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? '+' : ''}{item.metrics.totalReturnPct.toFixed(2)}%
                          </td>
                          <td className={`py-3 px-4 text-right text-xs font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                            {item.metrics.sharpeRatio != null ? item.metrics.sharpeRatio.toFixed(2) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-amber-700">
                            {item.metrics.maxDrawdownPct.toFixed(2)}%
                          </td>
                          <td className={`py-3 px-4 text-right text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                            {item.metrics.totalTrades}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCurrent ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold ${isDark ? 'text-[#60A5FA]' : 'text-[#2563EB]'}`}>
                                <CheckCircle2 size={13} /> Active
                              </span>
                            ) : (
                              <span className={`text-xs hover:underline ${isDark ? 'text-[#94A3B8] hover:text-[#60A5FA]' : 'text-[#64748B] hover:text-[#2563EB]'}`}>Load</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};
