import React, { useEffect, useState } from 'react';
import { Play, Clock, History, Trash2, CheckCircle2, Sliders, ShieldAlert } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Navbar } from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';
import { DashboardLayout } from '../components/layout/Sidebar';
import { Button, Card, Input, Badge } from '../components/common/Button';
import {
  marketDataService,
  getSavedAnalytics,
  clearSavedAnalytics,
  type QuantAlgorithmResult,
} from '../services/marketDataService';

interface AlgorithmDefinition {
  id: string;
  name: string;
  shortDesc: string;
  defaultParams: Record<string, number>;
  paramConfig: Array<{ key: string; label: string; step?: number; min?: number }>;
  indicators: string[];
}

const ESTABLISHED_ALGORITHMS: AlgorithmDefinition[] = [
  {
    id: 'sma_crossover',
    name: 'SMA Crossover (20/50)',
    shortDesc: 'Golden/Death Cross trend-following system. Buys when Short SMA > Long SMA.',
    defaultParams: { short_window: 20, long_window: 50 },
    paramConfig: [
      { key: 'short_window', label: 'Short SMA Window', min: 1 },
      { key: 'long_window', label: 'Long SMA Window', min: 1 },
    ],
    indicators: ['SMA (20)', 'SMA (50)'],
  },
  {
    id: 'rsi_reversion',
    name: 'RSI Mean Reversion (14, 30/70)',
    shortDesc: 'Statistical mean reversion. Buys on oversold dips (<30) and exits on overbought runs (>70).',
    defaultParams: { rsi_window: 14, oversold: 30, overbought: 70 },
    paramConfig: [
      { key: 'rsi_window', label: 'RSI Window', min: 1 },
      { key: 'oversold', label: 'Oversold Threshold', min: 1 },
      { key: 'overbought', label: 'Overbought Threshold', min: 1 },
    ],
    indicators: ['RSI (14)'],
  },
  {
    id: 'bollinger_breakout',
    name: 'Bollinger Band Reversion (20, 2σ)',
    shortDesc: 'Volatility envelope mean reversion. Buys below lower standard deviation band, exits above upper band.',
    defaultParams: { window: 20, num_std: 2.0 },
    paramConfig: [
      { key: 'window', label: 'Band Period', min: 1 },
      { key: 'num_std', label: 'Std Dev (σ)', step: 0.1, min: 0.1 },
    ],
    indicators: ['Bollinger Bands (20, 2σ)'],
  },
  {
    id: 'macd_momentum',
    name: 'MACD Momentum (12/26/9)',
    shortDesc: 'Exponential moving average momentum. Buys when MACD line crosses above Signal line.',
    defaultParams: { fast_period: 12, slow_period: 26, signal_period: 9 },
    paramConfig: [
      { key: 'fast_period', label: 'Fast EMA', min: 1 },
      { key: 'slow_period', label: 'Slow EMA', min: 1 },
      { key: 'signal_period', label: 'Signal Period', min: 1 },
    ],
    indicators: ['MACD (12, 26, 9)'],
  },
  {
    id: 'buy_and_hold',
    name: 'Buy & Hold Benchmark',
    shortDesc: 'Baseline buy-and-hold benchmark to evaluate active alpha generation and drawdown reduction.',
    defaultParams: {},
    paramConfig: [],
    indicators: ['Benchmark'],
  },
];

const POPULAR_SYMBOLS = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'SBIN', 'TATAMOTORS', 'ITC', 'WIPRO', 'BHARTIARTL',
];

const formatINR = (val: number | null | undefined): string => {
  if (val == null) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
};

const formatCommaNumber = (val: string | number): string => {
  const digits = String(val).replace(/[^0-9]/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return isNaN(num) ? '' : num.toLocaleString('en-IN');
};

export const StrategyBuilder: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedAlgoId, setSelectedAlgoId] = useState<string>('sma_crossover');
  const [symbol, setSymbol] = useState<string>('RELIANCE');
  const [period, setPeriod] = useState<string>('1yr');
  const [initialCapital, setInitialCapital] = useState<string>('10,000');
  const [strategyParams, setStrategyParams] = useState<Record<string, string | number>>(
    ESTABLISHED_ALGORITHMS[0].defaultParams
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QuantAlgorithmResult | null>(null);
  const [history, setHistory] = useState<QuantAlgorithmResult[]>([]);

  // Load analytics history and register live listener
  useEffect(() => {
    const loadHistory = () => {
      const saved = getSavedAnalytics();
      setHistory(saved);
      if (saved.length > 0) {
        setCurrentResult((prev) => (prev && saved.some((s) => s.id === prev.id) ? prev : saved[0]));
      } else {
        setCurrentResult(null);
      }
    };

    loadHistory();

    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener('quantlab-analytics-updated', handleUpdate);
    window.addEventListener('quantlab-auth-changed', handleUpdate);
    return () => {
      window.removeEventListener('quantlab-analytics-updated', handleUpdate);
      window.removeEventListener('quantlab-auth-changed', handleUpdate);
    };
  }, []);

  const handleSelectAlgorithm = (algo: AlgorithmDefinition) => {
    setSelectedAlgoId(algo.id);
    setStrategyParams(algo.defaultParams);
  };

  const handleParamChange = (key: string, value: string) => {
    // Strip leading zeros before digits (e.g. "03" -> "3")
    const clean = value.replace(/^0+(?=\d)/, '');
    setStrategyParams((prev) => ({
      ...prev,
      [key]: clean,
    }));
  };

  const handleParamBlur = (key: string, defVal: number, minVal?: number) => {
    setStrategyParams((prev) => {
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

  const handleExecuteStrategy = async (): Promise<void> => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) {
      setError('Please select or enter a valid stock symbol.');
      return;
    }

    const capital = parseFloat(initialCapital.replace(/,/g, ''));
    if (isNaN(capital) || capital <= 0) {
      setError('Initial capital must be a positive number.');
      return;
    }

    const numericParams: Record<string, number> = {};
    for (const [k, v] of Object.entries(strategyParams)) {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      numericParams[k] = isNaN(num) ? (activeAlgo.defaultParams[k] ?? 1) : num;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await marketDataService.runQuantAlgorithm(
        cleanSym,
        selectedAlgoId,
        period,
        capital,
        numericParams
      );
      setCurrentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute algorithm simulation.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all saved backtest analytics history?')) {
      clearSavedAnalytics();
      setHistory([]);
      setCurrentResult(null);
    }
  };

  const activeAlgo = ESTABLISHED_ALGORITHMS.find((a) => a.id === selectedAlgoId) || ESTABLISHED_ALGORITHMS[0];

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="p-6 md:p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Quantitative Strategy Builder</h1>
              <p className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>
                Select pre-built quantitative algorithms, tune parameters, and execute live simulations on Indian equity data.
              </p>
            </div>
            {history.length > 0 && (
              <Badge variant="primary">
                {history.length} Saved Analytics in History
              </Badge>
            )}
          </div>

          {/* Algorithm Selector Cards */}
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'} mb-4 flex items-center gap-2`}>
              <Sliders size={20} className="text-[#2563EB]" />
              Select Established Algorithm
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ESTABLISHED_ALGORITHMS.map((algo) => {
                const isSelected = algo.id === selectedAlgoId;
                return (
                  <button
                    key={algo.id}
                    type="button"
                    onClick={() => handleSelectAlgorithm(algo)}
                    className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#2563EB]/20 ring-2 ring-[#2563EB]/30 shadow-md'
                        : isDark
                          ? 'border-[#1F2937] bg-[#111827] hover:border-[#2563EB]/40 hover:bg-[#1F2937]/70'
                          : 'border-[#E2E8F0] bg-white hover:border-[#93C5FD] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-[#3B82F6]' : isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                          {algo.id.replace('_', ' ')}
                        </span>
                        {isSelected && <CheckCircle2 size={16} className="text-[#2563EB]" />}
                      </div>
                      <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-[#0F172A]'} mb-1`}>{algo.name}</h3>
                      <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'} line-clamp-2`}>{algo.shortDesc}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {algo.indicators.map((ind) => (
                        <span key={ind} className={`text-[10px] ${isDark ? 'bg-[#0B0F19] border-[#1F2937] text-slate-300' : 'bg-white/80 border-[#E2E8F0] text-[#0F172A]'} px-2 py-0.5 rounded-full font-medium`}>
                          {ind}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Form & Execution */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'} mb-4`}>Configuration & Parameters</h2>
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className={`block text-xs font-semibold ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'} uppercase mb-1`}>Asset Symbol</label>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className={`w-full rounded-xl border ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'} px-3 py-2.5 text-sm outline-none`}
                    >
                      {POPULAR_SYMBOLS.map((s) => (
                        <option key={s} value={s}>{s} (NSE)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'} uppercase mb-1`}>Lookback Period</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className={`w-full rounded-xl border ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'} px-3 py-2.5 text-sm outline-none`}
                    >
                      <option value="1m">1 Month</option>
                      <option value="6m">6 Months</option>
                      <option value="1yr">1 Year</option>
                      <option value="3yr">3 Years</option>
                      <option value="5yr">5 Years</option>
                    </select>
                  </div>
                  <div>
                    <Input
                      label="Initial Capital (INR)"
                      type="text"
                      inputMode="numeric"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(formatCommaNumber(e.target.value))}
                      placeholder="10,000"
                    />
                  </div>
                </div>

                {/* Dynamic Parameter Fields */}
                {activeAlgo.paramConfig.length > 0 && (
                  <div className={`pt-4 border-t ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'} mb-3 flex items-center gap-2`}>
                      <Sliders size={16} className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'} />
                      Algorithm Parameters: {activeAlgo.name}
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {activeAlgo.paramConfig.map((p) => (
                        <div key={p.key}>
                          <label className={`block text-xs font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'} mb-1`}>{p.label}</label>
                          <input
                            type="number"
                            step={p.step || 1}
                            min={p.min || 1}
                            value={strategyParams[p.key] !== undefined ? strategyParams[p.key] : (activeAlgo.defaultParams[p.key] ?? '')}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/^0+(?=\d)/, '');
                              if (e.target.value !== clean) {
                                e.target.value = clean;
                              }
                              handleParamChange(p.key, clean);
                            }}
                            onBlur={() => handleParamBlur(p.key, activeAlgo.defaultParams[p.key] ?? 1, p.min || 1)}
                            className={`w-full rounded-xl border ${isDark ? 'border-[#1F2937] bg-[#0B0F19] text-white focus:border-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#0F172A] focus:border-[#2563EB]'} px-3 py-2 text-sm outline-none`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3">
                  <ShieldAlert size={20} className="text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Sidebar Summary & Launch */}
            <div className="space-y-6">
              <Card>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'} mb-3`}>Strategy Summary</h3>
                <div className="space-y-2.5 text-sm">
                  <div className={`flex justify-between py-1 border-b ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Algorithm</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{activeAlgo.name}</span>
                  </div>
                  <div className={`flex justify-between py-1 border-b ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Ticker</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{symbol}:NSE</span>
                  </div>
                  <div className={`flex justify-between py-1 border-b ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Time Horizon</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{period}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}>Capital</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>₹{parseFloat(initialCapital.replace(/,/g, '') || '0').toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="mt-5">
                  <Button
                    fullWidth
                    size="lg"
                    onClick={handleExecuteStrategy}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Play size={18} />
                    {loading ? 'Running Quant Engine...' : 'Execute Strategy'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Results Section */}
          {currentResult && (
            <div className={`space-y-6 pt-4 border-t ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    Simulation Results: {currentResult.algorithm.toUpperCase()} on {currentResult.symbol}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                    Run executed at {new Date(currentResult.timestamp).toLocaleString()} · Period: {currentResult.period}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentResult.metrics.totalReturnPct >= 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    Alpha vs Benchmark: {(currentResult.metrics.totalReturnPct - currentResult.metrics.benchmarkReturnPct).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { label: 'Initial Capital', value: formatINR(currentResult.metrics.initialCapital) },
                  { label: 'Final Equity', value: formatINR(currentResult.metrics.finalEquity) },
                  {
                    label: 'Total Return',
                    value: `${currentResult.metrics.totalReturnPct > 0 ? '+' : ''}${currentResult.metrics.totalReturnPct.toFixed(2)}%`,
                    isPositive: currentResult.metrics.totalReturnPct >= 0,
                  },
                  {
                    label: 'Benchmark Return',
                    value: `${currentResult.metrics.benchmarkReturnPct > 0 ? '+' : ''}${currentResult.metrics.benchmarkReturnPct.toFixed(2)}%`,
                  },
                  { label: 'CAGR', value: `${currentResult.metrics.cagrPct.toFixed(2)}%` },
                  {
                    label: 'Sharpe Ratio',
                    value: currentResult.metrics.sharpeRatio != null ? currentResult.metrics.sharpeRatio.toFixed(2) : 'N/A',
                  },
                  {
                    label: 'Max Drawdown',
                    value: `${currentResult.metrics.maxDrawdownPct.toFixed(2)}%`,
                    isDanger: currentResult.metrics.maxDrawdownPct > 20,
                  },
                  {
                    label: 'Trades / Win Rate',
                    value: `${currentResult.metrics.totalTrades} (${currentResult.metrics.winRatePct.toFixed(1)}%)`,
                  },
                ].map((item, idx) => (
                  <div key={idx} className={`rounded-2xl border p-3 shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                    <p className={`text-[10px] uppercase tracking-wider font-medium truncate ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{item.label}</p>
                    <p className={`mt-1 text-base font-bold truncate ${
                      item.isPositive === true ? 'text-[#10B981]' :
                      item.isPositive === false ? 'text-[#EF4444]' :
                      item.isDanger ? 'text-[#F59E0B]' : (isDark ? 'text-white' : 'text-[#0F172A]')
                    }`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Equity Curve & Drawdown Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Equity Curve: Strategy vs Benchmark</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentResult.equityCurve}>
                        <defs>
                          <linearGradient id="stratGradient" x1="0" y1="0" x2="0" y2="1">
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
                        <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} domain={['auto', 'auto']} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value: any, name: any) => [formatINR(Number(value)), name === 'strategyEquity' ? 'Strategy' : 'Benchmark']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="strategyEquity" name="Strategy Equity" stroke="#3B82F6" fillOpacity={1} fill="url(#stratGradient)" strokeWidth={2} />
                        <Area type="monotone" dataKey="benchmarkEquity" name="Benchmark (Buy & Hold)" stroke="#94A3B8" fillOpacity={0} strokeDasharray="4 4" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <h3 className={`text-base font-semibold mb-4 ${isDark ? "text-white" : "text-[#0F172A]"}`}>Underwater Drawdown Curve (%)</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentResult.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1F2937" : "#E2E8F0"} />
                        <XAxis
                          dataKey="date"
                          stroke={isDark ? "#94A3B8" : "#64748B"}
                          tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          minTickGap={30}
                        />
                        <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Bar dataKey="drawdown" name="Drawdown %" fill="#EF4444" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Saved Analytics History Table */}
          <div className={`space-y-4 pt-6 border-t ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-[#0F172A]"}`}>
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
              <Card>
                <div className={`py-8 text-center ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                  <Clock size={32} className="mx-auto mb-2 text-[#94A3B8]" />
                  <p className="text-sm font-medium">No saved analytics yet</p>
                  <p className={`text-xs mt-1 ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                    Execute an algorithm above or run a backtest to automatically save up to 20 historical analytics runs.
                  </p>
                </div>
              </Card>
            ) : (
              <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDark ? 'border-[#1F2937] bg-[#111827]' : 'border-[#E2E8F0] bg-white'}`}>
                <table className="w-full text-left text-sm">
                  <thead className={`text-[11px] font-semibold uppercase tracking-wider border-b ${isDark ? "bg-[#0B0F19] text-[#94A3B8] border-[#1F2937]" : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"}`}>
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Algorithm</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Return %</th>
                      <th className="py-3 px-4 text-right">Sharpe</th>
                      <th className="py-3 px-4 text-right">Max DD</th>
                      <th className="py-3 px-4 text-right">Trades</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1F2937]' : 'divide-[#E2E8F0]'}`}>
                    {history.map((item) => {
                      const isCurrent = currentResult?.id === item.id;
                      const isPositive = item.metrics.totalReturnPct >= 0;
                      return (
                        <tr
                          key={item.id}
                          className={`transition cursor-pointer ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-100'} ${
                            isCurrent ? (isDark ? 'bg-[#2563EB]/20' : 'bg-[#EEF4FF]') : ''
                          }`}
                          onClick={() => setCurrentResult(item)}
                        >
                          <td className={`py-3 px-4 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                            {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className={`py-3 px-4 font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{item.symbol}</td>
                          <td className="py-3 px-4 text-xs font-medium text-[#2563EB]">
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
                            <span className="text-xs text-[#2563EB] hover:underline font-semibold">
                              {isCurrent ? 'Active' : 'Load'}
                            </span>
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
